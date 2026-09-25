import 'server-only';

import { listWeeklyReviews } from '@/lib/db/queries/reviews';
import { getOverdueCommitments } from '@/lib/people/service';
import { getHealthScore } from '@/lib/finance/intelligence/service';
import { getWeekCapacity } from '@/lib/capacity/service';
import type { NorthStarModel, WeeklyReviewModel } from '@/lib/reviews/types';
import { addDaysYmd, ymdInTimeZone } from '@/lib/time/zoned';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { getProfile } from '@/lib/db/queries/profiles';

/**
 * North Star (§51): % of weeks where highest-priority outcomes progressed
 * AND protected life commitments remained maintained.
 * Never surfaces "tasks completed" as the headline.
 */
export async function computeNorthStar(
  userId: string,
  range?: { periodStart: string; periodEnd: string; timeZone?: string },
): Promise<NorthStarModel> {
  const profile = await getProfile(userId);
  const timeZone = range?.timeZone || profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);

  const weeks = await listWeeklyReviews(userId, 'weekly');
  const inRange = weeks.filter((w) => {
    const start = w.periodStart.toISOString().slice(0, 10);
    if (!range) {
      // last 8 weeks
      return start >= addDaysYmd(todayYmd, -56);
    }
    return start >= range.periodStart && start <= range.periodEnd;
  });

  let passing = 0;
  let strategicProgressSum = 0;
  let strategicProgressN = 0;
  let protectedSum = 0;
  let protectedN = 0;
  let capacityUsedSum = 0;
  let capacityN = 0;

  for (const week of inRange) {
    const content = week.content as WeeklyReviewModel;
    const top = (week.topOutcomes as { text?: string }[] | null) ??
      content.confirmedTop3;
    const outcomesCount = content.outcomes?.length ?? 0;
    // Progressed: majority of weekly Top 3 present as completed outcomes OR any progressed projects
    const topCount = top?.length ?? 0;
    const progressedOk =
      topCount === 0
        ? outcomesCount > 0 || (content.projects?.progressed?.length ?? 0) > 0
        : outcomesCount >= Math.ceil(topCount / 2) ||
          (content.projects?.progressed?.length ?? 0) > 0;

    const familyAdherence = content.family?.adherencePct;
    const protectedOk =
      familyAdherence == null ? true : familyAdherence >= 70;

    if (progressedOk && protectedOk) {
      passing += 1;
    }

    if ((content.projects?.progressed?.length ?? 0) > 0) {
      strategicProgressSum += content.projects.progressed.length;
      strategicProgressN += 1;
    }
    if (familyAdherence != null) {
      protectedSum += familyAdherence;
      protectedN += 1;
    }
    if (content.time) {
      const avail = content.time.productiveHours + content.time.freeHours;
      if (avail > 0) {
        capacityUsedSum +=
          content.time.productiveHours / Math.max(avail, 0.1);
        capacityN += 1;
      }
    }
  }

  const counted = inRange.length;
  const percent =
    counted > 0 ? Math.round((passing / counted) * 1000) / 10 : null;

  const [overdue, health, latestCapacity] = await Promise.all([
    getOverdueCommitments(userId, todayYmd),
    getHealthScore(userId).catch(() => null),
    getWeekCapacity(
      userId,
      inRange[0]
        ? inRange[0].periodStart.toISOString().slice(0, 10)
        : todayYmd,
    ).catch(() => null),
  ]);

  return {
    percent,
    weeksCounted: counted,
    weeksPassing: passing,
    supporting: {
      strategicProgress:
        strategicProgressN > 0
          ? Math.round((strategicProgressSum / strategicProgressN) * 10) / 10
          : null,
      overdueCommitments: overdue.length,
      protectedAdherencePct:
        protectedN > 0
          ? Math.round((protectedSum / protectedN) * 10) / 10
          : null,
      financialHealth: health?.score ?? null,
      weeklyReviewsCompleted: counted,
      capacityUsedPct:
        capacityN > 0
          ? Math.round((capacityUsedSum / capacityN) * 1000) / 10
          : latestCapacity
            ? Math.round(
                (latestCapacity.productiveHours /
                  Math.max(
                    latestCapacity.productiveHours + latestCapacity.freeHours,
                    0.1,
                  )) *
                  1000,
              ) / 10
            : null,
    },
    note: 'Weeks count when Top outcomes progressed AND protected commitments held — not task volume.',
  };
}
