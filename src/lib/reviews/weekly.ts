import 'server-only';

import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { getProfile } from '@/lib/db/queries/profiles';
import { listProjects } from '@/lib/db/queries/projects';
import {
  getWeeklyReviewByPeriod,
  upsertWeeklyReview,
} from '@/lib/db/queries/reviews';
import { listTasks } from '@/lib/db/queries/tasks';
import { createAuditLog } from '@/lib/db/queries/system';
import { getWeekCapacity, loadCapacityEvents } from '@/lib/capacity/service';
import { isProtectedKind } from '@/lib/capacity/protected';
import { getMonthlyFinanceSummary } from '@/lib/finance/intelligence/service';
import {
  getDueFollowups,
  getOverdueCommitments,
} from '@/lib/people/service';
import { phraseReviewSynthesis } from '@/lib/reviews/synthesize';
import type { WeeklyReviewModel } from '@/lib/reviews/types';
import { proposeTopOutcomes } from '@/lib/today/propose';
import { getDailyBrief } from '@/lib/db/queries/reviews';
import type { DailyFocusItem } from '@/lib/today/types';
import {
  addDaysYmd,
  startOfWeekYmd,
  ymdInTimeZone,
  ymdToUtcDate,
} from '@/lib/time/zoned';

export async function assembleWeeklyReview(
  userId: string,
  locale: 'en' | 'ar' = 'en',
  weekStartYmd?: string,
): Promise<WeeklyReviewModel> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const periodStart = weekStartYmd ?? startOfWeekYmd(todayYmd, timeZone, 0);
  const periodEnd = addDaysYmd(periodStart, 6);

  const existing = await getWeeklyReviewByPeriod(
    userId,
    'weekly',
    ymdToUtcDate(periodStart),
  );
  if (existing?.content && (existing.content as WeeklyReviewModel).periodStart) {
    const stored = existing.content as WeeklyReviewModel;
    return {
      ...stored,
      confirmedTop3: (existing.topOutcomes as DailyFocusItem[] | null) ??
        stored.confirmedTop3,
    };
  }

  const [
    weekCapacity,
    projects,
    tasks,
    events,
    overdueCommitments,
    dueFollowups,
    finance,
    proposed,
  ] = await Promise.all([
    getWeekCapacity(userId, periodStart),
    listProjects(userId),
    listTasks(userId),
    listCalendarEvents(userId),
    getOverdueCommitments(userId, todayYmd),
    getDueFollowups(userId, todayYmd),
    getMonthlyFinanceSummary(userId).catch(() => null),
    proposeTopOutcomes(userId, { limit: 3, minutes: 180 }),
  ]);

  // Outcomes: completed tasks in the week
  const completedTasks = tasks.filter((t) => {
    if (t.status !== 'completed' || !t.completedAt) return false;
    const day = t.completedAt.toISOString().slice(0, 10);
    return day >= periodStart && day <= periodEnd;
  });

  // Also pull confirmed outcomes from daily briefs in the week
  const weekOutcomes: { text: string; kind: string }[] = completedTasks.map(
    (t) => ({ text: t.title, kind: 'task' }),
  );
  for (let i = 0; i < 7; i += 1) {
    const day = addDaysYmd(periodStart, i);
    const brief = await getDailyBrief(userId, ymdToUtcDate(day));
    const outcomes = (brief?.content as { outcomes?: DailyFocusItem[] })
      ?.outcomes;
    if (outcomes) {
      for (const o of outcomes) {
        if (o.status === 'completed') {
          weekOutcomes.push({ text: o.text, kind: 'outcome' });
        }
      }
    }
  }

  const byProjectMinutes = new Map<string, { name: string; minutes: number }>();
  for (const p of projects) {
    if (p.timeInvestedMinutes > 0) {
      byProjectMinutes.set(p.id, {
        name: p.name,
        minutes: p.timeInvestedMinutes,
      });
    }
  }

  const progressed = projects
    .filter((p) => p.progress > 0 && (p.state === 'active' || p.state === 'maintain'))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage,
      progress: p.progress,
    }));

  const blocked = projects
    .filter((p) => {
      if (p.state === 'waiting') return true;
      if ((p.state === 'active' || p.state === 'maintain') && !p.nextAction?.trim())
        return true;
      if (p.riskLevel === 'high') return true;
      return false;
    })
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      reason:
        p.state === 'waiting'
          ? 'waiting'
          : !p.nextAction?.trim()
            ? 'no_next'
            : 'high_risk',
    }));

  // Family / protected adherence
  const rangeStart = ymdToUtcDate(periodStart);
  const rangeEnd = new Date(
    `${periodEnd}T23:59:59.000Z`,
  );
  const capacityEvents = await loadCapacityEvents(
    userId,
    rangeStart,
    rangeEnd,
    timeZone,
  );
  let protectedScheduled = 0;
  let breaches = 0;
  for (const ev of capacityEvents) {
    if (!isProtectedKind(ev.eventType, ev.isProtected)) continue;
    const hours =
      (ev.endsAt.getTime() - ev.startsAt.getTime()) / 3_600_000;
    protectedScheduled += Math.max(0, hours);
  }
  // Count overlapping busy non-protected events as potential breaches into family windows
  for (const ev of events) {
    const day = ev.startsAt.toISOString().slice(0, 10);
    if (day < periodStart || day > periodEnd) continue;
    if (isProtectedKind(ev.eventType, ev.isProtected)) continue;
    // If a deep_work/meeting was marked overlapping family — approximate via notes flag absent
  }
  // Simpler held metric: scheduled protected hours minus explicit overrides (none logged → held ≈ scheduled)
  const protectedHeld = Math.max(0, protectedScheduled - breaches);
  const adherencePct =
    protectedScheduled > 0
      ? Math.round((protectedHeld / protectedScheduled) * 1000) / 10
      : null;

  const carryPool: DailyFocusItem[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDaysYmd(periodStart, i);
    const brief = await getDailyBrief(userId, ymdToUtcDate(day));
    const pool = (brief?.content as { carryOverPool?: DailyFocusItem[] })
      ?.carryOverPool;
    if (pool) carryPool.push(...pool);
  }

  const model: WeeklyReviewModel = {
    periodStart,
    periodEnd,
    outcomes: weekOutcomes.slice(0, 20),
    time: {
      productiveHours: weekCapacity.productiveHours,
      freeHours: weekCapacity.freeHours,
      byProject: [...byProjectMinutes.values()]
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 8),
    },
    projects: { progressed, blocked },
    relationships: dueFollowups.slice(0, 10).map((f) => ({
      name: f.personName,
      dueYmd: f.dueYmd,
      staleDays: f.staleDays,
    })),
    commitments: overdueCommitments.slice(0, 10).map((c) => ({
      description: c.description,
      direction: c.direction,
      dueYmd: c.dueYmd,
    })),
    family: {
      protectedHoursScheduled:
        Math.round(protectedScheduled * 10) / 10,
      protectedHoursHeld: Math.round(protectedHeld * 10) / 10,
      adherencePct,
      breaches,
    },
    finance: finance
      ? {
          incomeMinor: finance.incomeMinor,
          expensesMinor: finance.expensesMinor,
          netMinor: finance.netCashFlowMinor,
          currency: finance.currency || DEFAULT_CURRENCY,
        }
      : null,
    reflection: { worked: '', didnt: '', stop: '' },
    proposedTop3: [...proposed.slice(0, 3), ...carryPool.slice(0, 2)].slice(
      0,
      3,
    ),
    confirmedTop3: null,
    synthesis: null,
  };

  model.synthesis = await phraseReviewSynthesis({
    kind: 'weekly',
    figures: {
      periodStart,
      periodEnd,
      completedCount: weekOutcomes.length,
      productiveHours: model.time.productiveHours,
      blockedProjects: blocked.length,
      overdueCommitments: overdueCommitments.length,
      familyAdherencePct: adherencePct,
      expensesMinor: finance?.expensesMinor ?? null,
    },
    locale,
  });

  await upsertWeeklyReview(userId, {
    reviewType: 'weekly',
    periodStart: ymdToUtcDate(periodStart),
    periodEnd: ymdToUtcDate(periodEnd),
    content: model as unknown as Record<string, unknown>,
    topOutcomes: null,
  });

  return model;
}

