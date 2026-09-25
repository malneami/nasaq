import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';

/**
 * Phrase review synthesis from already-computed figures only.
 */
export async function phraseReviewSynthesis(input: {
  kind: 'morning_focus' | 'weekly' | 'monthly';
  figures: Record<string, unknown>;
  locale: 'en' | 'ar';
}): Promise<string> {
  const fallback =
    input.locale === 'ar'
      ? input.kind === 'morning_focus'
        ? 'ركّز على أهم نتائجك ضمن السعة المتاحة، واحمِ الوقت المحمي.'
        : 'راجع الأرقام أعلاه واختر تركيزاً واضحاً للفترة القادمة.'
      : input.kind === 'morning_focus'
        ? 'Protect deep work for your Top 3, and honor protected commitments.'
        : 'Review the figures above and choose a clear focus for the next period.';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    return fallback;
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
    const length =
      input.kind === 'morning_focus'
        ? '2–3 short sentences'
        : 'one short paragraph (3–5 sentences)';
    const message = await client.messages.create(
      {
        model,
        max_tokens: 280,
        temperature: 0,
        system: [
          'You synthesize a personal life OS review.',
          'Use ONLY the figures provided. Do not invent numbers or events.',
          'Do not gamify or urge maximizing every score.',
          'Recommendation only — the user decides.',
          `Write ${length}.`,
          input.locale === 'ar' ? 'Reply in Arabic.' : 'Reply in English.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: JSON.stringify({ kind: input.kind, figures: input.figures }),
          },
        ],
      },
      { timeout: 20_000 },
    );
    const text = message.content.find((b) => b.type === 'text');
    if (text && text.type === 'text' && text.text.trim()) {
      return text.text.trim().slice(0, 600);
    }
  } catch {
    // fall through
  }
  return fallback;
}
