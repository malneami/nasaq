import 'server-only';

import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { listLifeAreas } from '@/lib/db/queries/life-areas';
import { listGoals } from '@/lib/db/queries/goals';
import { listProjects } from '@/lib/db/queries/projects';
import { getProfile } from '@/lib/db/queries/profiles';
import {
  getWeeklyReviewByPeriod,
  listWeeklyReviews,
  upsertWeeklyReview,
} from '@/lib/db/queries/reviews';
import { createAuditLog } from '@/lib/db/queries/system';
import { loadCapacityEvents } from '@/lib/capacity/service';
import { isProtectedKind } from '@/lib/capacity/protected';
import {
  getHealthScore,
  getMonthlyFinanceSummary,
  getVentureFinance,
} from '@/lib/finance/intelligence/service';
import {
  getDueFollowups,
  getOverdueCommitments,
} from '@/lib/people/service';
import {
  DIMENSION_BY_SORT_ORDER,
  IMBALANCE_LOW_THRESHOLD,
  IMBALANCE_STREAK_WEEKS,
} from '@/lib/reviews/constants';
import { computeNorthStar } from '@/lib/reviews/north-star';
import { phraseReviewSynthesis } from '@/lib/reviews/synthesize';
import type {
  DimensionCode,
  DimensionIndicator,
  ImbalanceCallout,
  MonthlyReviewModel,
  WeeklyReviewModel,
} from '@/lib/reviews/types';
import {
  addDaysYmd,
  startOfWeekYmd,
  ymdInTimeZone,
  ymdToUtcDate,
} from '@/lib/time/zoned';

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function matchDimension(
  name: string,
  sortOrder: number,
): DimensionCode | null {
  const byOrder = DIMENSION_BY_SORT_ORDER[sortOrder];
  if (byOrder) return byOrder.code;
  for (const entry of Object.values(DIMENSION_BY_SORT_ORDER)) {
    if (entry.nameIncludes.some((s) => name.includes(s))) {
      return entry.code;
    }
  }
  return null;
}

