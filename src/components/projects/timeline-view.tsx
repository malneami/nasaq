'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { PROJECT_STATE_TONES, StatusPill } from '@/components/status-pill';
import { Link } from '@/lib/i18n/navigation';
import type { ProjectCardDto } from '@/lib/projects/actions';
import type { ProjectState } from '@/lib/db/schema';

const STATE_COLORS: Record<ProjectState, string> = {
  active: 'bg-emerald-500',
  maintain: 'bg-sky-500',
  waiting: 'bg-amber-500',
  incubator: 'bg-secondary',
  someday: 'bg-muted',
  completed: 'bg-emerald-700',
  stopped: 'bg-rose-500',
};

const STATE_BAR_COLORS: Record<ProjectState, string> = {
  active: 'bg-emerald-500/80',
  maintain: 'bg-sky-500/80',
  waiting: 'bg-amber-500/80',
  incubator: 'bg-secondary/80',
  someday: 'bg-muted/80',
  completed: 'bg-emerald-700/80',
  stopped: 'bg-rose-500/80',
};

export function TimelineView({ projects }: { projects: ProjectCardDto[] }) {
  const t = useTranslations('projects');

  const { rows, dateRange } = useMemo(() => {
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setMonth(now.getMonth() - 1);
    const defaultEnd = new Date(now);
    defaultEnd.setMonth(now.getMonth() + 3);

    const valid = projects.filter((p) => p.targetDate);
    if (valid.length === 0) {
      return { rows: [], dateRange: { start: defaultStart, end: defaultEnd } };
    }

    const dates = valid.map((p) => new Date(p.targetDate!));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Pad the range
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 1);

    return {
      rows: valid.sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? '')),
      dateRange: { start: minDate, end: maxDate },
    };
  }, [projects]);

  const totalMs = dateRange.end.getTime() - dateRange.start.getTime();

  function positionPercent(date: Date) {
    const ms = date.getTime() - dateRange.start.getTime();
    return Math.max(0, Math.min(100, (ms / totalMs) * 100));
  }

  const monthMarkers = useMemo(() => {
    const markers: { label: string; pct: number }[] = [];
    const d = new Date(dateRange.start);
    d.setDate(1);
    while (d <= dateRange.end) {
      markers.push({
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        pct: positionPercent(d),
      });
      d.setMonth(d.getMonth() + 1);
    }
    return markers;
  }, [dateRange, totalMs]);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t('timelineEmpty')}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {/* Month axis */}
      <div className="relative mb-2 h-6 border-b border-border">
        {monthMarkers.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 text-[10px] text-muted-foreground"
            style={{ left: `${m.pct}%` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Project bars */}
      <div className="space-y-2">
        {rows.map((project) => {
          const targetDate = new Date(project.targetDate!);
          // Estimate start: 30 days before target, or from progress
          const estimatedStart = new Date(targetDate);
          const daysBack = Math.max(7, Math.round((100 - project.progress) * 0.3));
          estimatedStart.setDate(targetDate.getDate() - daysBack);

          const startPct = positionPercent(estimatedStart);
          const endPct = positionPercent(targetDate);
          const widthPct = Math.max(3, endPct - startPct);

          return (
            <div key={project.id} className="group relative flex items-center gap-2">
              <div className="w-28 shrink-0 truncate text-xs font-medium">
                {project.name}
              </div>
              <div className="relative flex-1">
                <Link
                  href={`/projects/${project.id}`}
                  className="block"
                  style={{
                    marginLeft: `${startPct}%`,
                    width: `${widthPct}%`,
                  }}
                >
                  <div
                    className={`relative h-7 rounded-md ${STATE_BAR_COLORS[project.state]} overflow-hidden`}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{
                        width: `${project.progress}%`,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                      }}
                    />
                    {/* Milestone diamond */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border border-white/50 bg-white/60"
                      style={{ left: '100%' }}
                      title={project.currentMilestoneTitle ?? ''}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white">
                      {project.progress}%
                    </span>
                  </div>
                </Link>
              </div>
              <div className="flex shrink-0 gap-1">
                <StatusPill
                  label={t(`states.${project.state}`)}
                  tone={PROJECT_STATE_TONES[project.state]}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
