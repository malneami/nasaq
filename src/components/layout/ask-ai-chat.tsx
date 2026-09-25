'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { ProposalCard } from '@/components/layout/proposal-card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  askChiefOfStaff,
  askDecisionEngine,
} from '@/lib/chief-of-staff/actions';
import type { CosChatMessage, CosProposal } from '@/lib/chief-of-staff/types';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'focusToday',
  'twoHours',
  'projectTime',
  'followUps',
  'overdueCommitments',
  'moneyWent',
] as const;

export function AskAIChat({
  initialDemand,
}: {
  initialDemand?: string;
}) {
  const t = useTranslations('askAi');
  const [messages, setMessages] = useState<CosChatMessage[]>([]);
  const [input, setInput] = useState(initialDemand ?? '');
  const [decisionMode, setDecisionMode] = useState(Boolean(initialDemand));
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || pending) return;

    const userMsg: CosChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setPending(true);

    try {
      const result = decisionMode
        ? await askDecisionEngine({ demand: text })
        : await askChiefOfStaff({
            message: text,
            history: messages,
          });

      if (result.error) {
        toast.error(t('errors.failed'));
        return;
      }

      const assistant: CosChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.reply ?? '',
        proposals: (result.proposals ?? []) as CosProposal[],
        clarifyingQuestion: result.clarifyingQuestion,
        createdAt: new Date().toISOString(),
      };
      setMessages([...nextHistory, assistant]);
      setDecisionMode(false);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' }),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t('principle')}</p>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pending}
            onClick={() => void send(t(`suggestions.${key}`))}
          >
            {t(`suggestions.${key}`)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={decisionMode ? 'default' : 'outline'}
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => setDecisionMode((v) => !v)}
        >
          {t('decisionMode')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
        ) : null}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              msg.role === 'user'
                ? 'ms-6 bg-primary/10'
                : 'me-6 bg-background',
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.clarifyingQuestion && msg.clarifyingQuestion !== msg.content ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {msg.clarifyingQuestion}
              </p>
            ) : null}
            {msg.proposals?.length ? (
              <div className="mt-3 space-y-2">
                {msg.proposals.map((p) => (
                  <ProposalCard key={p.id ?? p.title} proposal={p} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t('thinking')}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2">
        {decisionMode ? (
          <p className="text-xs text-muted-foreground">{t('decisionHint')}</p>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              decisionMode ? t('decisionPlaceholder') : t('placeholder')
            }
            rows={2}
            className="min-h-[2.75rem] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={pending || !input.trim()}
            onClick={() => void send()}
            aria-label={t('send')}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
