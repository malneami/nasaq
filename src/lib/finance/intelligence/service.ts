import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import {
  getBudgetsForMonth,
  listFinancialGoals,
  listTransactionCategories,
  listTransactions,
} from '@/lib/db/queries/finance';
import { getProfile } from '@/lib/db/queries/profiles';
import {
  listProjects,
  listProjectFinancesForUser,
} from '@/lib/db/queries/projects';
import { computeHealthScore } from '@/lib/finance/intelligence/health';
import {
  addMonthsYmd,
  computeMonthlyFinanceSummary,
  type TxnRow,
} from '@/lib/finance/intelligence/summary';
import { detectSubscriptions } from '@/lib/finance/intelligence/subscriptions';
import type {
  DailyFinanceBrief,
  HealthScore,
  MonthlyFinanceSummary,
  SubscriptionItem,
  UnusualSpendItem,
  VentureFinanceRow,
} from '@/lib/finance/intelligence/types';
import { detectUnusualSpending } from '@/lib/finance/intelligence/unusual';
import { computeVentureFinance } from '@/lib/finance/intelligence/ventures';
import { monthStartYmd, ymdInTimeZone } from '@/lib/time/zoned';

async function loadContext(userId: string) {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const currency = profile?.currency || DEFAULT_CURRENCY;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const [transactions, categories, goals] = await Promise.all([
    listTransactions(userId),
    listTransactionCategories(userId),
    listFinancialGoals(userId),
  ]);
  const txns: TxnRow[] = transactions.map((row) => ({
    id: row.id,
    occurredOn: row.occurredOn,
    amount: row.amount,
    currency: row.currency,
    type: row.type,
    merchant: row.merchant,
    categoryId: row.categoryId,
    scope: row.scope,
    projectId: row.projectId,
  }));
  return { profile, timeZone, currency, todayYmd, txns, categories, goals };
}

export async function getMonthlyFinanceSummary(
  userId: string,
  month?: string,
): Promise<MonthlyFinanceSummary> {
  const ctx = await loadContext(userId);
  const monthYmd = monthStartYmd(month ?? ctx.todayYmd);
  const budgets = await getBudgetsForMonth(userId, monthYmd);
  return computeMonthlyFinanceSummary({
    monthYmd,
    todayYmd: ctx.todayYmd,
    currency: ctx.currency,
    transactions: ctx.txns,
    categories: ctx.categories.map((c) => ({ id: c.id, name: c.name })),
    budgets: budgets.map((b) => ({
      categoryId: b.categoryId,
      amount: b.amount,
    })),
  });
}

export async function getSubscriptions(
  userId: string,
): Promise<SubscriptionItem[]> {
  const ctx = await loadContext(userId);
  return detectSubscriptions(ctx.txns, ctx.todayYmd, ctx.currency);
}

export async function getUnusualSpending(
  userId: string,
  month?: string,
): Promise<UnusualSpendItem[]> {
  const ctx = await loadContext(userId);
  const monthYmd = monthStartYmd(month ?? ctx.todayYmd);
  return detectUnusualSpending({
    transactions: ctx.txns,
    monthYmd,
    todayYmd: ctx.todayYmd,
    categories: ctx.categories.map((c) => ({ id: c.id, name: c.name })),
  });
}

export async function getHealthScore(userId: string): Promise<HealthScore> {
  const ctx = await loadContext(userId);
  const summary = await getMonthlyFinanceSummary(userId);
  const subscriptions = detectSubscriptions(ctx.txns, ctx.todayYmd, ctx.currency);
  const emergency = ctx.goals.find((g) => g.kind === 'emergency_fund');
  const debt = ctx.goals
    .filter((g) => g.kind === 'debt')
    .reduce((s, g) => s + Math.max(0, g.targetAmount - g.currentAmount), 0);
  const investment = ctx.goals
    .filter((g) => g.kind === 'investment' || g.kind === 'savings')
    .reduce((s, g) => s + g.currentAmount, 0);

  // Also count Investment category spend this month as contributions
  const investCat = ctx.categories.find((c) => c.name === 'Investment');
  const monthPrefix = summary.monthYmd.slice(0, 7);
  let investTxn = 0;
  if (investCat) {
    for (const row of ctx.txns) {
      const day =
        typeof row.occurredOn === 'string'
          ? row.occurredOn.slice(0, 10)
          : row.occurredOn.toISOString().slice(0, 10);
      if (
        day.slice(0, 7) === monthPrefix &&
        row.categoryId === investCat.id &&
        (row.type === 'expense' || row.type === 'fee')
      ) {
        investTxn += row.amount;
      }
    }
  }

  return computeHealthScore({
    summary,
    subscriptions,
    emergencyCurrentMinor: emergency?.currentAmount ?? 0,
    emergencyTargetMinor: emergency?.targetAmount ?? 0,
    debtMinor: debt,
    investmentContributionsMinor: investment + investTxn,
  });
}

