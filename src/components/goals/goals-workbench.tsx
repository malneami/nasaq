'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { LifeAreaBadge, LifeAreaMultiSelect } from '@/components/life-areas';
import { GOAL_STATUS_TONES, StatusPill } from '@/components/status-pill';
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
import { Textarea } from '@/components/ui/textarea';
import {
  archiveGoal,
  listGoalCards,
  listProjectOptions,
  saveGoal,
  type GoalCardDto,
  type ProjectOptionDto,
} from '@/lib/goals/actions';
import { listLifeAreaRows, type LifeAreaDto } from '@/lib/life-areas/actions';
import {
  GOAL_STATUSES,
  goalFormSchema,
  type GoalFormInput,
} from '@/lib/validations/goal';
import type { AppLocale } from '@/lib/i18n/routing';
import type { GoalStatus } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const GOALS_KEY = ['goal-cards'] as const;
const AREAS_KEY = ['life-areas'] as const;
const PROJECTS_KEY = ['project-options'] as const;

const DEFAULT_STATUSES: GoalStatus[] = ['planned', 'active'];

function emptyValues(): GoalFormInput {
  return {
    title: '',
    description: '',
    successMetric: '',
    status: 'planned',
    progress: 0,
    startDate: '',
    targetDate: '',
    lifeAreaIds: [],
    projectIds: [],
  };
}

function toFormValues(goal: GoalCardDto): GoalFormInput {
  return {
    title: goal.title,
    description: goal.description ?? '',
    successMetric: goal.successMetric ?? '',
    status: goal.status,
    progress: goal.progress,
    startDate: goal.startDate ?? '',
    targetDate: goal.targetDate ?? '',
    lifeAreaIds: goal.lifeAreaIds,
    projectIds: goal.projectIds,
  };
}

