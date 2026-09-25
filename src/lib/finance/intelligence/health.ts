import {
  EMERGENCY_FULL_RUNWAY_MONTHS,
  HEALTH_SCORE_WEIGHTS,
  SAVINGS_RATE_FULL_PCT,
} from '@/lib/finance/intelligence/constants';
import type { HealthFactor, HealthScore } from '@/lib/finance/intelligence/types';
import type { SubscriptionItem } from '@/lib/finance/intelligence/types';
import type { MonthlyFinanceSummary } from '@/lib/finance/intelligence/types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function factor(
  code: HealthFactor['code'],
  weight: number,
  score01: number,
  detail: string,
): HealthFactor {
  const s = clamp01(score01);
  return {
    code,
    weight,
    score01: Math.round(s * 100) / 100,
    points: Math.round(weight * s * 1000) / 10,
    detail,
  };
}

/**
 * Explainable 0–100 health score from documented sub-factors.
 */
export function computeHealthScore(input: {
  summary: MonthlyFinanceSummary;
  subscriptions: SubscriptionItem[];
  emergencyCurrentMinor: number;
  emergencyTargetMinor: number;
  debtMinor: number;
  investmentContributionsMinor: number;
}): HealthScore {
  const { summary } = input;
  const burnRateMinor = summary.expensesMinor;
  const freeCashFlowMinor = summary.netCashFlowMinor;
  const savingsRatePct = summary.savingsRatePct;
  const recurringMonthlyMinor = input.subscriptions.reduce(
    (s, row) => s + row.monthlyCostMinor,
    0,
  );

  const runwayMonths =
    burnRateMinor > 0
      ? Math.round((input.emergencyCurrentMinor / burnRateMinor) * 10) / 10
      : input.emergencyCurrentMinor > 0
        ? EMERGENCY_FULL_RUNWAY_MONTHS
        : 0;

  const factors: HealthFactor[] = [
    factor(
      'savingsRate',
      HEALTH_SCORE_WEIGHTS.savingsRate,
      savingsRatePct == null
        ? 0.4
        : clamp01(savingsRatePct / SAVINGS_RATE_FULL_PCT),
      savingsRatePct == null
        ? 'No income this month to compute savings rate'
        : `Savings rate ${savingsRatePct}% (target ${SAVINGS_RATE_FULL_PCT}%)`,
    ),
    factor(
      'emergencyRunway',
      HEALTH_SCORE_WEIGHTS.emergencyRunway,
      clamp01(runwayMonths / EMERGENCY_FULL_RUNWAY_MONTHS),
      `Emergency fund covers ~${runwayMonths} months of burn (target ${EMERGENCY_FULL_RUNWAY_MONTHS})`,
    ),
    factor(
      'burnVsIncome',
      HEALTH_SCORE_WEIGHTS.burnVsIncome,
      summary.incomeMinor <= 0
        ? burnRateMinor === 0
          ? 0.5
          : 0.2
        : clamp01(1 - burnRateMinor / summary.incomeMinor),
      summary.incomeMinor <= 0
        ? 'Burn without recorded income'
        : `Expenses are ${Math.round((burnRateMinor / summary.incomeMinor) * 100)}% of income`,
    ),
    factor(
      'recurringLoad',
      HEALTH_SCORE_WEIGHTS.recurringLoad,
      summary.incomeMinor <= 0
        ? recurringMonthlyMinor === 0
          ? 0.7
          : 0.3
        : clamp01(1 - recurringMonthlyMinor / summary.incomeMinor),
      `Recurring ~${recurringMonthlyMinor} minor units / month`,
    ),
    factor(
      'debtLoad',
      HEALTH_SCORE_WEIGHTS.debtLoad,
      input.debtMinor <= 0
        ? 1
        : clamp01(
            1 -
              input.debtMinor /
                Math.max(
                  input.debtMinor + Math.max(freeCashFlowMinor, 0) * 12,
                  1,
                ),
          ),
      input.debtMinor <= 0
        ? 'No tracked debt goals'
        : `Tracked debt ${input.debtMinor} minor units`,
    ),
  ];

  const score = Math.round(
    Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0))),
  );

  return {
    score,
    currency: summary.currency,
    factors,
    burnRateMinor,
    freeCashFlowMinor,
    savingsRatePct,
    emergencyFundMinor: input.emergencyCurrentMinor,
    emergencyTargetMinor: input.emergencyTargetMinor,
    emergencyRunwayMonths: runwayMonths,
    recurringMonthlyMinor,
    debtMinor: input.debtMinor,
    investmentContributionsMinor: input.investmentContributionsMinor,
  };
}