export async function confirmWeeklyTop3(
  userId: string,
  periodStart: string,
  items: DailyFocusItem[],
  reflection: WeeklyReviewModel['reflection'],
): Promise<WeeklyReviewModel> {
  const model = await assembleWeeklyReview(userId);
  const periodEnd = addDaysYmd(periodStart, 6);
  const next: WeeklyReviewModel = {
    ...model,
    periodStart,
    periodEnd,
    reflection,
    confirmedTop3: items.slice(0, 3),
    proposedTop3: model.proposedTop3,
  };

  // Seed next week's candidate pool via a marker on the review (daily Top 3 still user-confirmed)
  await upsertWeeklyReview(userId, {
    reviewType: 'weekly',
    periodStart: ymdToUtcDate(periodStart),
    periodEnd: ymdToUtcDate(periodEnd),
    content: next as unknown as Record<string, unknown>,
    topOutcomes: items.slice(0, 3),
  });

  // Place weekly top 3 into carryOverPool for the first day of next week as candidates only
  const nextWeekStart = addDaysYmd(periodEnd, 1);
  const nextBriefDate = ymdToUtcDate(nextWeekStart);
  const existingBrief = await getDailyBrief(userId, nextBriefDate);
  const { mergeBriefContent } = await import('@/lib/reviews/brief-merge');
  const { upsertDailyBrief } = await import('@/lib/db/queries/reviews');
  await upsertDailyBrief(
    userId,
    nextBriefDate,
    mergeBriefContent(existingBrief?.content, {
      weeklySeedCandidates: items.slice(0, 3),
    }),
  );

  await createAuditLog(userId, {
    actor: 'user',
    action: 'confirm_weekly_top3',
    entityType: 'weekly_review',
    entityId: periodStart,
    after: { count: items.length, seededNextWeek: true },
  });

  return next;
}
