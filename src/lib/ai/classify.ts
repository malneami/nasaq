import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import {
  CLASSIFY_TIMEOUT_MS,
  DEFAULT_ANTHROPIC_MODEL,
  classifyToolInputSchema,
  type ClassifyToolInput,
} from '@/lib/inbox/types';

const CLASSIFY_TOOL_NAME = 'classify_inbox_item';

const classifyTool: Anthropic.Tool = {
  name: CLASSIFY_TOOL_NAME,
  description:
    'Classify a captured inbox item into exactly one type and extract only fields that are clearly present.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'type',
      'confidence',
      'title',
      'extracted',
      'needs_confirmation',
    ],
    properties: {
      type: {
        type: 'string',
        enum: [
          'task',
          'idea',
          'project',
          'note',
          'person',
          'follow_up',
          'commitment',
          'expense',
          'income',
          'event',
        ],
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      title: { type: 'string' },
      extracted: {
        type: 'object',
        additionalProperties: false,
        properties: {
          person_name: { type: 'string' },
          project_hint: { type: 'string' },
          due_date_iso: {
            type: 'string',
            description: 'YYYY-MM-DD in the user timezone',
          },
          amount_minor: {
            type: 'integer',
            description: 'Money in minor units (halalas for SAR)',
          },
          currency: { type: 'string' },
          merchant: { type: 'string' },
          category_hint: { type: 'string' },
          direction: { type: 'string', enum: ['i_promised', 'they_promised'] },
          event_start_iso: { type: 'string' },
          event_end_iso: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      needs_confirmation: { type: 'boolean' },
      clarifying_question: { type: 'string' },
    },
  },
};

export type ClassifyContext = {
  rawText: string;
  timezone: string;
  currency: string;
  nowIso: string;
  todayIso: string;
  lifeAreaNames: string[];
  projectNames: string[];
};

function systemPrompt(context: ClassifyContext): string {
  const areas =
    context.lifeAreaNames.length > 0
      ? context.lifeAreaNames.join(', ')
      : '(none yet)';
  const projects =
    context.projectNames.length > 0
      ? context.projectNames.join(', ')
      : '(none yet)';

  return [
    'You are the classification layer of a personal executive system (Nasaq).',
    'AI classifies and suggests; the user decides. You never create records.',
    'Map the input to exactly one type. Extract conservatively.',
    'Never invent amounts, names, dates, or merchants that are not clearly implied.',
    'The input may be Arabic or English. Always return the structured English enum types.',
    'Resolve relative dates like "next week" or "غدًا" against the provided current date and timezone.',
    'Set needs_confirmation=true if the type is unclear OR any key field is missing/ambiguous, and include one clarifying_question.',
    'If a project_hint matches an existing project name, use that exact name.',
    `Current datetime: ${context.nowIso}`,
    `Today: ${context.todayIso}`,
    `Timezone: ${context.timezone || DEFAULT_TIMEZONE}`,
    `Currency: ${context.currency || DEFAULT_CURRENCY}`,
    `Life areas: ${areas}`,
    `Existing projects: ${projects}`,
  ].join('\n');
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  return new Anthropic({ apiKey });
}

export async function classifyInboxText(
  context: ClassifyContext,
): Promise<ClassifyToolInput> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

  const message = await client.messages.create(
    {
      model,
      max_tokens: 1024,
      temperature: 0,
      system: systemPrompt(context),
      tools: [classifyTool],
      tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: context.rawText,
        },
      ],
    },
    { timeout: CLASSIFY_TIMEOUT_MS },
  );

  const toolBlock = message.content.find(
    (block) => block.type === 'tool_use' && block.name === CLASSIFY_TOOL_NAME,
  );

  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Classifier did not return structured output.');
  }

  const parsed = classifyToolInputSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    throw new Error('Classifier returned an invalid schema.');
  }

  const result = parsed.data;
  if (result.needs_confirmation && !result.clarifying_question) {
    result.clarifying_question =
      'What should this become, and which details should I keep?';
  }

  return result;
}
