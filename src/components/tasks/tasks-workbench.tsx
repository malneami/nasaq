'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeAreaBadge } from '@/components/life-areas';
import {
  StatusPill,
  TASK_PRIORITY_TONES,
  TASK_STATUS_TONES,
} from '@/components/status-pill';
import { TaskEditor, emptyTaskValues } from '@/components/tasks/task-editor';
import { TaskSelectPanel } from '@/components/tasks/task-select-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { listProjectOptions } from '@/lib/goals/actions';
import { listLifeAreaRows, type LifeAreaDto } from '@/lib/life-areas/actions';
import type { AppLocale } from '@/lib/i18n/routing';
import type { EnergyLevel, TaskStatus, TaskType } from '@/lib/db/schema';
import {
  DEFAULT_TASK_LIST_STATUSES,
  PRIORITY_RANK,
  TASK_STATUS_TRANSITIONS,
} from '@/lib/tasks/constants';
import {
  archiveTask,
  changeTaskStatus,
  listTaskCards,
  quickAddTask,
  saveTask,
  spawnWaitingFromTask,
} from '@/lib/tasks/actions';
import type { TaskCardDto } from '@/lib/tasks/service';
import { cn } from '@/lib/utils';
import {
  ENERGY_LEVELS,
  TASK_STATUSES,
  TASK_TYPES,
  type TaskFormInput,
} from '@/lib/validations/task';

const TASKS_KEY = ['task-cards'] as const;
const AREAS_KEY = ['life-areas'] as const;
const PROJECTS_KEY = ['project-options'] as const;

const SELECT_CLASS =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

type Grouping = 'project' | 'status' | 'flat';
type ViewMode = 'list' | 'next';
type SortKey = 'due' | 'priority' | 'estimated' | 'created';

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function sortTasks(rows: TaskCardDto[], sort: SortKey) {
  return [...rows].sort((a, b) => {
    if (sort === 'priority') {
      return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    }
    if (sort === 'estimated') {
      return (a.estimatedMinutes ?? 9999) - (b.estimatedMinutes ?? 9999);
    }
    if (sort === 'created') {
      return b.createdAt.localeCompare(a.createdAt);
    }
    const aDate = a.dueDate ?? '9999-12-31';
    const bDate = b.dueDate ?? '9999-12-31';
    return aDate.localeCompare(bDate);
  });
}

