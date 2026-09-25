import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';

const ADVICE_PATTERN =
  /invest|trading|stock|crypto|portfolio advice|financial plan|should i buy|توصية استثمار|أسهم|تداول|خطة مالية/i;

export function isInvestmentAdviceQuestion(question: string): boolean {
  return ADVICE_PATTERN.test(question);
}

/**
 * Phrase a CFO answer from precomputed aggregates only.
 */
export async function phraseCfoAnswer(input: {
  question: string;
  aggregates: Record<string, unknown>;
  locale?: 'en' | 'ar';
}): Promise<{ answer: string; declined: boolean }> {
  const locale = input.locale ?? 'en';
  if (isInvestmentAdviceQuestion(input.question)) {
    return {
      declined: true,
      answer:
        locale === 'ar'
          ? 'أداة المدير المالي تصف إنفاقك المسجّل فقط ولا تقدّم نصائح استثمار أو تداول. اسأل مثلاً: أين ذهب المال هذا الشهر؟'
          : 'Personal CFO describes your recorded spending only and cannot advise on investments or trading. Try asking where your money went this month.',
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    return {
      declined: false,
      answer: deterministicFallback(input.question, input.aggregates, locale),
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
    const message = await client.messages.create(
      {
        model,
        max_tokens: 500,
        temperature: 0,
        system: [
          'You are a descriptive Personal CFO for Nasaq.',
          'Explain ONLY the computed aggregates provided. Never invent figures.',
          'Never give investment, trading, or financial-planning advice.',
          'Amounts are integer minor units (halalas for SAR); mention major units clearly when helpful.',
          locale === 'ar' ? 'Answer in Arabic.' : 'Answer in English.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              question: input.question,
              aggregates: input.aggregates,
            }),
          },
        ],
      },
      { timeout: 25_000 },
    );
    const text = message.content.find((b) => b.type === 'text');
    if (text && text.type === 'text' && text.text.trim()) {
      return { declined: false, answer: text.text.trim() };
    }
  } catch {
    // fall through
  }

  return {
    declined: false,
    answer: deterministicFallback(input.question, input.aggregates, locale),
  };
}

function deterministicFallback(
  question: string,
  aggregates: Record<string, unknown>,
  locale: 'en' | 'ar',
): string {
  const q = question.toLowerCase();
  if (q.includes('subscription') || q.includes('اشتراك')) {
    const subs = aggregates.subscriptions;
    return locale === 'ar'
      ? `الاشتراكات المكتشفة: ${JSON.stringify(subs)}`
      : `Detected subscriptions: ${JSON.stringify(subs)}`;
  }
  if (q.includes('where') || q.includes('أين') || q.includes('went')) {
    return locale === 'ar'
      ? `ملخص الشهر: ${JSON.stringify(aggregates.summary)}`
      : `Month summary: ${JSON.stringify(aggregates.summary)}`;
  }
  return locale === 'ar'
    ? `الأرقام المحسوبة: ${JSON.stringify(aggregates)}`
    : `Computed figures: ${JSON.stringify(aggregates)}`;
}
