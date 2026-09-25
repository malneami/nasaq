'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { askPersonalCfo } from '@/lib/finance/intelligence/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const SUGGESTIONS = [
  'whereDidMoneyGo',
  'subscriptions',
  'ventures',
  'monthEnd',
] as const;

export function PersonalCfoPanel() {
  const t = useTranslations('finance.cfo');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [pending, setPending] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setPending(true);
    setAnswer(null);
    setDeclined(false);
    try {
      const result = await askPersonalCfo(trimmed);
      if (result.error) {
        toast.error(t('failed'));
        return;
      }
      setAnswer(result.answer ?? null);
      setDeclined(Boolean(result.declined));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('hint')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const text = t(`suggestions.${key}`);
              setQuestion(text);
              void ask(text);
            }}
          >
            {t(`suggestions.${key}`)}
          </Button>
        ))}
      </div>
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t('placeholder')}
        rows={3}
      />
      <Button
        type="button"
        disabled={pending || !question.trim()}
        onClick={() => void ask(question)}
      >
        {pending ? t('asking') : t('ask')}
      </Button>
      {answer ? (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            declined
              ? 'border border-amber-500/40 bg-amber-500/10'
              : 'bg-muted/40'
          }`}
        >
          <p className="whitespace-pre-wrap">{answer}</p>
        </div>
      ) : null}
    </div>
  );
}
