import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMonthlyFinanceSummary } from '@/lib/finance/intelligence/summary';
import { detectSubscriptions } from '@/lib/finance/intelligence/subscriptions';
import { computeHealthScore } from '@/lib/finance/intelligence/health';
import { HEALTH_SCORE_WEIGHTS } from '@/lib/finance/intelligence/constants';

describe('finance intelligence', () => {
  it('computes monthly summary without floats in money totals', () => {
    const summary = computeMonthlyFinanceSummary({
      monthYmd: '2026-09-01',
      todayYmd: '2026-09-16',
      currency: 'SAR',
      categories: [{ id: 'c1', name: 'Dining' }],
      budgets: [{ categoryId: 'c1', amount: 100_000 }],
      transactions: [
        {
          id: '1',
          occurredOn: '2026-09-02',
          amount: 50_000,
          currency: 'SAR',
          type: 'income',
          merchant: 'Salary',
          categoryId: null,
          scope: 'personal',
          projectId: null,
        },
        {
          id: '2',
          occurredOn: '2026-09-03',
          amount: 12_500,
          currency: 'SAR',
          type: 'expense',
          merchant: 'Cafe',
          categoryId: 'c1',
          scope: 'personal',
          projectId: null,
        },
      ],
    });
    assert.equal(summary.incomeMinor, 50_000);
    assert.equal(summary.expensesMinor, 12_500);
    assert.equal(summary.savingsMinor, 37_500);
    assert.equal(Number.isInteger(summary.projectedMonthEndMinor), true);
  });

  it('detects recurring merchants', () => {
    const subs = detectSubscriptions(
      [
        {
          id: 'a',
          occurredOn: '2026-06-01',
          amount: 3_900,
          currency: 'SAR',
          type: 'expense',
          merchant: 'Netflix',
          categoryId: null,
          scope: 'personal',
          projectId: null,
        },
        {
          id: 'b',
          occurredOn: '2026-07-01',
          amount: 3_900,
          currency: 'SAR',
          type: 'expense',
          merchant: 'Netflix',
          categoryId: null,
          scope: 'personal',
          projectId: null,
        },
        {
          id: 'c',
          occurredOn: '2026-08-01',
          amount: 3_900,
          currency: 'SAR',
          type: 'expense',
          merchant: 'Netflix',
          categoryId: null,
          scope: 'personal',
          projectId: null,
        },
      ],
      '2026-09-16',
      'SAR',
    );
    assert.ok(subs.length >= 1);
    assert.equal(subs[0].merchant, 'NETFLIX');
    assert.ok(subs[0].monthlyCostMinor > 0);
  });

  it('builds an explainable health score whose factors sum to the score', () => {
    const summary = computeMonthlyFinanceSummary({
      monthYmd: '2026-09-01',
      todayYmd: '2026-09-16',
      currency: 'SAR',
      categories: [],
      budgets: [],
      transactions: [
        {
          id: '1',
          occurredOn: '2026-09-01',
          amount: 100_000,
          currency: 'SAR',
          type: 'income',
          merchant: null,
          categoryId: null,
          scope: 'personal',
          projectId: null,
        },
        {
          id: '2',
          occurredOn: '2026-09-05',
          amount: 40_000,
          currency: 'SAR',
          type: 'expense',
          merchant: null,
          categoryId: null,
          scope: 'personal',
          projectId: null,
        },
      ],
    });
    const health = computeHealthScore({
      summary,
      subscriptions: [],
      emergencyCurrentMinor: 240_000,
      emergencyTargetMinor: 300_000,
      debtMinor: 0,
      investmentContributionsMinor: 0,
    });
    const weightSum =
      HEALTH_SCORE_WEIGHTS.savingsRate +
      HEALTH_SCORE_WEIGHTS.emergencyRunway +
      HEALTH_SCORE_WEIGHTS.burnVsIncome +
      HEALTH_SCORE_WEIGHTS.recurringLoad +
      HEALTH_SCORE_WEIGHTS.debtLoad;
    assert.equal(Math.round(weightSum * 100), 100);
    const pointsSum = Math.round(
      health.factors.reduce((s, f) => s + f.points, 0),
    );
    assert.equal(health.score, pointsSum);
    assert.equal(health.factors.length, 5);
  });
});
