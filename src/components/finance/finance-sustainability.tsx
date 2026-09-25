'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { fetchHealthScore } from '@/lib/finance/intelligence/actions';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import { HEALTH_SCORE_WEIGHTS } from '@/lib/finance/intelligence/constants';

export function FinanceSustainability() {
  const t = useTranslations('finance.sustainability');
  const locale = useLocale() as AppLocale;

  const query = useQuery({
    queryKey: ['finance-health'],
    queryFn: async () => {
      const result = await fetchHealthScore();
      if (result.error || !result.health) {
        throw new Error(result.error ?? 'failed');
      }
      return result.health;
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!query.data) {
    return <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>;
  }

  const health = query.data;
  const currency = health.currency;

  const metrics = [
    {
      label: t('burnRate'),
      value: formatMoney(health.burnRateMinor, currency, locale),
    },
    {
      label: t('fcf'),
      value: formatMoney(health.freeCashFlowMinor, currency, locale),
    },
    {
      label: t('savingsRate'),
      value:
        health.savingsRatePct != null ? `${health.savingsRatePct}%` : '—',
    },
    {
      label: t('emergency'),
      value: `${formatMoney(health.emergencyFundMinor, currency, locale)} / ${formatMoney(health.emergencyTargetMinor, currency, locale)}`,
    },
    {
      label: t('runway'),
      value:
        health.emergencyRunwayMonths != null
          ? t('runwayMonths', { months: health.emergencyRunwayMonths })
          : '—',
    },
    {
      label: t('recurring'),
      value: formatMoney(health.recurringMonthlyMinor, currency, locale),
    },
    {
      label: t('debt'),
      value: formatMoney(health.debtMinor, currency, locale),
    },
    {
      label: t('investments'),
      value: formatMoney(health.investmentContributionsMinor, currency, locale),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t('scoreTitle')}
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{health.score}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('scoreHint')}</p>
        <ul className="mt-4 space-y-3">
          {health.factors.map((factor) => (
            <li key={factor.code} className="text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{t(`factors.${factor.code}`)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {factor.points} / {Math.round(factor.weight * 100)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.round(factor.score01 * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{factor.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          {t('weights', {
            savings: Math.round(HEALTH_SCORE_WEIGHTS.savingsRate * 100),
            emergency: Math.round(HEALTH_SCORE_WEIGHTS.emergencyRunway * 100),
            burn: Math.round(HEALTH_SCORE_WEIGHTS.burnVsIncome * 100),
            recurring: Math.round(HEALTH_SCORE_WEIGHTS.recurringLoad * 100),
            debt: Math.round(HEALTH_SCORE_WEIGHTS.debtLoad * 100),
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-sm font-medium tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
