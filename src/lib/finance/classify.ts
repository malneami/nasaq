import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';
import type { MoneyScope } from '@/lib/db/schema';
import type { ClassifySuggestion } from '@/lib/finance/types';

const CLASSIFY_TOOL_NAME = 'classify_transaction';

const classifyTxnSchema = z.object({
  category_name: z.string().nullable(),
  category_id: z.string().uuid().nullable().optional(),
  scope: z.enum(['personal', 'family', 'business']),
  confidence: z.number().min(0).max(1),
});

export type ClassifyTxnContext = {
  merchant: string | null;
  amountMinor: number;
  currency: string;
  type: string;
  categories: { id: string; name: string }[];
};

/**
 * Minimal-context AI classification. Never send history, account numbers, or credentials.
 */
export async function classifyTransactionAi(
  context: ClassifyTxnContext,
): Promise<ClassifySuggestion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    return {
      categoryId: null,
      categoryName: null,
      scope: 'personal',
      confidence: 0,
      source: 'none',
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const categoryList = context.categories
    .map((row) => `${row.name} (${row.id})`)
    .join(', ');

  const message = await client.messages.create(
    {
      model,
      max_tokens: 256,
      temperature: 0,
      system: [
        'You categorize a single personal-finance transaction.',
        'AI suggests only. Never invent money movements.',
        'Pick the best matching category from the provided list, or null.',
        'Return confidence between 0 and 1.',
        `Categories: ${categoryList || 'Other'}`,
      ].join('\n'),
      tools: [
        {
          name: CLASSIFY_TOOL_NAME,
          description: 'Suggest a category and scope for one transaction.',
          input_schema: {
            type: 'object',
            additionalProperties: false,
            required: ['category_name', 'scope', 'confidence'],
            properties: {
              category_name: { type: ['string', 'null'] },
              category_id: { type: ['string', 'null'] },
              scope: {
                type: 'string',
                enum: ['personal', 'family', 'business'],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      ],
      tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            merchant: context.merchant,
            amount_minor: context.amountMinor,
            currency: context.currency,
            type: context.type,
          }),
        },
      ],
    },
    { timeout: 20_000 },
  );

  const toolBlock = message.content.find(
    (block) => block.type === 'tool_use' && block.name === CLASSIFY_TOOL_NAME,
  );
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    return {
      categoryId: null,
      categoryName: null,
      scope: 'personal',
      confidence: 0,
      source: 'none',
    };
  }

  const parsed = classifyTxnSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    return {
      categoryId: null,
      categoryName: null,
      scope: 'personal',
      confidence: 0,
      source: 'none',
    };
  }

  const byId = context.categories.find(
    (row) => row.id === parsed.data.category_id,
  );
  const byName = context.categories.find(
    (row) =>
      row.name.toLowerCase() === (parsed.data.category_name ?? '').toLowerCase(),
  );
  const match = byId ?? byName ?? null;

  return {
    categoryId: match?.id ?? null,
    categoryName: match?.name ?? parsed.data.category_name,
    scope: parsed.data.scope as MoneyScope,
    confidence: parsed.data.confidence,
    source: 'ai',
  };
}
