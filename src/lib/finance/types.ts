import type {
  DataSource,
  MoneyScope,
  TransactionType,
} from '@/lib/db/schema';

/**
 * Normalized transaction input — every finance source must emit this shape.
 * Amounts are ALWAYS integer minor units (halalas for SAR). Never floats.
 */
export type NormalizedTxn = {
  occurredOn: string; // YYYY-MM-DD
  occurredAt?: string | null; // ISO timestamptz
  amountMinor: number;
  currency: string;
  type: TransactionType;
  merchant: string | null;
  accountRef?: string | null; // account id or name hint
  cardLabel?: string | null; // last-4 or label only
  source: DataSource;
  sourceRef?: string | null;
  externalId?: string | null;
  notes?: string | null;
  scope?: MoneyScope;
  projectId?: string | null;
  categoryId?: string | null;
  confidence?: number | null;
  needsReview?: boolean;
  parseError?: string | null;
};

export type IngestAdapterName = 'manual' | 'csv' | 'sms';

export interface IngestAdapter<TInput = unknown> {
  readonly name: IngestAdapterName;
  parse(input: TInput): NormalizedTxn[];
}

export type IngestResultRow = {
  status: 'imported' | 'duplicate' | 'needs_review' | 'failed';
  transactionId?: string;
  externalId?: string | null;
  merchant?: string | null;
  amountMinor?: number;
  reason?: string;
};

export type IngestSummary = {
  imported: number;
  duplicates: number;
  needsReview: number;
  failed: number;
  rows: IngestResultRow[];
};

export type ClassifySuggestion = {
  categoryId: string | null;
  categoryName: string | null;
  scope: MoneyScope;
  confidence: number;
  source: 'rule' | 'ai' | 'none';
};
