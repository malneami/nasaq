import { DEFAULT_CURRENCY } from '@/lib/constants';
import type { TransactionType } from '@/lib/db/schema';
import { toMinor } from '@/lib/money';
import type { IngestAdapter, NormalizedTxn } from '@/lib/finance/types';
import { parseFlexibleDate } from '@/lib/finance/parse';

export type ManualTxnInput = {
  amountMajor?: number;
  amountMinor?: number;
  date: string;
  merchant?: string;
  type: TransactionType;
  currency?: string;
  accountId?: string;
  notes?: string;
  scope?: NormalizedTxn['scope'];
  projectId?: string | null;
  cardLabel?: string | null;
  categoryId?: string | null;
};

export class ManualAdapter implements IngestAdapter<ManualTxnInput | ManualTxnInput[]> {
  readonly name = 'manual' as const;

  parse(input: ManualTxnInput | ManualTxnInput[]): NormalizedTxn[] {
    const rows = Array.isArray(input) ? input : [input];
    return rows.map((row) => {
      const currency = row.currency ?? DEFAULT_CURRENCY;
      const amountMinor =
        row.amountMinor != null
          ? Math.trunc(row.amountMinor)
          : toMinor(Number(row.amountMajor ?? 0), currency);
      const occurredOn = parseFlexibleDate(row.date) ?? row.date.slice(0, 10);
      return {
        occurredOn,
        amountMinor: Math.abs(amountMinor),
        currency,
        type: row.type,
        merchant: row.merchant?.trim() || null,
        accountRef: row.accountId ?? null,
        cardLabel: row.cardLabel ?? null,
        source: 'manual',
        notes: row.notes ?? null,
        scope: row.scope ?? 'personal',
        projectId: row.projectId ?? null,
        categoryId: row.categoryId ?? null,
        confidence: 1,
        needsReview: false,
      };
    });
  }
}
