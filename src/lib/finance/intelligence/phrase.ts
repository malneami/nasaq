import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';
import type { DailyFinanceBrief } from '@/lib/finance/intelligence/types';

/**
 * Phrase a one-sentence insight from already-computed figures.
 * AI never invents numbers.
 */
export async function phraseFinanceInsight(
  figures: DailyFinanceBrief['insightFigures'],
  locale: 'en' | 'ar' = 'en',
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    return fallbackInsight(figures, locale);
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
    const message = await client.messages.create(
      {
        model,
        max_tokens: 120,
        temperature: 0,
        system: [
          'You write ONE short sentence describing personal spending figures.',
          'Use ONLY the numbers provided. Do not invent, round creatively, or advise investments.',
          'Do not recommend products or trading. Descriptive only.',
          locale === 'ar' ? 'Reply in Arabic.' : 'Reply in English.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: JSON.stringify(figures),
          },
        ],
      },
      { timeout: 15_000 },
    );
    const text = message.content.find((b) => b.type === 'text');
    if (text && text.type === 'text' && text.text.trim()) {
      return text.text.trim().slice(0, 280);
    }
  } catch {
    // fall through
  }
  return fallbackInsight(figures, locale);
}

function fallbackInsight(
  figures: DailyFinanceBrief['insightFigures'],
  locale: 'en' | 'ar',
): string {
  const budget = figures.budgetUsedPercent;
  if (typeof budget === 'number') {
    return locale === 'ar'
      ? `إنفاق الشهر عند ${budget}% من الميزانية حتى الآن.`
      : `Month-to-date spending is at ${budget}% of your budget.`;
  }
  if (typeof figures.monthSpendMinor === 'number') {
    return locale === 'ar'
      ? 'تم حساب إنفاق الشهر من معاملاتك المسجّلة.'
      : 'Month spending is computed from your recorded transactions.';
  }
  return locale === 'ar'
    ? 'أضف معاملات أكثر لرؤية رؤى أوضح.'
    : 'Add a few more transactions to unlock clearer insights.';
}
