import { DEFAULT_CURRENCY } from '@/lib/constants';
import {
  parseAmountToMinor,
  parseFlexibleDate,
  toWesternDigits,
} from '@/lib/finance/parse';
import type { IngestAdapter, NormalizedTxn } from '@/lib/finance/types';

/**
 * Replaceable SMS adapter. MVP: user pastes bank SMS text.
 * A future automated feed can call the same parse() with message batches.
 */
export type SmsAdapterInput = {
  text: string;
  defaultAccountId?: string;
  defaultCurrency?: string;
};

function splitMessages(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function extractCardLabel(raw: string): string | null {
  const western = toWesternDigits(raw);
  const starred = /\*+(\d{4})\b/.exec(western);
  if (starred) {
    return `•••• ${starred[1]}`;
  }
  const labeled =
    /(?:card|بطاقة)[^\d*]{0,20}\*?(\d{4})\b/i.exec(western);
  return labeled ? `•••• ${labeled[1]}` : null;
}

function extractMerchant(raw: string): string | null {
  const western = toWesternDigits(raw);
  const patterns = [
    /(?:at|لدى|من|@)\s+([^\n.]+?)(?:\s+on\s|\s+في\s|\s+بتاريخ|\s+\d|$)/i,
    /(?:purchase|شراء|POS)\s+([^\n.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(western);
    if (match?.[1]) {
      return match[1].trim().slice(0, 120);
    }
  }
  return null;
}

function extractAmount(raw: string): number | null {
  const western = toWesternDigits(raw);
  const patterns = [
    /(?:SAR|ر\.?\s?س\.?|ريال)\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:\.[0-9]{1,2})?)\s*(?:SAR|ر\.?\s?س\.?|ريال)/i,
    /(?:amount|مبلغ|بقيمة)\s*[:=]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(western);
    if (match?.[1]) {
      return parseAmountToMinor(match[1]);
    }
  }
  return null;
}

function extractDate(raw: string): string | null {
  const western = toWesternDigits(raw);
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(western);
    if (match?.[1]) {
      return parseFlexibleDate(match[1]);
    }
  }
  return null;
}

function detectType(raw: string): NormalizedTxn['type'] {
  const western = toWesternDigits(raw).toLowerCase();
  if (/deposit|إيداع|حوالة\s*واردة|received|credited/.test(western)) {
    return 'income';
  }
  if (/fee|رسوم|عمولة/.test(western)) {
    return 'fee';
  }
  if (/refund|استرداد/.test(western)) {
    return 'refund';
  }
  if (/transfer|تحويل/.test(western)) {
    return 'transfer';
  }
  if (/withdrawal|سحب\s*نقد|atm/.test(western)) {
    return 'withdrawal';
  }
  return 'expense';
}

function parseOne(
  message: string,
  defaults: SmsAdapterInput,
): NormalizedTxn {
  const amountMinor = extractAmount(message);
  const occurredOn =
    extractDate(message) ?? new Date().toISOString().slice(0, 10);
  const merchant = extractMerchant(message);
  const unparseable = amountMinor == null;

  return {
    occurredOn,
    amountMinor: Math.abs(amountMinor ?? 0),
    currency: defaults.defaultCurrency ?? DEFAULT_CURRENCY,
    type: detectType(message),
    merchant,
    accountRef: defaults.defaultAccountId ?? null,
    cardLabel: extractCardLabel(message),
    source: 'sms',
    sourceRef: `sms:${message.slice(0, 40)}`,
    notes: message,
    scope: 'personal',
    needsReview: unparseable,
    parseError: unparseable ? 'unparseable_sms' : null,
    confidence: unparseable ? 0.2 : 0.7,
  };
}

export class SmsAdapter implements IngestAdapter<SmsAdapterInput> {
  readonly name = 'sms' as const;

  parse(input: SmsAdapterInput): NormalizedTxn[] {
    const chunks = splitMessages(input.text);
    if (chunks.length === 0) {
      return [];
    }
    return chunks.map((chunk) => parseOne(chunk, input));
  }
}
