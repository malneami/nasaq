import 'server-only';

import { upsertDailyBrief, getDailyBrief } from '@/lib/db/queries/reviews';
import { createAuditLog } from '@/lib/db/queries/system';
import {
  buildBriefFigures,
  getMonthlyFinanceSummary,
  getUnusualSpending,
} from '@/lib/finance/intelligence/service';
import { phraseFinanceInsight } from '@/lib/finance/intelligence/phrase';
import type { DailyFinanceBrief } from '@/lib/finance/intelligence/types';
import { listTransactionCategories, listTransactions } from '@/lib/db/queries/finance';
import { getProfile } from '@/lib/db/queries/profiles';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { ymdInTimeZone, ymdToUtcDate } from '@/lib/time/zoned';
import { parseDailyFocus } from '@/lib/today/focus';

export async function ensureDailyFinanceBrief(
  userId: string,
  locale: 'en' | 'ar' = 'en',
): Promise<DailyFinanceBrief> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const currency = profile?.currency || DEFAULT_CURRENCY;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const briefDate = ymdToUtcDate(todayYmd);

  const existing = await getDailyBrief(userId, briefDate);
  const existingFinance = (existing?.content as { finance?: DailyFinanceBrief } | null)
    ?.finance;
  if (
    existingFinance &&
    existingFinance.dateYmd === todayYmd &&
    existingFinance.insight
  ) {
    return existingFinance;
  }

  const [summary, unusual, txns, categories] = await Promise.all([
    getMonthlyFinanceSummary(userId),
    getUnusualSpending(userId),
    listTransactions(userId),
    listTransactionCategories(userId),
  ]);

  const base = buildBriefFigures({
    todayYmd,
    currency,
    txns: txns.map((row) => ({
      id: row.id,
      occurredOn: row.occurredOn,
      amount: row.amount,
      currency: row.currency,
      type: row.type,
      merchant: row.merchant,
      categoryId: row.categoryId,
      scope: row.scope,
      projectId: row.projectId,
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    summary,
    unusual,
  });

  const insight = base.enoughData
    ? await phraseFinanceInsight(base.insightFigures, locale)
    : locale === 'ar'
      ? 'لا بيانات كافية بعد لملخص مالي اليوم.'
      : 'Not enough data yet for a daily financial brief.';

  const financeBrief: DailyFinanceBrief = { ...base, insight };

  const focus = parseDailyFocus(existing?.content);
  const prior =
    existing?.content && typeof existing.content === 'object'
      ? (existing.content as Record<string, unknown>)
      : {};
  await upsertDailyBrief(userId, briefDate, {
    ...prior,
    outcomes: focus.outcomes,
    proposal: focus.proposal,
    finance: financeBrief,
  });

  await createAuditLog(userId, {
    actor: 'ai',
    action: 'finance_brief',
    entityType: 'daily_brief',
    entityId: todayYmd,
    after: { insight, spendTodayMinor: base.spendTodayMinor },
  });

  return financeBrief;
}
