'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { fetchMonthlyReview } from '@/lib/reviews/actions';

export function MonthlyScorecard() {
  const t = useTranslations('review.monthly');
  const query = useQuery({
    queryKey: ['monthly-review'],
    queryFn: async () => {
      const result = await fetchMonthlyReview();
      if (result.error || !result.review) throw new Error(result.error ?? 'failed');
      return result.review;
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!query.data) {
    return <p className="text-sm text-muted-foreground">{t('failed')}</p>;
  }

  const review = query.data;
  const ns = review.northStar;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('period', { start: review.periodStart, end: review.periodEnd })}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t('notMaximize')}</p>
      </div>

      {review.imbalance.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium">{t('imbalanceTitle')}</p>
          {review.imbalance.map((item) => (
            <p key={item.code} className="text-sm">
              {item.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {review.dimensions.map((dim) => (
          <div
            key={dim.code}
            className="rounded-xl border border-border px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{t(`dims.${dim.code}`)}</p>
              <p className="tabular-nums text-sm text-muted-foreground">
                {Math.round(dim.score01 * 100)}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.round(dim.score01 * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{dim.detail}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/80">
              {dim.derivation}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border px-4 py-4">
        <h3 className="text-sm font-medium">{t('northStarTitle')}</h3>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {ns.percent != null ? `${ns.percent}%` : '—'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{ns.note}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('northStarWeeks', {
            passing: ns.weeksPassing,
            counted: ns.weeksCounted,
          })}
        </p>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li>
            {t('support.strategic')}: {ns.supporting.strategicProgress ?? '—'}
          </li>
          <li>
            {t('support.overdue')}: {ns.supporting.overdueCommitments}
          </li>
          <li>
            {t('support.family')}:{' '}
            {ns.supporting.protectedAdherencePct != null
              ? `${ns.supporting.protectedAdherencePct}%`
              : '—'}
          </li>
          <li>
            {t('support.finance')}: {ns.supporting.financialHealth ?? '—'}
          </li>
          <li>
            {t('support.reviews')}: {ns.supporting.weeklyReviewsCompleted}
          </li>
          <li>
            {t('support.capacity')}:{' '}
            {ns.supporting.capacityUsedPct != null
              ? `${ns.supporting.capacityUsedPct}%`
              : '—'}
          </li>
        </ul>
      </section>

      {review.synthesis ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm leading-relaxed">
          {review.synthesis}
        </p>
      ) : null}
    </div>
  );
}
