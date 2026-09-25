import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';
import type { EnergyLevel } from '@/lib/db/schema';

const NARRATE_TIMEOUT_MS = 15_000;

export type NarrationPick = {
  title: string;
  projectName: string | null;
  estimatedMinutes: number | null;
  reasonCodes: string[];
};

export type NarrationContext = {
  minutes: number;
  energy?: EnergyLevel;
  context?: string;
  locale?: 'en' | 'ar';
  picks: NarrationPick[];
  skipped?: { title: string; code: string } | null;
};

function systemPrompt(locale: 'en' | 'ar'): string {
  const language = locale === 'ar' ? 'Arabic' : 'English';
  return [
    'You phrase an already-chosen shortlist of personal tasks.',
    'Do not add, remove, reorder, or replace tasks.',
    'Do not invent reasons, people, or details that are not in the structured list.',
    'Write 2–3 short sentences in ' + language + '.',
    'No names, emails, phone numbers, or medical identifiers.',
  ].join(' ');
}

function userPrompt(input: NarrationContext): string {
  const lines = input.picks.map((pick, index) => {
    const project = pick.projectName ? ` project=${pick.projectName}` : '';
    const minutes =
      pick.estimatedMinutes != null ? ` ${pick.estimatedMinutes}min` : '';
    return `${index + 1}. ${pick.title}${minutes}${project} reasons=${pick.reasonCodes.join('|')}`;
  });
  const skipped = input.skipped
    ? `Skipped (do not recommend): ${input.skipped.title} (${input.skipped.code})`
    : 'No skipped note.';
  return [
    `Window: ${input.minutes} minutes`,
    `Energy: ${input.energy ?? 'unspecified'}`,
    `Context: ${input.context ?? 'unspecified'}`,
    'Chosen tasks (already ranked, do not change):',
    ...lines,
    skipped,
  ].join('\n');
}

export async function narrateTaskSelection(
  input: NarrationContext,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const message = await client.messages.create(
    {
      model,
      max_tokens: 220,
      temperature: 0,
      system: systemPrompt(input.locale === 'ar' ? 'ar' : 'en'),
      messages: [{ role: 'user', content: userPrompt(input) }],
    },
    { timeout: NARRATE_TIMEOUT_MS },
  );

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Narration returned no text.');
  }
  return text;
}
