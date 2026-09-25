import 'server-only';

import {
  getHealthScore,
  getMonthlyFinanceSummary,
  getSubscriptions,
  getUnusualSpending,
  getVentureFinance,
} from '@/lib/finance/intelligence/service';
import { daysInMonth } from '@/lib/finance/intelligence/summary';

/**
 * Deterministically pick aggregates for a CFO question.
 * AI only phrases what this returns.
 */
export async function buildCfoAggregates(
  userId: string,
  question: string,
): Promise<Record<string, unknown>> {
  const q = question.toLowerCase();
  const summary = await getMonthlyFinanceSummary(userId);
  const monthEnd = `${summary.monthYmd.slice(0, 7)}-${String(daysInMonth(summary.monthYmd)).padStart(2, '0')}`;

  const base = {
    monthYmd: summary.monthYmd,
    currency: summary.currency,
    incomeMinor: summary.incomeMinor,
    expensesMinor: summary.expensesMinor,
    netCashFlowMinor: summary.netCashFlowMinor,
    savingsRatePct: summary.savingsRatePct,
    projectedMonthEndMinor: summary.projectedMonthEndMinor,
    byCategory: summary.byCategory.slice(0, 8),
    byScope: summary.byScope,
    momTrend: summary.momTrend,
  };

  if (
    q.includes('subscription') ||
    q.includes('اشتراك') ||
    q.includes('recurring')
  ) {
    const subscriptions = await getSubscriptions(userId);
    return {
      ...base,
      subscriptions: subscriptions.map((s) => ({
        merchant: s.merchant,
        cadenceDays: s.cadenceDays,
        monthlyCostMinor: s.monthlyCostMinor,
        occurrences: s.occurrences,
        lastOccurredOn: s.lastOccurredOn,
      })),
      subscriptionsTotalMonthlyMinor: subscriptions.reduce(
        (sum, s) => sum + s.monthlyCostMinor,
        0,
      ),
    };
  }

  if (
    q.includes('venture') ||
    q.includes('project') ||
    q.includes('مشروع') ||
    q.includes('business')
  ) {
    const ventures = await getVentureFinance(userId);
    return {
      ...base,
      ventures: ventures
        .filter((v) => v.investedMinor > 0 || v.revenueMinor > 0)
        .map((v) => ({
          name: v.name,
          stage: v.stage,
          investedMinor: v.investedMinor,
          revenueMinor: v.revenueMinor,
          netMinor: v.netMinor,
          timeInvestedMinutes: v.timeInvestedMinutes,
        })),
    };
  }

  if (
    q.includes('unusual') ||
    q.includes('increase') ||
    q.includes('why') ||
    q.includes('لماذا') ||
    q.includes('ارتفع')
  ) {
    const unusual = await getUnusualSpending(userId);
    return {
      ...base,
      unusual: unusual.slice(0, 8),
      momDelta:
        summary.momTrend.length >= 2
          ? summary.momTrend[summary.momTrend.length - 1].expensesMinor -
            summary.momTrend[summary.momTrend.length - 2].expensesMinor
          : null,
    };
  }

  if (
    q.includes('balance') ||
    q.includes('month-end') ||
    q.includes('month end') ||
    q.includes('نهاية') ||
    q.includes('projected')
  ) {
    const health = await getHealthScore(userId);
    return {
      ...base,
      projectedMonthEndMinor: summary.projectedMonthEndMinor,
      daysElapsed: summary.daysElapsed,
      daysInMonth: summary.daysInMonth,
      freeCashFlowMinor: health.freeCashFlowMinor,
      burnRateMinor: health.burnRateMinor,
      monthEndYmd: monthEnd,
    };
  }

  if (
    q.includes('sustain') ||
    q.includes('health') ||
    q.includes('صحة') ||
    q.includes('استدام')
  ) {
    const health = await getHealthScore(userId);
    return {
      ...base,
      healthScore: health.score,
      factors: health.factors,
      emergencyRunwayMonths: health.emergencyRunwayMonths,
      recurringMonthlyMinor: health.recurringMonthlyMinor,
      debtMinor: health.debtMinor,
    };
  }

  // Default: where did money go
  return {
    ...base,
    topCategories: summary.byCategory.slice(0, 6),
    budget: summary.budget.slice(0, 8),
  };
}
