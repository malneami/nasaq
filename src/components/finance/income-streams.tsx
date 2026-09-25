'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import type { MoneyBucket } from '@/lib/finance/intelligence/types';
import { MoneyBars } from '@/components/finance/money-bars';

export function IncomeStreams({
  incomeMinor,
  expensesMinor,
  currency,
  byIncomeSource,
  month,
}: {
  incomeMinor: number;
  expensesMinor: number;
  currency: string;
  byIncomeSource: MoneyBucket[];
  month: string;
}) {
  const t = useTranslations('finance.incomeStreams');
  const locale = useLocale() as AppLocale;

  const netMinor = incomeMinor - expensesMinor;
  const hasIncome = byIncomeSource.length > 0;
  const peak = Math.max(1, incomeMinor, expensesMinor);
  const incomeWidth = Math.max(2, Math.round((incomeMinor / peak) * 100));
  const expensesWidth = Math.max(2, Math.round((expensesMinor / peak) * 100));

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">{t('title')}</h3>

      {/* Income vs expenses comparison bars */}
      <div className="bento-card bento-enter space-y-3 p-4" style={{ animationDelay: '0.84s' }}>
        <div>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="text-foreground">{t('income')}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(incomeMinor, currency, locale)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="bento-bar-grow h-full rounded-full"
              style={{
                width: `${incomeWidth}%`,
                background: 'linear-gradient(90deg, #9db497, #5a9a82)',
                animationDelay: '0.9s',
              }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="text-foreground">{t('expenses')}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(expensesMinor, currency, locale)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="bento-bar-grow h-full rounded-full"
              style={{
                width: `${expensesWidth}%`,
                background: 'linear-gradient(90deg, #e8a87c, #d97757)',
                animationDelay: '0.96s',
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm">
          <span className="font-medium">
            {netMinor >= 0 ? t('surplus') : t('deficit')}
          </span>
          <span
            className={
              'font-semibold tabular-nums ' +
              (netMinor >= 0 ? 'text-emerald-600' : 'text-rose-600')
            }
          >
            {formatMoney(Math.abs(netMinor), currency, locale)}
          </span>
        </div>
      </div>

      {/* Income source breakdown */}
      {hasIncome ? (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('bySource')}
          </h4>
          <MoneyBars
            items={byIncomeSource.map((b) => ({
              key: b.key,
              label: `${b.label} · ${formatMoney(b.amountMinor, currency, locale)}`,
              value: b.amountMinor,
            }))}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noIncome')}</p>
      )}
    </section>
  );
}