export async function assembleMonthlyReview(
  userId: string,
  locale: 'en' | 'ar' = 'en',
  monthYmd?: string,
): Promise<MonthlyReviewModel> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const periodStart = monthYmd
    ? `${monthYmd.slice(0, 7)}-01`
    : `${todayYmd.slice(0, 7)}-01`;
  const y = Number(periodStart.slice(0, 4));
  const m = Number(periodStart.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const periodEnd = `${periodStart.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;

  const existing = await getWeeklyReviewByPeriod(
    userId,
    'monthly',
    ymdToUtcDate(periodStart),
  );
  if (existing?.content && (existing.content as MonthlyReviewModel).periodStart) {
    return existing.content as MonthlyReviewModel;
  }

  const [
    areas,
    goals,
    projects,
    finance,
    health,
    ventures,
    overdue,
    followups,
    weekReviews,
  ] = await Promise.all([
    listLifeAreas(userId),
    listGoals(userId),
    listProjects(userId),
    getMonthlyFinanceSummary(userId, periodStart),
    getHealthScore(userId),
    getVentureFinance(userId),
    getOverdueCommitments(userId, todayYmd),
    getDueFollowups(userId, todayYmd),
    listWeeklyReviews(userId, 'weekly'),
  ]);

  // Family protected adherence this month (approx via weeks overlapping month)
  const weekStart = startOfWeekYmd(periodStart, timeZone, 0);
  let familyAdherenceSum = 0;
  let familyWeeks = 0;
  for (let i = 0; i < 5; i += 1) {
    const ws = addDaysYmd(weekStart, i * 7);
    if (ws > periodEnd) break;
    const we = addDaysYmd(ws, 6);
    const events = await loadCapacityEvents(
      userId,
      ymdToUtcDate(ws),
      new Date(`${we}T23:59:59.000Z`),
      timeZone,
    );
    let scheduled = 0;
    for (const ev of events) {
      if (!isProtectedKind(ev.eventType, ev.isProtected)) continue;
      scheduled +=
        (ev.endsAt.getTime() - ev.startsAt.getTime()) / 3_600_000;
    }
    if (scheduled > 0) {
      familyAdherenceSum += 1; // no breach log → held
      familyWeeks += 1;
    } else {
      familyWeeks += 1;
      familyAdherenceSum += 0.5; // no protected time scheduled is soft-neutral
    }
  }
  const familyScore =
    familyWeeks > 0 ? familyAdherenceSum / familyWeeks : 0.5;

  const activeProjects = projects.filter(
    (p) => p.state === 'active' || p.state === 'maintain',
  );
  const careerProgress =
    activeProjects.length > 0
      ? activeProjects.reduce((s, p) => s + p.progress, 0) /
        (activeProjects.length * 100)
      : 0.4;

  const ventureNets = ventures.map((v) => v.netMinor);
  const ventureScore =
    ventureNets.length === 0
      ? 0.5
      : clamp01(
          0.5 +
            ventureNets.reduce((s, n) => s + Math.sign(n), 0) /
              (ventureNets.length * 2),
        );

  const healthGoals = goals.filter((g) => {
    // soft match via title
    return /health|صحة|fitness|sleep/i.test(g.title);
  });
  const healthScore01 =
    healthGoals.length > 0
      ? healthGoals.reduce((s, g) => s + g.progress, 0) /
        (healthGoals.length * 100)
      : 0.5;

  const financeScore01 = clamp01((health.score ?? 50) / 100);
  const savingsBoost =
    finance.savingsRatePct != null
      ? clamp01(finance.savingsRatePct / 20)
      : 0.4;

  const followUpLoad = followups.length + overdue.length;
  const relationshipScore = clamp01(1 - followUpLoad / 12);

  const devGoals = goals.filter((g) =>
    /learn|course|develop|تطوير|تعلّم/i.test(g.title),
  );
  const developmentScore =
    devGoals.length > 0
      ? devGoals.reduce((s, g) => s + g.progress, 0) / (devGoals.length * 100)
      : 0.45;

  const dimensions: DimensionIndicator[] = [
    {
      code: 'career',
      labelKey: 'career',
      score01: Math.round(clamp01(careerProgress) * 100) / 100,
      detail: `${activeProjects.length} active projects · avg progress ${Math.round(careerProgress * 100)}%`,
      derivation:
        'Average progress of active/maintain projects (0–100 → 0–1).',
    },
    {
      code: 'ventures',
      labelKey: 'ventures',
      score01: Math.round(ventureScore * 100) / 100,
      detail: `${ventures.length} ventures tracked`,
      derivation:
        'Sign of venture net (revenue − invested) across portfolio.',
    },
    {
      code: 'family',
      labelKey: 'family',
      score01: Math.round(familyScore * 100) / 100,
      detail: `Protected-time adherence ≈ ${Math.round(familyScore * 100)}%`,
      derivation:
        'Share of weeks with protected/family blocks maintained (no breach log).',
    },
    {
      code: 'health',
      labelKey: 'health',
      score01: Math.round(clamp01(healthScore01) * 100) / 100,
      detail:
        healthGoals.length > 0
          ? `Health-related goals avg ${Math.round(healthScore01 * 100)}%`
          : 'No health goals linked — neutral',
      derivation: 'Average progress of health-titled goals, else neutral 0.5.',
    },
    {
      code: 'finance',
      labelKey: 'finance',
      score01:
        Math.round(
          clamp01(financeScore01 * 0.7 + savingsBoost * 0.3) * 100,
        ) / 100,
      detail: `Health score ${health.score} · savings ${finance.savingsRatePct ?? '—'}%`,
      derivation:
        '0.7 × Financial Health Score/100 + 0.3 × savings-rate vs 20% target.',
    },
    {
      code: 'development',
      labelKey: 'development',
      score01: Math.round(clamp01(developmentScore) * 100) / 100,
      detail:
        devGoals.length > 0
          ? `${devGoals.length} development goals`
          : 'No development goals — soft neutral',
      derivation: 'Average progress of learning/development goals.',
    },
    {
      code: 'relationships',
      labelKey: 'relationships',
      score01: Math.round(relationshipScore * 100) / 100,
      detail: `${followups.length} follow-ups due · ${overdue.length} overdue commitments`,
      derivation:
        '1 − (due follow-ups + overdue commitments) / 12, clamped 0–1.',
    },
  ];

  // Map life areas for label enrichment (optional)
  void areas;

  // Imbalance: look at prior weekly family/finance proxies in stored weekly reviews
  const imbalance: ImbalanceCallout[] = [];
  const recentWeeks = weekReviews
    .filter((r) => {
      const start = r.periodStart.toISOString().slice(0, 10);
      return start >= addDaysYmd(periodStart, -28) && start <= periodEnd;
    })
    .slice(0, 6);

  for (const dim of dimensions) {
    if (dim.score01 >= IMBALANCE_LOW_THRESHOLD) continue;
    // Count consecutive low weeks from family adherence in weekly content when available
    let streak = 1;
    for (const wr of recentWeeks) {
      const content = wr.content as WeeklyReviewModel;
      if (dim.code === 'family' && content.family?.adherencePct != null) {
        if (content.family.adherencePct / 100 < IMBALANCE_LOW_THRESHOLD) {
          streak += 1;
        } else break;
      } else if (dim.code === 'finance' && content.finance) {
        if (content.finance.netMinor < 0) streak += 1;
        else break;
      } else if (dim.code === 'relationships') {
        if ((content.commitments?.length ?? 0) > 3) streak += 1;
        else break;
      }
    }
    if (streak >= IMBALANCE_STREAK_WEEKS || dim.score01 < 0.35) {
      imbalance.push({
        code: dim.code,
        weeksLow: Math.max(streak, IMBALANCE_STREAK_WEEKS),
        message:
          locale === 'ar'
            ? `${dim.code} منخفض لعدة أسابيع — راقب التوازن دون مطاردة كل الدرجات.`
            : `${dim.labelKey} has been soft for ~${Math.max(streak, IMBALANCE_STREAK_WEEKS)} weeks — notice the imbalance; do not chase every score.`,
      });
    }
  }

  const northStar = await computeNorthStar(userId, {
    periodStart,
    periodEnd,
    timeZone,
  });

  const model: MonthlyReviewModel = {
    periodStart,
    periodEnd,
    dimensions,
    imbalance,
    northStar,
    synthesis: null,
  };

  model.synthesis = await phraseReviewSynthesis({
    kind: 'monthly',
    figures: {
      dimensions: dimensions.map((d) => ({
        code: d.code,
        score01: d.score01,
      })),
      imbalance: imbalance.map((i) => i.code),
      northStarPct: northStar.percent,
    },
    locale,
  });

  await upsertWeeklyReview(userId, {
    reviewType: 'monthly',
    periodStart: ymdToUtcDate(periodStart),
    periodEnd: ymdToUtcDate(periodEnd),
    content: model as unknown as Record<string, unknown>,
  });

  await createAuditLog(userId, {
    actor: 'ai',
    action: 'monthly_review',
    entityType: 'weekly_review',
    entityId: periodStart,
    after: {
      imbalanceCount: imbalance.length,
      northStarPct: northStar.percent,
    },
  });

  return model;
}

export { matchDimension };
