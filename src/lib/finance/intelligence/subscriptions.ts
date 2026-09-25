import {
  SUBSCRIPTION_AMOUNT_TOLERANCE_PCT,
  SUBSCRIPTION_LOOKBACK_MONTHS,
  SUBSCRIPTION_MIN_OCCURRENCES,
} from '@/lib/finance/intelligence/constants';
import { normalizeMerchant } from '@/lib/finance/merchant';
import type { SubscriptionItem } from '@/lib/finance/intelligence/types';
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
 * Detect recurring merchants with similar amounts over the lookback window.
 */
export function detectSubscriptions(
  transactions: TxnRow[],
  asOfYmd: string,
  currency = 'SAR',
): SubscriptionItem[] {
  const start = addMonthsYmd(`${asOfYmd.slice(0, 7)}-01`, -SUBSCRIPTION_LOOKBACK_MONTHS);
  const byMerchant = new Map<string, TxnRow[]>();

  for (const row of transactions) {
    if (!isExpense(row.type) || !row.merchant) {
      continue;
    }
    const day = toYmd(row.occurredOn);
    if (day < start || day > asOfYmd) {
      continue;
    }
    const key = normalizeMerchant(row.merchant);
    if (!key) {
      continue;
    }
    const list = byMerchant.get(key) ?? [];
    list.push(row);
    byMerchant.set(key, list);
  }

  const out: SubscriptionItem[] = [];
  const tol = SUBSCRIPTION_AMOUNT_TOLERANCE_PCT / 100;

  for (const [merchant, rows] of byMerchant) {
    if (rows.length < SUBSCRIPTION_MIN_OCCURRENCES) {
      continue;
    }
    const sorted = [...rows].sort(
      (a, b) => toYmd(a.occurredOn).localeCompare(toYmd(b.occurredOn)),
    );
    const amounts = sorted.map((r) => r.amount);
    const avg =
      amounts.reduce((s, n) => s + n, 0) / Math.max(1, amounts.length);
    const similar = amounts.filter(
      (a) => Math.abs(a - avg) <= avg * tol || avg === 0,
    );
    if (similar.length < SUBSCRIPTION_MIN_OCCURRENCES) {
      continue;
    }

    const days: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const a = Date.parse(`${toYmd(sorted[i - 1].occurredOn)}T00:00:00Z`);
      const b = Date.parse(`${toYmd(sorted[i].occurredOn)}T00:00:00Z`);
      days.push(Math.round((b - a) / 86_400_000));
    }
    const cadenceDays =
      days.length > 0
        ? Math.round(days.reduce((s, n) => s + n, 0) / days.length)
        : 30;
    if (cadenceDays < 7 || cadenceDays > 40) {
      // Keep monthly-ish and weekly; skip one-offs clustered irregularly
      if (cadenceDays > 45 || cadenceDays < 5) {
        continue;
      }
    }

    const monthlyCostMinor = Math.round((avg * 30) / Math.max(1, cadenceDays));
    out.push({
      merchant,
      cadenceDays,
      occurrences: sorted.length,
      avgAmountMinor: Math.round(avg),
      monthlyCostMinor,
      lastOccurredOn: toYmd(sorted[sorted.length - 1].occurredOn),
      currency,
    });
  }

  return out.sort((a, b) => b.monthlyCostMinor - a.monthlyCostMinor);
}
