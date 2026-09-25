'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  LIFE_AREA_COLOR_OPTIONS,
  LIFE_AREA_ICON_OPTIONS,
  LifeAreaBadge,
  LifeAreaIcon,
} from '@/components/life-areas';
import { StatusPill } from '@/components/status-pill';
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
import {
  archiveLifeAreaRow,
  createLifeAreaRow,
  getLifeAreaDetail,
  listLifeAreaRows,
  reorderLifeAreaRows,
  updateLifeAreaRow,
  type LifeAreaDto,
} from '@/lib/life-areas/actions';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/lib/i18n/routing';

type AreaForm = { name: string; icon: string; color: string };

const emptyForm: AreaForm = {
  name: '',
  icon: 'sparkles',
  color: LIFE_AREA_COLOR_OPTIONS[0],
};

const AREAS_KEY = ['life-areas'] as const;

export function LifeAreasManager() {
  const t = useTranslations('lifeAreas');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const areasQuery = useQuery({
    queryKey: AREAS_KEY,
    queryFn: async () => {
      const result = await listLifeAreaRows(true);
      if (result.error || !result.areas) {
        throw new Error(result.error ?? 'failed');
      }
      return result.areas;
    },
  });
  const [showArchived, setShowArchived] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    id?: string;
    form: AreaForm;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof getLifeAreaDetail>
  > | null>(null);
  const [pending, setPending] = useState(false);

  const areas = areasQuery.data ?? [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: AREAS_KEY });
  }

  const visible = areas.filter((area) => showArchived || !area.archivedAt);

  async function persistOrder(next: LifeAreaDto[]) {
    queryClient.setQueryData(AREAS_KEY, next);
    const result = await reorderLifeAreaRows(next.map((area) => area.id));
    if (result.error) {
      toast.error(t('saveFailed'));
      await refresh();
    }
  }

  function onDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    const from = areas.findIndex((area) => area.id === draggingId);
    const to = areas.findIndex((area) => area.id === targetId);
    if (from < 0 || to < 0) {
      setDraggingId(null);
      return;
    }
    const next = [...areas];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraggingId(null);
    void persistOrder(next);
  }

  async function saveEditor() {
    if (!editor) {
      return;
    }
    setPending(true);
    const result = editor.id
      ? await updateLifeAreaRow(editor.id, editor.form)
      : await createLifeAreaRow(editor.form);
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setEditor(null);
    await refresh();
  }

  async function archive(id: string) {
    setPending(true);
    const result = await archiveLifeAreaRow(id);
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    await refresh();
  }

  async function openDetail(id: string) {
    setDetailId(id);
    const result = await getLifeAreaDetail(id);
    setDetail(result);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setEditor({ form: emptyForm })}>
          {t('create')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? t('hideArchived') : t('showArchived')}
        </Button>
      </div>

      {areasQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : areasQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((area) => {
            return (
              <li
                key={area.id}
                draggable={!area.archivedAt}
                onDragStart={() => setDraggingId(area.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDrop(area.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3',
                  draggingId === area.id && 'opacity-60',
                  area.archivedAt && 'opacity-70',
                )}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className="flex size-8 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${area.color || '#1A3480'}22`,
                    color: area.color || '#1A3480',
                  }}
                >
                  <LifeAreaIcon id={area.icon} className="size-4" />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start"
                  onClick={() => void openDetail(area.id)}
                >
                  <p className="truncate font-medium">{area.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('counts', {
                      goals: area.activeGoalCount,
                      projects: area.activeProjectCount,
                    })}
                  </p>
                </button>
                {area.archivedAt ? (
                  <StatusPill label={t('archived')} tone="muted" />
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEditor({
                      id: area.id,
                      form: {
                        name: area.name,
                        icon: area.icon || 'sparkles',
                        color: area.color || LIFE_AREA_COLOR_OPTIONS[0],
                      },
                    })
                  }
                >
                  {t('edit')}
                </Button>
                {!area.archivedAt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => void archive(area.id)}
                  >
                    {t('archive')}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <SheetContent
          side={locale === 'ar' ? 'left' : 'right'}
          closeLabel={t('close')}
          className="w-full sm:max-w-md"
        >
          {editor ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {editor.id ? t('editTitle') : t('createTitle')}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="space-y-1.5">
                  <Label htmlFor="area-name">{t('name')}</Label>
                  <Input
                    id="area-name"
                    value={editor.form.name}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        form: { ...editor.form, name: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t('icon')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LIFE_AREA_ICON_OPTIONS.map((option) => {
                      const selected = editor.form.icon === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            'flex size-9 items-center justify-center rounded-lg border',
                            selected
                              ? 'border-ring bg-muted'
                              : 'border-border hover:bg-muted/60',
                          )}
                          onClick={() =>
                            setEditor({
                              ...editor,
                              form: { ...editor.form, icon: option.id },
                            })
                          }
                        >
                          <LifeAreaIcon id={option.id} className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t('color')}</p>
                  <div className="flex flex-wrap gap-2">
                    {LIFE_AREA_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          'size-7 rounded-full border-2',
                          editor.form.color === color
                            ? 'border-foreground'
                            : 'border-transparent',
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setEditor({
                            ...editor,
                            form: { ...editor.form, color },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
                <LifeAreaBadge
                  name={editor.form.name || t('preview')}
                  icon={editor.form.icon}
                  color={editor.form.color}
                />
              </div>
              <SheetFooter>
                <Button
                  type="button"
                  disabled={pending || !editor.form.name.trim()}
                  onClick={() => void saveEditor()}
                >
                  {t('save')}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetail(null);
          }
        }}
      >
        <SheetContent
          side={locale === 'ar' ? 'left' : 'right'}
          closeLabel={t('close')}
          className="w-full sm:max-w-md"
        >
          {detail?.area ? (
            <>
              <SheetHeader>
                <SheetTitle>{detail.area.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 overflow-y-auto px-4 pb-4">
                <p className="text-sm text-muted-foreground">
                  {t('counts', {
                    goals: detail.area.activeGoalCount,
                    projects: detail.area.activeProjectCount,
                  })}
                </p>
                <section>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t('linkedGoals')}
                  </h3>
                  {detail.goals && detail.goals.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {detail.goals.map((goal) => (
                        <li key={goal.id} className="rounded-lg border px-3 py-2">
                          {goal.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('noGoals')}</p>
                  )}
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t('linkedProjects')}
                  </h3>
                  {detail.projects && detail.projects.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {detail.projects.map((project) => (
                        <li
                          key={project.id}
                          className="rounded-lg border px-3 py-2"
                        >
                          {project.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('noProjects')}
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