export function GoalsWorkbench() {
  const t = useTranslations('goals');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Set<GoalStatus>>(
    () => new Set(DEFAULT_STATUSES),
  );
  const [lifeAreaFilter, setLifeAreaFilter] = useState<string>('all');
  const [sort, setSort] = useState<'target' | 'progress'>('target');
  const [editing, setEditing] = useState<GoalCardDto | 'new' | null>(null);
  const [pending, setPending] = useState(false);

  const goalsQuery = useQuery({
    queryKey: GOALS_KEY,
    queryFn: async () => {
      const result = await listGoalCards();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.goals ?? [];
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

  const filtered = useMemo(() => {
    const rows = (goalsQuery.data ?? []).filter((goal) => {
      if (statusFilter.size > 0 && !statusFilter.has(goal.status)) {
        return false;
      }
      if (
        lifeAreaFilter !== 'all' &&
        !goal.lifeAreaIds.includes(lifeAreaFilter)
      ) {
        return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === 'progress') {
        return b.progress - a.progress;
      }
      const aDate = a.targetDate ?? '9999-12-31';
      const bDate = b.targetDate ?? '9999-12-31';
      return aDate.localeCompare(bDate);
    });
  }, [goalsQuery.data, statusFilter, lifeAreaFilter, sort]);

  const areas = areasQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const areaById = new Map(areas.map((area) => [area.id, area]));

  const grouped = useMemo(() => {
    const groups: { status: GoalStatus; items: GoalCardDto[] }[] = [];
    for (const status of GOAL_STATUSES) {
      const items = filtered.filter((goal) => goal.status === status);
      if (items.length > 0) {
        groups.push({ status, items });
      }
    }
    return groups;
  }, [filtered]);

  function toggleStatus(status: GoalStatus) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setEditing('new')}>
          {t('create')}
        </Button>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
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
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as 'target' | 'progress')
          }
        >
          <option value="target">{t('sortTarget')}</option>
          <option value="progress">{t('sortProgress')}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GOAL_STATUSES.map((status) => (
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
              tone={GOAL_STATUS_TONES[status]}
            />
          </button>
        ))}
      </div>

      {goalsQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        grouped.map((group) => (
          <section key={group.status} className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t(`statuses.${group.status}`)}
            </h3>
            <ul className="space-y-2">
              {group.items.map((goal) => (
                <li key={goal.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-border bg-card p-4 text-start"
                    onClick={() => setEditing(goal)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{goal.title}</p>
                      <StatusPill
                        label={t(`statuses.${goal.status}`)}
                        tone={GOAL_STATUS_TONES[goal.status]}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {goal.lifeAreaIds.map((id) => {
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
                    <p className="mt-2 text-sm text-muted-foreground">
                      {goal.successMetric}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {goal.targetDate
                          ? t('targetOn', { date: goal.targetDate })
                          : t('noTarget')}
                      </span>
                      <span>
                        {t('linkedProjectsCount', {
                          count: goal.projectIds.length,
                        })}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <GoalEditor
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        open={editing !== null}
        locale={locale}
        goal={editing === 'new' ? null : editing}
        areas={areas}
        projects={projects}
        pending={pending}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          setPending(true);
          const result = await saveGoal({
            id: editing && editing !== 'new' ? editing.id : undefined,
            values,
          });
          setPending(false);
          if (result.error) {
            toast.error(
              result.error === 'lifeAreaRequired'
                ? t('lifeAreaRequired')
                : t('saveFailed'),
            );
            return;
          }
          toast.success(t('saved'));
          setEditing(null);
          await queryClient.invalidateQueries({ queryKey: GOALS_KEY });
          await queryClient.invalidateQueries({ queryKey: AREAS_KEY });
        }}
        onDelete={async () => {
          if (!editing || editing === 'new') {
            return;
          }
          setPending(true);
          const result = await archiveGoal(editing.id);
          setPending(false);
          if (result.error) {
            toast.error(t('saveFailed'));
            return;
          }
          setEditing(null);
          await queryClient.invalidateQueries({ queryKey: GOALS_KEY });
        }}
      />
    </div>
  );
}

function GoalEditor({
  open,
  locale,
  goal,
  areas,
  projects,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  locale: AppLocale;
  goal: GoalCardDto | null;
  areas: LifeAreaDto[];
  projects: ProjectOptionDto[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: GoalFormInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations('goals');
  const form = useForm<GoalFormInput>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal ? toFormValues(goal) : emptyValues(),
  });

  const progress = useWatch({ control: form.control, name: 'progress' });
  const lifeAreaIds = useWatch({ control: form.control, name: 'lifeAreaIds' });
  const projectIds = useWatch({ control: form.control, name: 'projectIds' });

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={t('close')}
        className="w-full sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{goal ? t('editTitle') : t('createTitle')}</SheetTitle>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={form.handleSubmit((values) => onSave(values))}
        >
          <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
            {t('outcomeHint')}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">{t('title')}</Label>
            <Input id="goal-title" {...form.register('title')} />
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive">{t('titleRequired')}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-metric">{t('successMetric')}</Label>
            <Textarea
              id="goal-metric"
              className="min-h-20"
              placeholder={t('successMetricPlaceholder')}
              {...form.register('successMetric')}
            />
            {form.formState.errors.successMetric ? (
              <p className="text-sm text-destructive">{t('successMetricRequired')}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('successMetricHint')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-description">{t('description')}</Label>
            <Textarea
              id="goal-description"
              className="min-h-20"
              {...form.register('description')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('lifeAreas')}</Label>
            <LifeAreaMultiSelect
              areas={areas}
              value={lifeAreaIds}
              onChange={(ids) =>
                form.setValue('lifeAreaIds', ids, { shouldValidate: true })
              }
            />
            {form.formState.errors.lifeAreaIds ? (
              <p className="text-sm text-destructive">{t('lifeAreaRequired')}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">{t('startDate')}</Label>
              <Input id="start-date" type="date" {...form.register('startDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-date">{t('targetDate')}</Label>
              <Input
                id="target-date"
                type="date"
                {...form.register('targetDate')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-status">{t('status')}</Label>
            <select
              id="goal-status"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              {...form.register('status')}
            >
              {GOAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-progress">
              {t('progress')}: {progress}%
            </Label>
            <input
              id="goal-progress"
              type="range"
              min={0}
              max={100}
              className="w-full"
              // TODO: progress may later be derived from linked project milestones — do not auto-derive yet.
              {...form.register('progress', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('relatedProjects')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
              ) : (
                projects.map((project) => {
                  const selected = projectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs',
                        selected
                          ? 'border-ring bg-muted'
                          : 'border-border text-muted-foreground',
                      )}
                      onClick={() => {
                        form.setValue(
                          'projectIds',
                          selected
                            ? projectIds.filter((id) => id !== project.id)
                            : [...projectIds, project.id],
                        );
                      }}
                    >
                      {project.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <SheetFooter className="px-0">
            {goal ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void onDelete()}
              >
                {t('delete')}
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
