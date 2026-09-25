'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchWeeklyReview, saveWeeklyTop3 } from '@/lib/reviews/actions';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import type { DailyFocusItem } from '@/lib/today/types';
import { cn } from '@/lib/utils';

const STEPS = [
  'outcomes',
  'time',
  'projects',
  'relationships',
  'commitments',
  'family',
  'finance',
  'reflection',
  'nextWeek',
] as const;

export function WeeklyReviewStepper() {
  const t = useTranslations('review.weekly');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [reflection, setReflection] = useState({
    worked: '',
    didnt: '',
    stop: '',
  });
  const [top3, setTop3] = useState<DailyFocusItem[]>([]);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: ['weekly-review'],
    queryFn: async () => {
      const result = await fetchWeeklyReview();
      if (result.error || !result.review) throw new Error(result.error ?? 'failed');
      return result.review;
    },
  });

  const review = query.data;

  useEffect(() => {
    if (!review || hydrated) return;
    if (review.confirmedTop3?.length) {
      setTop3(review.confirmedTop3);
    } else if (review.proposedTop3?.length) {
      setTop3(review.proposedTop3);
    }
    if (review.reflection) {
      setReflection(review.reflection);
    }
    setHydrated(true);
  }, [review, hydrated]);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!review) {
    return <p className="text-sm text-muted-foreground">{t('failed')}</p>;
  }

  const key = STEPS[step];

  async function confirm() {
    if (!review) return;
    setPending(true);
    try {
      const result = await saveWeeklyTop3({
        periodStart: review.periodStart,
        items: top3.slice(0, 3).filter((x) => x?.text?.trim()),
        reflection,
      });
      if (result.error) {
        toast.error(t('failed'));
        return;
      }
      toast.success(t('confirmed'));
      void queryClient.invalidateQueries({ queryKey: ['weekly-review'] });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('period', { start: review.periodStart, end: review.periodEnd })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('durationHint')}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              i === step
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {t(`steps.${s}`)}
          </button>
        ))}
      </div>

      <div className="min-h-[12rem] rounded-xl border border-border p-4">
        {key === 'outcomes' ? (
          <Section title={t('steps.outcomes')}>
            {review.outcomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {review.outcomes.map((o, i) => (
                  <li key={`${o.text}-${i}`}>{o.text}</li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {key === 'time' ? (
          <Section title={t('steps.time')}>
            <p className="text-sm">
              {t('capacityUsed', {
                productive: review.time.productiveHours,
                free: review.time.freeHours,
              })}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {review.time.byProject.map((p) => (
                <li key={p.name}>
                  {p.name}: {p.minutes} min
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {key === 'projects' ? (
          <Section title={t('steps.projects')}>
            <p className="text-xs font-medium text-muted-foreground">
              {t('progressed')}
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {review.projects.progressed.map((p) => (
                <li key={p.id}>
                  {p.name} · {p.stage} · {p.progress}%
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              {t('blocked')}
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {review.projects.blocked.map((p) => (
                <li key={p.id}>
                  {p.name} · {t(`blockReason.${p.reason}` as 'blockReason.waiting')}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {key === 'relationships' ? (
          <Section title={t('steps.relationships')}>
            {review.relationships.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {review.relationships.map((r) => (
                  <li key={`${r.name}-${r.dueYmd}`}>
                    {r.name}
                    {r.staleDays != null ? ` · ${t('stale', { days: r.staleDays })}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {key === 'commitments' ? (
          <Section title={t('steps.commitments')}>
            {review.commitments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {review.commitments.map((c, i) => (
                  <li key={`${c.description}-${i}`}>
                    {c.description} · {c.direction}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {key === 'family' ? (
          <Section title={t('steps.family')}>
            <p className="text-sm">
              {t('familyAdherence', {
                scheduled: review.family.protectedHoursScheduled,
                held: review.family.protectedHoursHeld,
                pct: review.family.adherencePct ?? '—',
              })}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t('familyFirstClass')}</p>
          </Section>
        ) : null}

        {key === 'finance' ? (
          <Section title={t('steps.finance')}>
            {review.finance ? (
              <p className="text-sm">
                {t('financeLine', {
                  income: formatMoney(
                    review.finance.incomeMinor,
                    review.finance.currency,
                    locale,
                  ),
                  expenses: formatMoney(
                    review.finance.expensesMinor,
                    review.finance.currency,
                    locale,
                  ),
                  net: formatMoney(
                    review.finance.netMinor,
                    review.finance.currency,
                    locale,
                  ),
                })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            )}
          </Section>
        ) : null}

        {key === 'reflection' ? (
          <Section title={t('steps.reflection')}>
            <div className="space-y-3">
              <div>
                <Label>{t('worked')}</Label>
                <Textarea
                  value={reflection.worked}
                  onChange={(e) =>
                    setReflection((r) => ({ ...r, worked: e.target.value }))
                  }
                  rows={2}
                />
              </div>
              <div>
                <Label>{t('didnt')}</Label>
                <Textarea
                  value={reflection.didnt}
                  onChange={(e) =>
                    setReflection((r) => ({ ...r, didnt: e.target.value }))
                  }
                  rows={2}
                />
              </div>
              <div>
                <Label>{t('stop')}</Label>
                <Textarea
                  value={reflection.stop}
                  onChange={(e) =>
                    setReflection((r) => ({ ...r, stop: e.target.value }))
                  }
                  rows={2}
                />
              </div>
            </div>
          </Section>
        ) : null}

        {key === 'nextWeek' ? (
          <Section title={t('steps.nextWeek')}>
            <p className="mb-2 text-xs text-muted-foreground">{t('top3Hint')}</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="mb-2">
                <Label>{t('outcomeN', { n: i + 1 })}</Label>
                <Input
                  value={top3[i]?.text ?? ''}
                  onChange={(e) => {
                    const next = [...top3];
                    next[i] = {
                      id: next[i]?.id ?? `w-${i}`,
                      kind: 'text',
                      text: e.target.value,
                    };
                    setTop3(next);
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              className="mt-2"
              disabled={pending || top3.filter((x) => x?.text?.trim()).length === 0}
              onClick={() => void confirm()}
            >
              {pending ? t('saving') : t('confirmTop3')}
            </Button>
          </Section>
        ) : null}
      </div>

      {review.synthesis ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm leading-relaxed">
          {review.synthesis}
        </p>
      ) : null}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          {t('prev')}
        </Button>
        <Button
          type="button"
          disabled={step >= STEPS.length - 1}
          onClick={() => setStep((s) => s + 1)}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}