export async function getVentureFinance(
  userId: string,
): Promise<VentureFinanceRow[]> {
  const ctx = await loadContext(userId);
  const [projects, finances] = await Promise.all([
    listProjects(userId),
    listProjectFinancesForUser(userId),
  ]);
  return computeVentureFinance({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage,
      state: p.state,
      moneyInvested: p.moneyInvested,
      timeInvestedMinutes: p.timeInvestedMinutes,
      currency: p.currency,
    })),
    projectFinances: finances.map((f) => ({
      projectId: f.projectId,
      moneyInvested: f.moneyInvested,
      revenue: f.revenue,
      timeInvestedMinutes: f.timeInvestedMinutes,
      currency: f.currency,
    })),
    transactions: ctx.txns,
  });
}

export function buildBriefFigures(input: {
  todayYmd: string;
  currency: string;
  txns: TxnRow[];
  categories: { id: string; name: string }[];
  summary: MonthlyFinanceSummary;
  unusual: UnusualSpendItem[];
}): Omit<DailyFinanceBrief, 'insight'> {
  const todayRows = input.txns.filter((row) => {
    const day =
      typeof row.occurredOn === 'string'
        ? row.occurredOn.slice(0, 10)
        : row.occurredOn.toISOString().slice(0, 10);
    return (
      day === input.todayYmd &&
      (row.type === 'expense' || row.type === 'fee' || row.type === 'withdrawal')
    );
  });
  const spendTodayMinor = todayRows.reduce((s, r) => s + r.amount, 0);
  const largest = [...todayRows].sort((a, b) => b.amount - a.amount)[0] ?? null;
  const catMap = new Map(input.categories.map((c) => [c.id, c.name]));
  const topMap = new Map<string, number>();
  for (const row of todayRows) {
    const key = row.categoryId ?? 'uncategorized';
    topMap.set(key, (topMap.get(key) ?? 0) + row.amount);
  }
  const topCategoriesToday = [...topMap.entries()]
    .map(([key, amountMinor]) => ({
      key,
      label:
        key === 'uncategorized' ? 'Uncategorized' : (catMap.get(key) ?? 'Other'),
      amountMinor,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 3);

  const budgetUsedPercent =
    input.summary.budgetTotalMinor > 0
      ? Math.round(
          (input.summary.budgetActualMinor / input.summary.budgetTotalMinor) *
            100,
        )
      : null;

  const enoughData =
    input.txns.length >= 3 ||
    input.summary.expensesMinor > 0 ||
    spendTodayMinor > 0;

  const dining = input.summary.byCategory.find((c) => c.label === 'Dining');
  const diningShare =
    dining && input.summary.expensesMinor > 0
      ? Math.round((dining.amountMinor / input.summary.expensesMinor) * 1000) / 10
      : null;

  return {
    dateYmd: input.todayYmd,
    currency: input.currency,
    spendTodayMinor,
    largestToday: largest
      ? { merchant: largest.merchant, amountMinor: largest.amount }
      : null,
    topCategoriesToday,
    monthSpendMinor: input.summary.expensesMinor,
    budgetUsedPercent,
    insightFigures: {
      spendTodayMinor,
      monthSpendMinor: input.summary.expensesMinor,
      budgetUsedPercent,
      diningSharePct: diningShare,
      unusualCount: input.unusual.length,
      projectedMonthEndMinor: input.summary.projectedMonthEndMinor,
      savingsRatePct: input.summary.savingsRatePct,
    },
    enoughData,
  };
}

export { addMonthsYmd };
