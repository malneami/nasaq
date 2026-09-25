import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_CURRENCY } from '@/lib/constants';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';
import type { NormalizedTxn } from '@/lib/finance/types';
import type { TransactionType } from '@/lib/db/schema';

const STATEMENT_TIMEOUT_MS = 60_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME: Record<string, 'image' | 'document' | 'text'> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'application/pdf': 'document',
  'text/csv': 'text',
  'text/plain': 'text',
  'application/csv': 'text',
};

export type ExtractedTxn = {
  date: string;
  amount: string;
  merchant: string;
  type: string;
  description?: string;
};

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = [
  'You are a financial statement parser for Nasaq, a personal life OS.',
  'Extract every transaction from the provided bank statement or financial file.',
  'Return ONLY a JSON object with a "transactions" array — no prose, no markdown.',
  'Each transaction must have: date (YYYY-MM-DD), amount (string, positive number in major units e.g. "45.00"), merchant (string), type (one of: expense, income, transfer, refund, withdrawal, deposit, fee), description (optional string).',
  'If a transaction has no clear merchant, use the description or "Unknown".',
  'Determine type from context: purchases/payments are "expense", deposits/salary are "income", transfers are "transfer", fees are "fee", refunds are "refund", withdrawals are "withdrawal".',
  'Handle Arabic and Western numerals. Convert all dates to YYYY-MM-DD.',
  'Never invent transactions that are not in the document.',
].join('\n');

export async function extractTransactionsFromFile(input: {
  base64Data: string;
  mimeType: string;
  fileName: string;
}): Promise<ExtractedTxn[]> {
  const kind = ALLOWED_MIME[input.mimeType];
  if (!kind) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }

  if (Buffer.from(input.base64Data, 'base64').length > MAX_FILE_BYTES) {
    throw new Error('File too large (max 10 MB).');
  }

  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

  let content: Anthropic.ContentBlockParam[];

  if (kind === 'text') {
    const text = Buffer.from(input.base64Data, 'base64').toString('utf-8');
    content = [
      {
        type: 'text',
        text: `Extract all transactions from this financial file (${input.fileName}):\n\n${text}`,
      },
    ];
  } else if (kind === 'image') {
    content = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.mimeType as
            | 'image/png'
            | 'image/jpeg'
            | 'image/webp'
            | 'image/gif',
          data: input.base64Data,
        },
      },
      {
        type: 'text',
        text: `Extract all transactions from this bank statement image (${input.fileName}). Return only the JSON object.`,
      },
    ];
  } else {
    // PDF document
    content = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: input.base64Data,
        },
      },
      {
        type: 'text',
        text: `Extract all transactions from this bank statement PDF (${input.fileName}). Return only the JSON object.`,
      },
    ];
  }

  const message = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    },
    { timeout: STATEMENT_TIMEOUT_MS },
  );

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI did not return text output.');
  }

  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as { transactions?: ExtractedTxn[] };
  if (!Array.isArray(parsed.transactions)) {
    throw new Error('AI response missing transactions array.');
  }

  return parsed.transactions;
}

export function toNormalizedTxns(
  extracted: ExtractedTxn[],
  accountId?: string,
  currency: string = DEFAULT_CURRENCY,
): NormalizedTxn[] {
  return extracted.map((txn, i) => {
    const amount = parseFloat(txn.amount.replace(/,/g, ''));
    const amountMinor = Math.round(Math.abs(amount || 0) * 100);

    const validTypes: TransactionType[] = [
      'expense',
      'income',
      'transfer',
      'refund',
      'withdrawal',
      'deposit',
      'fee',
    ];
    const type = validTypes.includes(txn.type as TransactionType)
      ? (txn.type as TransactionType)
      : 'expense';

    return {
      occurredOn: txn.date,
      amountMinor,
      currency,
      type,
      merchant: txn.merchant || null,
      accountRef: accountId ?? null,
      source: 'api',
      sourceRef: `file:${i}`,
      notes: txn.description ?? null,
      scope: 'personal',
      needsReview: true,
    };
  });
}
