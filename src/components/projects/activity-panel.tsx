'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { listProjectActivity } from '@/lib/projects/actions';
import { cn } from '@/lib/utils';

const ACTOR_BADGE: Record<string, string> = {
  user: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
  ai: 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
  system: 'bg-muted text-muted-foreground',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'created',
  update: 'updated',
  state_change: 'changed state',
  stage_change: 'moved stage',
  score: 'scored',
  milestone_create: 'added milestone',
  delete: 'archived',
  subtask_create: 'added subtask',
  subtask_toggle: 'toggled subtask',
  note_create: 'added note',
};

function formatChange(action: string, after: Record<string, unknown> | null): string {
  if (!after) {
    return '';
  }
  switch (action) {
    case 'state_change': {
      const from = after.from as string;
      const to = after.to as string;
      return `${from} → ${to}`;
    }
    case 'stage_change': {
      const from = after.from as string;
      const to = after.to as string;
      return `${from} → ${to}`;
    }
    case 'update': {
      const section = after.section as string;
      return section ? `${section}` : '';
    }
    case 'score': {
      const score = after.computedScore as number;
      return score !== undefined ? `score: ${score}` : '';
    }
    case 'milestone_create':
    case 'subtask_create':
    case 'note_create': {
      const title = after.title as string;
      return title ?? '';
    }
    case 'subtask_toggle': {
      const from = after.from as string;
      const to = after.to as string;
      return `${from} → ${to}`;
    }
    default:
      return '';
  }
}

function groupByDay(entries: { id: string; actor: string; action: string; after: Record<string, unknown> | null; createdAt: string }[]) {
  const groups: { date: string; items: typeof entries }[] = [];
  for (const entry of entries) {
    const day = entry.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === day) {
      last.items.push(entry);
    } else {
      groups.push({ date: day, items: [entry] });
    }
  }
  return groups;
}

export function ActivityPanel({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');

  const activityQuery = useQuery({
    queryKey: ['project-activity', projectId] as const,
    queryFn: async () => {
      const result = await listProjectActivity(projectId);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.activity ?? [];
    },
  });

  const groups = useMemo(
    () => groupByDay(activityQuery.data ?? []),
    [activityQuery.data],
  );

  if (activityQuery.isError) {
    return <p className="text-sm text-destructive">{t('loadFailed')}</p>;
  }
  if (!activityQuery.data) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noActivity')}</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {new Date(group.date).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <div className="space-y-1">
            {group.items.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase',
                    ACTOR_BADGE[entry.actor] ?? ACTOR_BADGE.system,
                  )}
                >
                  {entry.actor}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    {(() => {
                      const change = formatChange(entry.action, entry.after);
                      return change ? (
                        <span className="text-muted-foreground"> · {change}</span>
                      ) : null;
                    })()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
