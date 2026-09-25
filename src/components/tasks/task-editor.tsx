'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { LifeAreaBadge, LifeAreaMultiSelect } from '@/components/life-areas';
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
import type { LifeAreaDto } from '@/lib/life-areas/actions';
import type { ProjectOptionDto } from '@/lib/goals/actions';
import type { TaskCardDto } from '@/lib/tasks/service';
import type { AppLocale } from '@/lib/i18n/routing';
import {
  ENERGY_LEVELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  taskFormSchema,
  type TaskFormInput,
} from '@/lib/validations/task';

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

export function emptyTaskValues(): TaskFormInput {
  return {
    title: '',
    description: '',
    projectId: '',
    lifeAreaIds: [],
    owner: '',
    priority: 'medium',
    status: 'next',
    dueDate: '',
    estimatedMinutes: '',
    energy: 'medium',
    type: 'quick_task',
    context: '',
  };
}

export function toTaskFormValues(task: TaskCardDto): TaskFormInput {
  return {
    title: task.title,
    description: task.description ?? '',
    projectId: task.projectId ?? '',
    lifeAreaIds: task.projectId ? [] : task.lifeAreaIds,
    owner: task.owner ?? '',
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? '',
    estimatedMinutes:
      task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
    energy: task.energy,
    type: task.type,
    context: task.context ?? '',
  };
}

export function TaskEditor({
  open,
  locale,
  task,
  areas,
  projects,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  locale: AppLocale;
  task: TaskCardDto | null;
  areas: LifeAreaDto[];
  projects: ProjectOptionDto[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: TaskFormInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations('tasks');
  const form = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: task ? toTaskFormValues(task) : emptyTaskValues(),
  });

  const projectId = useWatch({ control: form.control, name: 'projectId' });
  const lifeAreaIds = useWatch({ control: form.control, name: 'lifeAreaIds' });
  const linked = Boolean(projectId);
  const derivedAreas =
    linked && task && task.projectId === projectId ? task.lifeAreaIds : [];
  const areaById = new Map(areas.map((area) => [area.id, area]));

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={t('close')}
        className="w-full sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{task ? t('editTitle') : t('createTitle')}</SheetTitle>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={form.handleSubmit((values) => onSave(values))}
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t('title')}</Label>
            <Input id="task-title" {...form.register('title')} />
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive">{t('titleRequired')}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">{t('description')}</Label>
            <Textarea
              id="task-description"
              className="min-h-20"
              {...form.register('description')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-project">{t('project')}</Label>
            <select
              id="task-project"
              className={SELECT_CLASS}
              {...form.register('projectId')}
            >
              <option value="">{t('noProject')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          {linked ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('lifeAreas')}</p>
              <p className="text-xs text-muted-foreground">{t('lifeAreasFromProject')}</p>
              {derivedAreas.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {derivedAreas.map((id) => {
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
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('lifeAreas')}</p>
              <LifeAreaMultiSelect
                areas={areas.filter((area) => !area.archivedAt)}
                value={lifeAreaIds}
                onChange={(next) => form.setValue('lifeAreaIds', next)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">{t('status')}</Label>
              <select
                id="task-status"
                className={SELECT_CLASS}
                {...form.register('status')}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`statuses.${status}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">{t('priority')}</Label>
              <select
                id="task-priority"
                className={SELECT_CLASS}
                {...form.register('priority')}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priorities.${priority}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-type">{t('type')}</Label>
              <select
                id="task-type"
                className={SELECT_CLASS}
                {...form.register('type')}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-energy">{t('energy')}</Label>
              <select
                id="task-energy"
                className={SELECT_CLASS}
                {...form.register('energy')}
              >
                {ENERGY_LEVELS.map((energy) => (
                  <option key={energy} value={energy}>
                    {t(`energies.${energy}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">{t('dueDate')}</Label>
              <Input id="task-due" type="date" {...form.register('dueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-minutes">{t('estimatedMinutes')}</Label>
              <Input
                id="task-minutes"
                inputMode="numeric"
                {...form.register('estimatedMinutes')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-owner">{t('owner')}</Label>
            <Input id="task-owner" {...form.register('owner')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-context">{t('context')}</Label>
            <Input
              id="task-context"
              placeholder={t('contextPlaceholder')}
              {...form.register('context')}
            />
          </div>
          <SheetFooter className="mt-auto flex-row justify-between gap-2 px-0">
            {task ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onDelete()}
              >
                {t('delete')}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
