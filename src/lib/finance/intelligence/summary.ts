import { FIXED_CATEGORY_NAMES } from '@/lib/finance/intelligence/constants';
import type {
  MoneyBucket,
  MonthlyFinanceSummary,
} from '@/lib/finance/intelligence/types';
import type { MoneyScope, TransactionType } from '@/lib/db/schema';

export type TxnRow = {
  id: string;
  occurredOn: Date | string;
  amount: number;
  currency: string;
  type: TransactionType;
  merchant: string | null;
  categoryId: string | null;
  scope: MoneyScope;
  projectId: string | null;
};

function toYmd(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function monthKey(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function daysInMonth(monthYmd: string): number {
  const y = Number(monthYmd.slice(0, 4));
  const m = Number(monthYmd.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonthsYmd(monthYmd: string, delta: number): string {
  const y = Number(monthYmd.slice(0, 4));
  const m = Number(monthYmd.slice(5, 7)) - 1 + delta;
  const date = new Date(Date.UTC(y, m, 1));
  return date.toISOString().slice(0, 10);
}

function isIncome(type: TransactionType) {
  return type === 'income' || type === 'deposit';
}

function isExpense(type: TransactionType) {
  return type === 'expense' || type === 'fee' || type === 'withdrawal';
}

function bucketPush(
  map: Map<string, MoneyBucket>,
  key: string,
  label: string,
  amount: number,
) {
  const existing = map.get(key);
  if (existing) {
    existing.amountMinor += amount;
  } else {
    map.set(key, { key, label, amountMinor: amount });
  }
}

/**
 * Pure monthly summary over already-loaded transactions + budgets.
 */
export function computeMonthlyFinanceSummary(input: {
  monthYmd: string;
  todayYmd: string;
  currency: string;
  transactions: TxnRow[];
  categories: { id: string; name: string }[];
  budgets: { categoryId: string | null; amount: number }[];
  trendMonths?: number;
}): MonthlyFinanceSummary {
  const month = monthKey(input.monthYmd);
  const monthPrefix = month.slice(0, 7);
  const categoryName = new Map(
    input.categories.map((row) => [row.id, row.name]),
  );
  const fixedNames = new Set<string>(FIXED_CATEGORY_NAMES);

  const inMonth = input.transactions.filter(
    (row) => toYmd(row.occurredOn).slice(0, 7) === monthPrefix,
  );

  let incomeMinor = 0;
  let expensesMinor = 0;
  const byCategory = new Map<string, MoneyBucket>();
  const byScope = new Map<string, MoneyBucket>();
  const byFixedVariable = new Map<string, MoneyBucket>();

  for (const row of inMonth) {
    if (isIncome(row.type)) {
      incomeMinor += row.amount;
    }
    if (isExpense(row.type)) {
      expensesMinor += row.amount;
      const catName = row.categoryId
        ? (categoryName.get(row.categoryId) ?? 'Other')
        : 'Uncategorized';
      const catKey = row.categoryId ?? 'uncategorized';
      bucketPush(byCategory, catKey, catName, row.amount);
      bucketPush(byScope, row.scope, row.scope, row.amount);
      const fv = fixedNames.has(catName) ? 'fixed' : 'variable';
      bucketPush(byFixedVariable, fv, fv, row.amount);
    }
  }

  const daysIn = daysInMonth(month);
  const isCurrent = input.todayYmd.slice(0, 7) === monthPrefix;
  const dayNum = isCurrent ? Number(input.todayYmd.slice(8, 10)) : daysIn;
  const daysElapsed = Math.max(1, Math.min(daysIn, dayNum));
  const runRate = expensesMinor / daysElapsed;
  const projectedMonthEndMinor = Math.round(runRate * daysIn);

  const expenseByCat = new Map(
    [...byCategory.entries()].map(([k, v]) => [k, v.amountMinor]),
  );

  const budget = input.budgets.map((row) => {
    const actual =
      row.categoryId == null
        ? expensesMinor
        : (expenseByCat.get(row.categoryId) ?? 0);
    const name =
      row.categoryId == null
        ? 'Overall'
        : (categoryName.get(row.categoryId) ?? 'Category');
    const projected =
      row.categoryId == null
        ? projectedMonthEndMinor
        : Math.round((actual / daysElapsed) * daysIn);
    return {
      categoryId: row.categoryId,
      categoryName: name,
      budgetMinor: row.amount,
      actualMinor: actual,
      remainingMinor: row.amount - actual,
      projectedMonthEndMinor: projected,
    };
  });

  const budgetTotalMinor = input.budgets.reduce((s, b) => s + b.amount, 0);
  const budgetActualMinor =
    input.budgets.length === 0
      ? expensesMinor
      : budget.reduce((s, b) => s + b.actualMinor, 0);

  const trendCount = input.trendMonths ?? 4;
  const momTrend: MonthlyFinanceSummary['momTrend'] = [];
  for (let i = trendCount - 1; i >= 0; i -= 1) {
    const m = addMonthsYmd(month, -i);
    const prefix = m.slice(0, 7);
    let exp = 0;
    let inc = 0;
    for (const row of input.transactions) {
      if (toYmd(row.occurredOn).slice(0, 7) !== prefix) {
        continue;
      }
      if (isExpense(row.type)) {
        exp += row.amount;
      }
      if (isIncome(row.type)) {
        inc += row.amount;
      }
    }
    momTrend.push({ monthYmd: m, expensesMinor: exp, incomeMinor: inc });
  }

  const savingsMinor = incomeMinor - expensesMinor;
  const savingsRatePct =
    incomeMinor > 0
      ? Math.round((savingsMinor / incomeMinor) * 1000) / 10
      : null;

  const sortBuckets = (map: Map<string, MoneyBucket>) =>
    [...map.values()].sort((a, b) => b.amountMinor - a.amountMinor);

  return {
    monthYmd: month,
    currency: input.currency,
    incomeMinor,
    expensesMinor,
    netCashFlowMinor: savingsMinor,
    savingsMinor,
    savingsRatePct,
    byCategory: sortBuckets(byCategory),
    byScope: sortBuckets(byScope),
    byFixedVariable: sortBuckets(byFixedVariable),
    budget,
    budgetTotalMinor,
    budgetActualMinor,
    projectedMonthEndMinor,
    momTrend,
    daysElapsed,
    daysInMonth: daysIn,
  };
}
