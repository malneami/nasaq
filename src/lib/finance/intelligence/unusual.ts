import {
  UNUSUAL_MIN_MINOR,
  UNUSUAL_SPEND_FACTOR,
} from '@/lib/finance/intelligence/constants';
import type { UnusualSpendItem } from '@/lib/finance/intelligence/types';
import type { TxnRow } from '@/lib/finance/intelligence/summary';
import { addMonthsYmd } from '@/lib/finance/intelligence/summary';

function toYmd(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function isExpense(type: string) {
  return type === 'expense' || type === 'fee' || type === 'withdrawal';
}

/**
 * Flag categories (and large single txns) materially above recent baseline.
 */
export function detectUnusualSpending(input: {
  transactions: TxnRow[];
  monthYmd: string;
  todayYmd: string;
  categories: { id: string; name: string }[];
}): UnusualSpendItem[] {
  const monthPrefix = input.monthYmd.slice(0, 7);
  const baselineStart = addMonthsYmd(`${monthPrefix}-01`, -3);
  const categoryName = new Map(
    input.categories.map((row) => [row.id, row.name]),
  );

  const baselineByCat = new Map<string, number[]>();
  const currentByCat = new Map<string, number>();
  const currentTxns: TxnRow[] = [];

  for (const row of input.transactions) {
    if (!isExpense(row.type)) {
      continue;
    }
    const day = toYmd(row.occurredOn);
    const prefix = day.slice(0, 7);
    const key = row.categoryId ?? 'uncategorized';
    if (prefix === monthPrefix) {
      currentByCat.set(key, (currentByCat.get(key) ?? 0) + row.amount);
      currentTxns.push(row);
    } else if (day >= baselineStart && day < `${monthPrefix}-01`) {
      const list = baselineByCat.get(key) ?? [];
      // accumulate per month later — store month sums
      list.push(row.amount);
      baselineByCat.set(key, list);
    }
  }

  // Rebuild baseline as monthly averages per category
  const baselineMonthly = new Map<string, number>();
  for (const [key, amounts] of baselineByCat) {
    // Approximate: sum over lookback / 3 months
    const monthly = amounts.reduce((s, n) => s + n, 0) / 3;
    baselineMonthly.set(key, monthly);
  }

  const out: UnusualSpendItem[] = [];
  for (const [key, amount] of currentByCat) {
    const baseline = baselineMonthly.get(key) ?? 0;
    if (amount < UNUSUAL_MIN_MINOR) {
      continue;
    }
    if (baseline <= 0) {
      continue;
    }
    const ratio = amount / baseline;
    if (ratio < UNUSUAL_SPEND_FACTOR) {
      continue;
    }
    out.push({
      kind: 'category',
      id: key,
      label:
        key === 'uncategorized'
          ? 'Uncategorized'
          : (categoryName.get(key) ?? 'Category'),
      amountMinor: amount,
      baselineMinor: Math.round(baseline),
      ratio: Math.round(ratio * 100) / 100,
    });
  }

  const baselineTxnAvg =
    [...baselineMonthly.values()].reduce((s, n) => s + n, 0) /
    Math.max(1, baselineMonthly.size);
  for (const row of currentTxns) {
    if (row.amount < UNUSUAL_MIN_MINOR * 2) {
      continue;
    }
    const baseline = Math.max(baselineTxnAvg, 1);
    const ratio = row.amount / baseline;
    if (ratio < UNUSUAL_SPEND_FACTOR * 1.5) {
      continue;
    }
    out.push({
      kind: 'transaction',
      id: row.id,
      label: row.merchant ?? 'Transaction',
      amountMinor: row.amount,
      baselineMinor: Math.round(baseline),
      ratio: Math.round(ratio * 100) / 100,
      occurredOn: toYmd(row.occurredOn),
    });
  }

  return out.sort((a, b) => b.ratio - a.ratio);
}
