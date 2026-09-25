import 'server-only';

import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { getProfile } from '@/lib/db/queries/profiles';
import { getDailyBrief, upsertDailyBrief } from '@/lib/db/queries/reviews';
import { createAuditLog } from '@/lib/db/queries/system';
import { getCapacity } from '@/lib/capacity/service';
import { ensureDailyFinanceBrief } from '@/lib/finance/intelligence/brief';
import { mergeBriefContent } from '@/lib/reviews/brief-merge';
import { phraseReviewSynthesis } from '@/lib/reviews/synthesize';
import type { MorningBriefModel } from '@/lib/reviews/types';
import { assembleToday } from '@/lib/today/assemble';
import { ymdInTimeZone, ymdToUtcDate } from '@/lib/time/zoned';

export async function ensureMorningBrief(
  userId: string,
  locale: 'en' | 'ar' = 'en',
): Promise<MorningBriefModel> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const briefDate = ymdToUtcDate(todayYmd);

  const existing = await getDailyBrief(userId, briefDate);
  const stored = (existing?.content as { morning?: MorningBriefModel } | null)
    ?.morning;
  if (stored?.dateYmd === todayYmd && stored.recommendedFocus) {
    return stored;
  }

  const [today, capacity, financeBrief] = await Promise.all([
    assembleToday(userId),
    getCapacity(userId, todayYmd).catch(() => null),
    ensureDailyFinanceBrief(userId, locale),
  ]);

  const protectedCommitments = today.schedule
    .filter((e) => e.isProtected || e.eventType === 'family')
    .map((e) => ({
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
    }));

  const figures = {
    productiveHours: capacity?.productiveHours ?? today.header.capacityHours,
    freeHours: capacity?.freeHours ?? today.header.capacityHours,
    top3Count: today.outcomes.confirmed.length,
    followUpCount: today.followUps.length,
    attentionCount: today.attention.length,
    spendTodayMinor: today.finance.spendingTodayMinor,
    protectedCount: protectedCommitments.length,
    shift: today.header.shiftTitle,
  };

  const recommendedFocus = await phraseReviewSynthesis({
    kind: 'morning_focus',
    figures: {
      ...figures,
      top3: today.outcomes.confirmed.map((o) => o.text),
      deadlines: today.outcomes.confirmed
        .filter((o) => o.dueDate)
        .map((o) => o.dueDate),
    },
    locale,
  });

  const model: MorningBriefModel = {
    dateYmd: todayYmd,
    timeZone,
    shiftTitle: today.header.shiftTitle,
    schedule: today.schedule.map((e) => ({
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      eventType: e.eventType,
      isProtected: e.isProtected,
    })),
    top3: today.outcomes.confirmed,
    productiveHours: figures.productiveHours as number,
    freeHours: figures.freeHours as number,
    followUps: today.followUps.slice(0, 8).map((f) => ({
      name: f.personName,
      dueYmd: f.dueYmd,
    })),
    protectedCommitments,
    finance: {
      spendTodayMinor: today.finance.spendingTodayMinor,
      spendMonthMinor: today.finance.spendingMonthMinor,
      currency: today.finance.currency || DEFAULT_CURRENCY,
      insight: financeBrief.insight ?? today.finance.briefInsight,
    },
    attention: today.attention.slice(0, 6).map((a) => ({
      title: a.title,
      detail: a.detail,
    })),
    recommendedFocus,
    figures,
  };

  await upsertDailyBrief(
    userId,
    briefDate,
    mergeBriefContent(existing?.content, { morning: model }),
  );

  await createAuditLog(userId, {
    actor: 'ai',
    action: 'morning_brief',
    entityType: 'daily_brief',
    entityId: todayYmd,
    after: { recommendedFocus, productiveHours: model.productiveHours },
  });

  return model;
}