export function TasksWorkbench() {
  const t = useTranslations('tasks');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>('list');
  const [grouping, setGrouping] = useState<Grouping>('status');
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(
    () => new Set(DEFAULT_TASK_LIST_STATUSES),
  );
  const [projectFilter, setProjectFilter] = useState('all');
  const [lifeAreaFilter, setLifeAreaFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskType>('all');
  const [contextFilter, setContextFilter] = useState('all');
  const [energyFilter, setEnergyFilter] = useState<'all' | EnergyLevel>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('due');
  const [editing, setEditing] = useState<TaskCardDto | 'new' | null>(null);
  const [pending, setPending] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickProject, setQuickProject] = useState('');
  const [quickMinutes, setQuickMinutes] = useState('');
  const [waitingFor, setWaitingFor] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [waitingItem, setWaitingItem] = useState('');
  const [waitingOrg, setWaitingOrg] = useState('');

  const tasksQuery = useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const result = await listTaskCards();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.tasks ?? [];
    },
  });
  const areasQuery = useQuery({
    queryKey: AREAS_KEY,
    queryFn: async () => {
      const result = await listLifeAreaRows(true);
      return result.areas ?? [];
    },
  });
  const projectsQuery = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const result = await listProjectOptions();
      return result.projects ?? [];
    },
  });

  const areas = areasQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const today = todayIso();

  const contexts = useMemo(() => {
    const values = new Set<string>();
    for (const task of tasksQuery.data ?? []) {
      if (task.context?.trim()) {
        values.add(task.context.trim());
      }
    }
    return [...values].sort();
  }, [tasksQuery.data]);

  const filtered = useMemo(() => {
    const rows = (tasksQuery.data ?? []).filter((task) => {
      if (view === 'next') {
        if (task.status !== 'next') {
          return false;
        }
      } else if (statusFilter.size > 0 && !statusFilter.has(task.status)) {
        return false;
      }
      if (projectFilter === 'standalone' && task.projectId) {
        return false;
      }
      if (
        projectFilter !== 'all' &&
        projectFilter !== 'standalone' &&
        task.projectId !== projectFilter
      ) {
        return false;
      }
      if (
        lifeAreaFilter !== 'all' &&
        !task.lifeAreaIds.includes(lifeAreaFilter)
      ) {
        return false;
      }
      if (typeFilter !== 'all' && task.type !== typeFilter) {
        return false;
      }
      if (contextFilter !== 'all' && task.context !== contextFilter) {
        return false;
      }
      if (energyFilter !== 'all' && task.energy !== energyFilter) {
        return false;
      }
      if (overdueOnly) {
        if (!task.dueDate || task.dueDate >= today) {
          return false;
        }
        if (task.status === 'completed' || task.status === 'cancelled') {
          return false;
        }
      }
      return true;
    });
    return sortTasks(rows, sort);
  }, [
    tasksQuery.data,
    view,
    statusFilter,
    projectFilter,
    lifeAreaFilter,
    typeFilter,
    contextFilter,
    energyFilter,
    overdueOnly,
    sort,
    today,
  ]);

  const groups = useMemo(() => {
    const mode: Grouping = view === 'next' ? 'project' : grouping;
    if (mode === 'flat') {
      return [{ key: 'all', label: t('allTasks'), items: filtered }];
    }
    if (mode === 'status') {
      return TASK_STATUSES.filter((status) =>
        filtered.some((task) => task.status === status),
      ).map((status) => ({
        key: status,
        label: t(`statuses.${status}`),
        items: filtered.filter((task) => task.status === status),
      }));
    }
    const map = new Map<string, TaskCardDto[]>();
    const order: string[] = [];
    for (const task of filtered) {
      const key = task.projectId ?? '__standalone__';
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(task);
    }
    return order.map((key) => {
      const items = map.get(key)!;
      return {
        key,
        label: items[0]?.projectName ?? t('standalone'),
        items,
      };
    });
  }, [filtered, grouping, view, t]);

  function toggleStatus(status: TaskStatus) {
    setStatusFilter((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
  }

  async function onStatusChange(task: TaskCardDto, status: TaskStatus) {
    const result = await changeTaskStatus({ id: task.id, status });
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    await refresh();
    if (result.waitingOffered) {
      setWaitingFor({ id: task.id, title: task.title });
      setWaitingItem(task.title);
      setWaitingOrg('');
    }
  }

  async function onQuickAdd() {
    const title = quickTitle.trim();
    if (!title) {
      return;
    }
    setPending(true);
    const result = await quickAddTask({
      title,
      projectId: quickProject || undefined,
      estimatedMinutes: quickMinutes || undefined,
    });
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setQuickTitle('');
    setQuickMinutes('');
    toast.success(t('saved'));
    await refresh();
  }

  const taskById = new Map((tasksQuery.data ?? []).map((task) => [task.id, task]));

  return (
    <div className="space-y-6">
      <TaskSelectPanel
        onOpenTask={(id) => {
          const task = taskById.get(id);
          if (task) {
            setEditing(task);
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={view === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('list')}
        >
          {t('viewList')}
        </Button>
        <Button
          type="button"
          variant={view === 'next' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('next')}
        >
          {t('viewNext')}
        </Button>
        <Button type="button" size="sm" onClick={() => setEditing('new')}>
          {t('create')}
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onQuickAdd();
        }}
      >
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="quick-title">{t('quickAdd')}</Label>
          <Input
            id="quick-title"
            value={quickTitle}
            placeholder={t('quickPlaceholder')}
            onChange={(event) => setQuickTitle(event.target.value)}
          />
        </div>
        <select
          className={SELECT_CLASS}
          value={quickProject}
          onChange={(event) => setQuickProject(event.target.value)}
        >
          <option value="">{t('noProject')}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <Input
          className="h-8 w-24"
          inputMode="numeric"
          placeholder={t('minutesShort')}
          value={quickMinutes}
          onChange={(event) => setQuickMinutes(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={pending || !quickTitle.trim()}>
          {t('add')}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={SELECT_CLASS}
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
        >
          <option value="all">{t('allProjects')}</option>
          <option value="standalone">{t('standalone')}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={lifeAreaFilter}
          onChange={(event) => setLifeAreaFilter(event.target.value)}
        >
          <option value="all">{t('allAreas')}</option>
          {areas
            .filter((area) => !area.archivedAt)
            .map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as 'all' | TaskType)
          }
        >
          <option value="all">{t('allTypes')}</option>
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={contextFilter}
          onChange={(event) => setContextFilter(event.target.value)}
        >
          <option value="all">{t('allContexts')}</option>
          {contexts.map((context) => (
            <option key={context} value={context}>
              {context}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={energyFilter}
          onChange={(event) =>
            setEnergyFilter(event.target.value as 'all' | EnergyLevel)
          }
        >
          <option value="all">{t('allEnergies')}</option>
          {ENERGY_LEVELS.map((energy) => (
            <option key={energy} value={energy}>
              {t(`energies.${energy}`)}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
        >
          <option value="due">{t('sortDue')}</option>
          <option value="priority">{t('sortPriority')}</option>
          <option value="estimated">{t('sortEstimated')}</option>
          <option value="created">{t('sortCreated')}</option>
        </select>
        {view === 'list' ? (
          <select
            className={SELECT_CLASS}
            value={grouping}
            onChange={(event) => setGrouping(event.target.value as Grouping)}
          >
            <option value="status">{t('groupStatus')}</option>
            <option value="project">{t('groupProject')}</option>
            <option value="flat">{t('groupFlat')}</option>
          </select>
        ) : null}
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
          />
          {t('overdueOnly')}
        </label>
      </div>

      {view === 'list' ? (
        <div className="flex flex-wrap gap-1.5">
          {TASK_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className={cn(
                'rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                statusFilter.has(status) ? 'ring-2 ring-ring' : 'opacity-60',
              )}
            >
              <StatusPill
                label={t(`statuses.${status}`)}
                tone={TASK_STATUS_TONES[status]}
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('nextHint')}</p>
      )}

      {tasksQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : groups.every((group) => group.items.length === 0) ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        groups.map((group) =>
          group.items.length === 0 ? null : (
            <section key={group.key} className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    areaById={areaById}
                    onOpen={() => setEditing(task)}
                    onStatus={(status) => void onStatusChange(task, status)}
                  />
                ))}
              </ul>
            </section>
          ),
        )
      )}

      <TaskEditor
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        open={editing !== null}
        locale={locale}
        task={editing === 'new' ? null : editing}
        areas={areas}
        projects={projects}
        pending={pending}
        onClose={() => setEditing(null)}
        onSave={async (values: TaskFormInput) => {
          setPending(true);
          const result = await saveTask({
            id: editing && editing !== 'new' ? editing.id : undefined,
            values:
              editing === 'new' && !values.title
                ? { ...emptyTaskValues(), ...values }
                : values,
          });
          setPending(false);
          if (result.error) {
            toast.error(t('saveFailed'));
            return;
          }
          toast.success(t('saved'));
          setEditing(null);
          await refresh();
        }}
        onDelete={async () => {
          if (!editing || editing === 'new') {
            return;
          }
          setPending(true);
          const result = await archiveTask(editing.id);
          setPending(false);
          if (result.error) {
            toast.error(t('saveFailed'));
            return;
          }
          setEditing(null);
          await refresh();
        }}
      />

      <Sheet
        open={waitingFor !== null}
        onOpenChange={(next) => !next && setWaitingFor(null)}
      >
        <SheetContent
          side={locale === 'ar' ? 'left' : 'right'}
          closeLabel={t('close')}
          className="w-full sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>{t('waitingTitle')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <p className="text-sm text-muted-foreground">{t('waitingHint')}</p>
            <div className="space-y-1.5">
              <Label htmlFor="waiting-item">{t('waitingItem')}</Label>
              <Input
                id="waiting-item"
                value={waitingItem}
                onChange={(event) => setWaitingItem(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waiting-org">{t('waitingOrg')}</Label>
              <Input
                id="waiting-org"
                value={waitingOrg}
                onChange={(event) => setWaitingOrg(event.target.value)}
              />
            </div>
            <SheetFooter className="mt-auto flex-row justify-end gap-2 px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWaitingFor(null)}
              >
                {t('waitingSkip')}
              </Button>
              <Button
                type="button"
                disabled={!waitingItem.trim() || !waitingFor}
                onClick={async () => {
                  if (!waitingFor) {
                    return;
                  }
                  const result = await spawnWaitingFromTask({
                    taskId: waitingFor.id,
                    values: { item: waitingItem, org: waitingOrg },
                  });
                  if (result.error) {
                    toast.error(t('saveFailed'));
                    return;
                  }
                  setWaitingFor(null);
                  await refresh();
                }}
              >
                {t('waitingCreate')}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TaskRow({
  task,
  areaById,
  onOpen,
  onStatus,
}: {
  task: TaskCardDto;
  areaById: Map<string, LifeAreaDto>;
  onOpen: () => void;
  onStatus: (status: TaskStatus) => void;
}) {
  const t = useTranslations('tasks');
  const transitions = TASK_STATUS_TRANSITIONS[task.status];

  return (
    <li>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <button type="button" className="min-w-0 text-start" onClick={onOpen}>
            <p className="font-medium">{task.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {task.projectName ?? t('standalone')}
              {task.estimatedMinutes
                ? ` · ${t('estimatedLabel', { minutes: task.estimatedMinutes })}`
                : ''}
              {task.dueDate ? ` · ${task.dueDate}` : ''}
            </p>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusPill
              label={t(`priorities.${task.priority}`)}
              tone={TASK_PRIORITY_TONES[task.priority]}
            />
            <select
              className={SELECT_CLASS}
              value={task.status}
              onChange={(event) => onStatus(event.target.value as TaskStatus)}
            >
              <option value={task.status}>{t(`statuses.${task.status}`)}</option>
              {transitions.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <StatusPill
            label={t(`types.${task.type}`)}
            tone="neutral"
          />
          {task.context ? (
            <StatusPill label={task.context} tone="muted" />
          ) : null}
          {task.lifeAreaIds.map((id) => {
            const area = areaById.get(id);
            if (!area) {
              return null;
            }
            return (
              <LifeAreaBadge
                key={id}
                name={area.name}
                color={area.color}
                icon={area.icon}
                archived={Boolean(area.archivedAt)}
              />
            );
          })}
        </div>
      </div>
    </li>
  );
}
