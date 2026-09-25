'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/lib/i18n/navigation';
import { fetchVentureFinance } from '@/lib/finance/intelligence/actions';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';

export function FinanceVentures() {
  const t = useTranslations('finance.ventures');
  const locale = useLocale() as AppLocale;

  const query = useQuery({
    queryKey: ['finance-ventures'],
    queryFn: async () => {
      const result = await fetchVentureFinance();
      if (result.error || !result.ventures) {
        throw new Error(result.error ?? 'failed');
      }
      return result.ventures;
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!query.data) {
    return <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>;
  }

  const rows = [...query.data].sort(
    (a, b) => Math.abs(b.investedMinor) - Math.abs(a.investedMinor),
  );

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('hint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-muted-foreground">
              <th className="py-2 font-medium">{t('name')}</th>
              <th className="py-2 font-medium">{t('stage')}</th>
              <th className="py-2 font-medium">{t('invested')}</th>
              <th className="py-2 font-medium">{t('revenue')}</th>
              <th className="py-2 font-medium">{t('net')}</th>
              <th className="py-2 font-medium">{t('time')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.projectId} className="border-b border-border/60">
                <td className="py-2">
                  <Link
                    href={`/projects/${row.projectId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">{row.stage}</td>
                <td className="py-2 tabular-nums">
                  {formatMoney(row.investedMinor, row.currency, locale)}
                </td>
                <td className="py-2 tabular-nums">
                  {formatMoney(row.revenueMinor, row.currency, locale)}
                </td>
                <td className="py-2 tabular-nums">
                  {formatMoney(row.netMinor, row.currency, locale)}
                </td>
                <td className="py-2 tabular-nums text-muted-foreground">
                  {t('minutes', { count: row.timeInvestedMinutes })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
