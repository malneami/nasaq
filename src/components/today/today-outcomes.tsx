'use client';

import { useState } from 'react';
import type en from '@/messages/en.json';
import { toast } from 'sonner';
import { StatusPill, TASK_STATUS_TONES } from '@/components/status-pill';
import { TodaySection } from '@/components/today/today-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  confirmTodayOutcomes,
  dismissTodayProposal,
  saveTodayOutcomes,
  suggestTodayOutcomes,
} from '@/lib/today/actions';
import type { DailyFocusItem, TodayOutcomesModel } from '@/lib/today/types';
import type { TaskStatus } from '@/lib/db/schema';

export type TodayMessages = typeof en.today;

type TranslationValues = Record<string, string | number>;

function translate(
  messages: TodayMessages,
  key: string,
  values?: TranslationValues,
): string {
  const message = key
    .split('.')
    .reduce<unknown>((current, part) =>
      current && typeof current === 'object'
        ? (current as Record<string, unknown>)[part]
        : undefined,
    messages);

  if (typeof message !== 'string') return key;

  return values
    ? message.replace(/\{(\w+)\}/g, (_, name: string) =>
        String(values[name] ?? `{${name}}`),
      )
    : message;
}

function OutcomeRow({
  item,
  t,
}: {
  item: DailyFocusItem;
  t: (key: string, values?: TranslationValues) => string;
}) {
  const status =
    item.status && item.status !== 'focus' ? (item.status as TaskStatus) : null;
  return (
    <div>
      <p className="font-medium">{item.text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.projectName ? (
          <StatusPill label={item.projectName} tone="info" />
        ) : null}
        <span>
          {item.estimatedMinutes
            ? t('effort', { minutes: item.estimatedMinutes })
            : t('effortUnknown')}
        </span>
        {item.dueDate ? <span>{item.dueDate}</span> : null}
        {status ? (
          <StatusPill
            label={t(`taskStatus.${status}`)}
            tone={TASK_STATUS_TONES[status]}
          />
        ) : null}
      </div>
    </div>
  );
}

export function TodayOutcomes({
  initial,
  messages,
}: {
  initial: TodayOutcomesModel;
  messages: TodayMessages;
}) {
  const t = (key: string, values?: TranslationValues) =>
    translate(messages, key, values);
  const [confirmed, setConfirmed] = useState(initial.confirmed);
  const [proposal, setProposal] = useState(initial.proposal);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const limit = initial.limit;

  async function persist(items: DailyFocusItem[]) {
    const result = await saveTodayOutcomes({ items });
    if (result.error) {
      toast.error(t('saveFailed'));
      return false;
    }
    if (result.truncated) {
      toast.warning(t('dilutionWarning', { limit }));
    }
    setConfirmed(items.slice(0, limit));
    setProposal(null);
    return true;
  }

  async function onSuggest() {
    setPending(true);
    const result = await suggestTodayOutcomes();
    setPending(false);
    if (result.error || !result.proposal) {
      toast.error(t('suggestFailed'));
      return;
    }
    setProposal(result.proposal);
    toast.message(t('proposalReady'));
  }

  async function onConfirmProposal() {
    if (!proposal?.length) {
      return;
    }
    setPending(true);
    const result = await confirmTodayOutcomes({ items: proposal });
    setPending(false);
    if (result.error) {
      toast.error(t('saveFailed'));
      return;
    }
    setConfirmed(proposal.slice(0, limit));
    setProposal(null);
    toast.success(t('confirmed'));
  }

  function tryAdd(item: DailyFocusItem) {
    if (confirmed.length >= limit) {
      toast.warning(t('dilutionWarning', { limit }));
      return;
    }
    if (confirmed.some((row) => row.id === item.id || (item.taskId && row.taskId === item.taskId))) {
      return;
    }
    void persist([...confirmed, item]);
  }

  function move(index: number, delta: number) {
    const next = [...confirmed];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    void persist(next);
  }

  return (
    <TodaySection title={t('outcomesTitle')}>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {confirmed.length === 0 && !proposal ? (
          <p className="text-sm text-muted-foreground">{t('outcomesEmpty')}</p>
        ) : null}

        {confirmed.length > 0 ? (
          <ol className="space-y-3">
            {confirmed.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <OutcomeRow item={item} t={t} />
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={index === 0 || pending}
                    onClick={() => move(index, -1)}
                  >
                    {t('up')}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={index === confirmed.length - 1 || pending}
                    onClick={() => move(index, 1)}
                  >
                    {t('down')}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      void persist(confirmed.filter((row) => row.id !== item.id))
                    }
                  >
                    {t('remove')}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {proposal && proposal.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3">
            <p className="text-sm font-medium">{t('proposalTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('proposalHint')}</p>
            <ol className="space-y-2">
              {proposal.map((item, index) => (
                <li key={item.id} className="flex gap-3">
                  <span className="text-xs text-muted-foreground">{index + 1}</span>
                  <OutcomeRow item={item} t={t} />
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => void onConfirmProposal()}
              >
                {t('confirmProposal')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  await dismissTodayProposal();
                  setPending(false);
                  setProposal(null);
                }}
              >
                {t('dismissProposal')}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void onSuggest()}
          >
            {t('suggest')}
          </Button>
          <form
            className="flex min-w-48 flex-1 flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) {
                return;
              }
              tryAdd({
                id: crypto.randomUUID(),
                kind: 'text',
                text,
                status: 'focus',
              });
              setDraft('');
            }}
          >
            <Input
              value={draft}
              placeholder={t('manualPlaceholder')}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" size="sm" variant="ghost" disabled={pending}>
              {t('addManual')}
            </Button>
          </form>
        </div>

        {initial.candidates.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('fromNext')}</p>
            <div className="flex flex-wrap gap-1.5">
              {initial.candidates.slice(0, 8).map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={pending}
                  onClick={() => tryAdd(item)}
                >
                  {item.text}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </TodaySection>
  );
}
