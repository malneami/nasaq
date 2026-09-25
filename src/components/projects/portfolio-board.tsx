'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LifeAreaBadge } from '@/components/life-areas';
import { ConfirmDialog } from '@/components/projects/confirm-dialog';
import {
  PROJECT_STATE_TONES,
  RISK_LEVEL_TONES,
  StatusPill,
} from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listLifeAreaRows } from '@/lib/life-areas/actions';
import {
  changeProjectState,
  createProjectRow,
  getPortfolioMeta,
  listProjectCards,
  type ProjectCardDto,
} from '@/lib/projects/actions';
import { BOARD_STATES, COLLAPSED_STATES } from '@/lib/projects/stages';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ProjectState, RiskLevel } from '@/lib/db/schema';

const PROJECTS_KEY = ['project-cards'] as const;
const META_KEY = ['project-meta'] as const;
const AREAS_KEY = ['life-areas'] as const;

export function PortfolioBoard() {
  const t = useTranslations('projects');
  const queryClient = useQueryClient();
  const [lifeAreaFilter, setLifeAreaFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [nextActionFilter, setNextActionFilter] = useState<'all' | 'has' | 'needs'>(
    'all',
  );
  const [sort, setSort] = useState<'score' | 'updated' | 'target'>('updated');
  const [collapsedOpen, setCollapsedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    projectId: string;
    state: ProjectState;
    activeCount: number;
    activeLimit: number;
  } | null>(null);

  const cardsQuery = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const result = await listProjectCards();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.projects ?? [];
    },
  });
  const metaQuery = useQuery({
    queryKey: META_KEY,
    queryFn: async () => {
      const result = await getPortfolioMeta();
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
  });
  const areasQuery = useQuery({
    queryKey: AREAS_KEY,
    queryFn: async () => {
      const result = await listLifeAreaRows(true);
      return result.areas ?? [];
    },
  });

  const filtered = useMemo(() => {
    const rows = (cardsQuery.data ?? []).filter((card) => {
      if (
        lifeAreaFilter !== 'all' &&
        !card.lifeAreaIds.includes(lifeAreaFilter)
      ) {
        return false;
      }
      if (stageFilter !== 'all' && card.stage !== stageFilter) {
        return false;
      }
      if (riskFilter !== 'all' && card.riskLevel !== riskFilter) {
        return false;
      }
      if (nextActionFilter === 'has' && !card.nextAction) {
        return false;
      }
      if (nextActionFilter === 'needs' && card.nextAction) {
        return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === 'score') {
        return (b.score ?? -1) - (a.score ?? -1);
      }
      if (sort === 'target') {
        return (a.targetDate ?? '9999-12-31').localeCompare(
          b.targetDate ?? '9999-12-31',
        );
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [cardsQuery.data, lifeAreaFilter, stageFilter, riskFilter, nextActionFilter, sort]);

  const areas = areasQuery.data ?? [];
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const activeCount = metaQuery.data?.activeCount ?? 0;
  const activeLimit = metaQuery.data?.activeLimit ?? 3;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
      queryClient.invalidateQueries({ queryKey: META_KEY }),
    ]);
  }

  async function applyState(
    projectId: string,
    state: ProjectState,
    confirmOverLimit = false,
  ) {
    setPending(true);
    const result = await changeProjectState({
      projectId,
      state,
      confirmOverLimit,
    });
    setPending(false);
    if (result.needsConfirm) {
      setConfirm({
        projectId,
        state,
        activeCount: result.activeCount ?? activeCount,
        activeLimit: result.activeLimit ?? activeLimit,
      });
      return;
    }
    if (result.error === 'desiredOutcomeRequired') {
      toast.error(t('desiredOutcomeRequired'));
      return;
    }
    if (result.error === 'nextActionRequired') {
      toast.error(t('nextActionRequired'));
      return;
    }
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setConfirm(null);
    await refresh();
  }

  async function onCreate() {
    if (!newName.trim()) {
      return;
    }
    setPending(true);
    const result = await createProjectRow({ name: newName.trim() });
    setPending(false);
    if (result.error || !result.projectId) {
      toast.error(t('saveFailed'));
      return;
    }
    setNewName('');
    setCreating(false);
    await refresh();
  }

  const capacityTone =
    activeCount > activeLimit
      ? 'text-rose-700 dark:text-rose-300'
      : activeCount === activeLimit
        ? 'text-amber-800 dark:text-amber-200'
        : 'text-foreground';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-sm font-medium', capacityTone)}>
          {t('capacity', { count: activeCount, limit: activeLimit })}
        </p>
        <Button type="button" size="sm" onClick={() => setCreating((v) => !v)}>
          {t('create')}
        </Button>
      </div>

      {creating ? (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t('namePlaceholder')}
          />
          <Button type="button" disabled={pending} onClick={() => void onCreate()}>
            {t('save')}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
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
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
        >
          <option value="all">{t('allStages')}</option>
          {(metaQuery.data?.stages ?? []).map((stage) => (
            <option key={stage} value={stage}>
              {t(`stages.${stage}`)}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={riskFilter}
          onChange={(event) => setRiskFilter(event.target.value)}
        >
          <option value="all">{t('allRisk')}</option>
          {(['low', 'medium', 'high'] as RiskLevel[]).map((risk) => (
            <option key={risk} value={risk}>
              {t(`risk.${risk}`)}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={nextActionFilter}
          onChange={(event) =>
            setNextActionFilter(event.target.value as 'all' | 'has' | 'needs')
          }
        >
          <option value="all">{t('nextActionAny')}</option>
          <option value="has">{t('nextActionHas')}</option>
          <option value="needs">{t('nextActionNeeds')}</option>
        </select>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as 'score' | 'updated' | 'target')
          }
        >
          <option value="updated">{t('sortUpdated')}</option>
          <option value="score">{t('sortScore')}</option>
          <option value="target">{t('sortTarget')}</option>
        </select>
      </div>

      {cardsQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_STATES.map((state) => (
            <section
              key={state}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingId) {
                  void applyState(draggingId, state);
                  setDraggingId(null);
                }
              }}
              className="min-h-40 rounded-xl border border-border bg-muted/20 p-2"
            >
              <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t(`states.${state}`)}
              </h3>
              <ul className="space-y-2">
                {filtered
                  .filter((card) => card.state === state)
                  .map((card) => (
                    <PortfolioCard
                      key={card.id}
                      card={card}
                      areaById={areaById}
                      onDragStart={() => setDraggingId(card.id)}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-sm"
          onClick={() => setCollapsedOpen((value) => !value)}
        >
          <span>{t('collapsedTitle')}</span>
          <span className="text-muted-foreground">
            {collapsedOpen ? t('hide') : t('show')}
          </span>
        </button>
        {collapsedOpen ? (
          <div className="grid gap-3 border-t p-3 md:grid-cols-3">
            {COLLAPSED_STATES.map((state) => (
              <div
                key={state}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingId) {
                    void applyState(draggingId, state);
                    setDraggingId(null);
                  }
                }}
              >
                <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t(`states.${state}`)}
                </h3>
                <ul className="space-y-2">
                  {filtered
                    .filter((card) => card.state === state)
                    .map((card) => (
                      <PortfolioCard
                        key={card.id}
                        card={card}
                        areaById={areaById}
                        onDragStart={() => setDraggingId(card.id)}
                      />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={t('overLimitTitle')}
        body={t('overLimitBody', {
          limit: confirm?.activeLimit ?? activeLimit,
        })}
        confirmLabel={t('continue')}
        cancelLabel={t('cancel')}
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            void applyState(confirm.projectId, confirm.state, true);
          }
        }}
      />
    </div>
  );
}

function PortfolioCard({
  card,
  areaById,
  onDragStart,
}: {
  card: ProjectCardDto;
  areaById: Map<
    string,
    { id: string; name: string; color: string | null; icon: string | null; archivedAt: string | null }
  >;
  onDragStart: () => void;
}) {
  const t = useTranslations('projects');

  return (
    <li
      draggable
      onDragStart={onDragStart}
      className="rounded-lg border border-border bg-card p-3"
    >
      <Link href={`/projects/${card.id}`} className="block text-start">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{card.name}</p>
          {card.score !== null ? (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
              {card.score}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {card.lifeAreaIds.map((id) => {
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
        <div className="mt-2 flex flex-wrap gap-1">
          <StatusPill
            label={t(`stages.${card.stage}`)}
            tone={PROJECT_STATE_TONES[card.state]}
          />
          <StatusPill
            label={t(`risk.${card.riskLevel}`)}
            tone={RISK_LEVEL_TONES[card.riskLevel]}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('progressPct', { value: card.progress })}
          {card.currentMilestoneTitle
            ? ` · ${card.currentMilestoneTitle}`
            : ''}
        </p>
        {card.nextAction ? (
          <p className="mt-1 truncate text-xs">{card.nextAction}</p>
        ) : (
          <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">
            {t('noNextAction')}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('daysAgo', { count: card.daysSinceUpdated })}
        </p>
      </Link>
    </li>
  );
}
