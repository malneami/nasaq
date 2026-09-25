'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/lib/i18n/navigation';
import { fetchMorningBrief } from '@/lib/reviews/actions';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';

export function MorningBriefView() {
  const t = useTranslations('review.morning');
  const locale = useLocale() as AppLocale;
  const query = useQuery({
    queryKey: ['morning-brief'],
    queryFn: async () => {
      const result = await fetchMorningBrief();
      if (result.error || !result.brief) throw new Error(result.error ?? 'failed');
      return result.brief;
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!query.data) {
    return <p className="text-sm text-muted-foreground">{t('failed')}</p>;
  }

  const b = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <Link href="/today" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          {t('openToday')}
        </Link>
      </div>

      <section className="rounded-xl border border-border px-4 py-3">
        <h3 className="text-sm font-medium">{t('calendar')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {b.shiftTitle ? t('shift', { title: b.shiftTitle }) : t('noShift')}
          {' · '}
          {t('capacity', { hours: b.productiveHours })}
        </p>
        {b.schedule.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('noEvents')}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {b.schedule.map((e) => (
              <li key={`${e.startsAt}-${e.title}`}>
                {e.title}
                {e.isProtected ? ` · ${t('protected')}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border px-4 py-3">
        <h3 className="text-sm font-medium">{t('top3')}</h3>
        {b.top3.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('noTop3')}</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm">
            {b.top3.map((o) => (
              <li key={o.id}>{o.text}</li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-border px-4 py-3">
          <h3 className="text-sm font-medium">{t('followUps')}</h3>
          {b.followUps.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {b.followUps.map((f) => (
                <li key={`${f.name}-${f.dueYmd}`}>{f.name}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-border px-4 py-3">
          <h3 className="text-sm font-medium">{t('family')}</h3>
          {b.protectedCommitments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {b.protectedCommitments.map((c) => (
                <li key={`${c.startsAt}-${c.title}`}>{c.title}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border px-4 py-3">
        <h3 className="text-sm font-medium">{t('finance')}</h3>
        <p className="mt-2 text-sm">
          {t('spendToday')}:{' '}
          {formatMoney(b.finance.spendTodayMinor, b.finance.currency, locale)}
          {' · '}
          {t('spendMonth')}:{' '}
          {formatMoney(b.finance.spendMonthMinor, b.finance.currency, locale)}
        </p>
        {b.finance.insight ? (
          <p className="mt-1 text-sm text-muted-foreground">{b.finance.insight}</p>
        ) : null}
      </section>

      {b.attention.length > 0 ? (
        <section className="rounded-xl border border-border px-4 py-3">
          <h3 className="text-sm font-medium">{t('attention')}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {b.attention.map((a, i) => (
              <li key={`${a.detail}-${i}`}>{a.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
        <h3 className="text-sm font-medium">{t('recommended')}</h3>
        <p className="mt-2 text-sm leading-relaxed">{b.recommendedFocus}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t('recommendationOnly')}</p>
      </section>
    </div>
  );
}
