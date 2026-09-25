import { DEFAULT_CURRENCY } from '@/lib/constants';
import type { TransactionType } from '@/lib/db/schema';
import {
  parseAmountToMinor,
  parseFlexibleDate,
  toWesternDigits,
} from '@/lib/finance/parse';
import type { IngestAdapter, NormalizedTxn } from '@/lib/finance/types';

export type CsvColumnMap = {
  date: string;
  amount: string;
  merchant?: string;
  type?: string;
  notes?: string;
  externalId?: string;
};

export type CsvAdapterInput = {
  csvText: string;
  mapping: CsvColumnMap;
  defaultAccountId?: string;
  defaultCurrency?: string;
  defaultType?: TransactionType;
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function detectType(
  raw: string | undefined,
  amountMinor: number,
  fallback: TransactionType,
): TransactionType {
  const value = (raw ?? '').toLowerCase();
  if (/income|credit|deposit|إيداع|حوالة\s*واردة/.test(value)) {
    return 'income';
  }
  if (/fee|رسوم/.test(value)) {
    return 'fee';
  }
  if (/refund|استرداد/.test(value)) {
    return 'refund';
  }
  if (/transfer|تحويل/.test(value)) {
    return 'transfer';
  }
  if (/withdrawal|سحب/.test(value)) {
    return 'withdrawal';
  }
  if (amountMinor < 0) {
    return 'expense';
  }
  if (/debit|expense|شراء/.test(value)) {
    return 'expense';
  }
  return fallback;
}

export class CsvAdapter implements IngestAdapter<CsvAdapterInput> {
  readonly name = 'csv' as const;

  parse(input: CsvAdapterInput): NormalizedTxn[] {
    const lines = input.csvText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return [];
    }
    const headers = splitCsvLine(lines[0]).map((h) => h.trim());
    const indexOf = (name: string | undefined) =>
      name ? headers.findIndex((h) => h.toLowerCase() === name.toLowerCase()) : -1;

    const dateIdx = indexOf(input.mapping.date);
    const amountIdx = indexOf(input.mapping.amount);
    const merchantIdx = indexOf(input.mapping.merchant);
    const typeIdx = indexOf(input.mapping.type);
    const notesIdx = indexOf(input.mapping.notes);
    const externalIdx = indexOf(input.mapping.externalId);

    if (dateIdx < 0 || amountIdx < 0) {
      return [
        {
          occurredOn: new Date().toISOString().slice(0, 10),
          amountMinor: 0,
          currency: input.defaultCurrency ?? DEFAULT_CURRENCY,
          type: input.defaultType ?? 'expense',
          merchant: null,
          source: 'csv',
          needsReview: true,
          parseError: 'missing_columns',
          notes: 'CSV mapping missing date or amount column',
        },
      ];
    }

    const currency = input.defaultCurrency ?? DEFAULT_CURRENCY;
    const out: NormalizedTxn[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const cells = splitCsvLine(lines[i]);
      const dateRaw = cells[dateIdx] ?? '';
      const amountRaw = cells[amountIdx] ?? '';
      const occurredOn = parseFlexibleDate(dateRaw);
      const signed = parseAmountToMinor(toWesternDigits(amountRaw));
      if (!occurredOn || signed == null) {
        out.push({
          occurredOn: occurredOn ?? new Date().toISOString().slice(0, 10),
          amountMinor: Math.abs(signed ?? 0),
          currency,
          type: input.defaultType ?? 'expense',
          merchant: merchantIdx >= 0 ? cells[merchantIdx] || null : null,
          accountRef: input.defaultAccountId ?? null,
          source: 'csv',
          sourceRef: `csv:row:${i + 1}`,
          needsReview: true,
          parseError: 'unparseable_row',
          notes: lines[i],
        });
        continue;
      }
      const amountMinor = Math.abs(signed);
      const type = detectType(
        typeIdx >= 0 ? cells[typeIdx] : undefined,
        signed,
        input.defaultType ?? 'expense',
      );
      out.push({
        occurredOn,
        amountMinor,
        currency,
        type,
        merchant: merchantIdx >= 0 ? cells[merchantIdx] || null : null,
        accountRef: input.defaultAccountId ?? null,
        source: 'csv',
        sourceRef: `csv:row:${i + 1}`,
        externalId: externalIdx >= 0 ? cells[externalIdx] || null : null,
        notes: notesIdx >= 0 ? cells[notesIdx] || null : null,
        scope: 'personal',
      });
    }
    return out;
  }
}
