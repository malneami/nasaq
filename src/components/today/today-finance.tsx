import { getLocale, getTranslations } from 'next-intl/server';
import { TodaySection } from '@/components/today/today-section';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import type { TodayFinanceModel } from '@/lib/today/types';

export async function TodayFinance({ finance }: { finance: TodayFinanceModel }) {
  const t = await getTranslations('today');
  const locale = (await getLocale()) as AppLocale;

  return (
    <TodaySection title={t('financeTitle')} href="/finance" hrefLabel={t('openFinance')}>
      {finance.empty ? (
        <p className="text-sm text-muted-foreground">{t('financeEmpty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bento-card p-3" style={{ background: '#fffdf9' }}>
            <p className="text-xs text-muted-foreground">{t('spendToday')}</p>
            <p className="mt-1 font-medium">
              {formatMoney(finance.spendingTodayMinor, finance.currency, locale)}
            </p>
          </div>
          <div className="bento-card p-3" style={{ background: '#e8e0d5' }}>
            <p className="text-xs text-muted-foreground">{t('spendMonth')}</p>
            <p className="mt-1 font-medium">
              {formatMoney(finance.spendingMonthMinor, finance.currency, locale)}
            </p>
          </div>
          <div className="bento-card p-3" style={{ background: '#dce5d7' }}>
            <p className="text-xs text-muted-foreground">{t('budgetStatus')}</p>
            <p className="mt-1 font-medium">
              {finance.budgetUsedPercent != null
                ? t('budgetUsed', { percent: finance.budgetUsedPercent })
                : t('noBudget')}
            </p>
          </div>
          <div className="bento-card p-3" style={{ background: '#f0e9df' }}>
            <p className="text-xs text-muted-foreground">{t('alerts')}</p>
            <p className="mt-1 font-medium">
              {t('alertCounts', {
                unclassified: finance.unclassifiedCount,
                unusual: finance.unusualCount,
              })}
            </p>
          </div>
          {finance.briefInsight ? (
            <div className="col-span-2 bento-card p-3" style={{ background: '#e6ede1' }}>
              <p className="text-xs text-muted-foreground">{t('briefInsight')}</p>
              <p className="mt-1 text-sm">{finance.briefInsight}</p>
            </div>
          ) : null}
        </div>
      )}
    </TodaySection>
  );
}
