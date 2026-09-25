'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/lib/i18n/navigation';
import {
  fetchDailyFinanceBrief,
  fetchMonthlyFinanceSummary,
} from '@/lib/finance/intelligence/actions';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import { daysInMonth } from '@/lib/finance/intelligence/summary';
import { MoneyBars, TrendBars } from '@/components/finance/money-bars';
import { IncomeStreams } from '@/components/finance/income-streams';
import { Button } from '@/components/ui/button';

function monthEnd(monthYmd: string) {
  const d = daysInMonth(monthYmd);
  return `${monthYmd.slice(0, 7)}-${String(d).padStart(2, '0')}`;
}

function shiftMonth(monthYmd: string, delta: number) {
  const y = Number(monthYmd.slice(0, 4));
  const m = Number(monthYmd.slice(5, 7)) - 1 + delta;
  const date = new Date(Date.UTC(y, m, 1));
  return date.toISOString().slice(0, 10);
}

function txnHref(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  q.set('tab', 'transactions');
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  return `/finance?${q.toString()}`;
}

export function FinanceDashboard({
  month,
  onMonthChange,
  onOpenTransactions,
}: {
  month: string;
  onMonthChange: (monthYmd: string) => void;
  onOpenTransactions: (filters: Record<string, string>) => void;
}) {
  const t = useTranslations('finance.dashboard');
  const tFinance = useTranslations('finance');
  const locale = useLocale() as AppLocale;

  const summaryQuery = useQuery({
    queryKey: ['finance-summary', month],
    queryFn: async () => {
      const result = await fetchMonthlyFinanceSummary(month);
      if (result.error || !result.summary) {
        throw new Error(result.error ?? 'failed');
      }
      return result.summary;
    },
  });

  const briefQuery = useQuery({
    queryKey: ['finance-brief'],
    queryFn: async () => {
      const result = await fetchDailyFinanceBrief();
      return result.brief ?? null;
    },
  });

  const summary = summaryQuery.data;
  const brief = briefQuery.data;
  const currency = summary?.currency ?? 'SAR';
  const fromYmd = month;
  const toYmd = monthEnd(month);

  if (summaryQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }
  if (!summary) {
    return <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>;
  }

  const metrics = [
    {
      key: 'income',
      label: t('income'),
      value: summary.incomeMinor,
      href: txnHref({ fromYmd, toYmd, type: 'income' }),
    },
    {
      key: 'expenses',
      label: t('expenses'),
      value: summary.expensesMinor,
      href: txnHref({ fromYmd, toYmd, type: 'expense' }),
    },
    {
      key: 'net',
      label: t('net'),
      value: summary.netCashFlowMinor,
      href: txnHref({ fromYmd, toYmd }),
    },
    {
      key: 'savings',
      label: t('savings'),
      value: summary.savingsMinor,
      href: txnHref({ fromYmd, toYmd }),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            {t('prevMonth')}
          </Button>
          <p className="min-w-[8rem] text-center text-sm font-medium tabular-nums">
            {month.slice(0, 7)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          >
            {t('nextMonth')}
          </Button>
        </div>
        {summary.savingsRatePct != null ? (
          <p className="text-sm text-muted-foreground">
            {t('savingsRate', { rate: summary.savingsRatePct })}
          </p>
        ) : null}
      </div>

      {brief ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('briefTitle')}
          </p>
          {!brief.enoughData ? (
            <p className="mt-1 text-sm text-muted-foreground">{t('briefEmpty')}</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                {t('briefSpendToday', {
                  amount: formatMoney(brief.spendTodayMinor, brief.currency, locale),
                })}
                {brief.largestToday
                  ? ` · ${t('briefLargest', {
                      merchant: brief.largestToday.merchant ?? '—',
                      amount: formatMoney(
                        brief.largestToday.amountMinor,
                        brief.currency,
                        locale,
                      ),
                    })}`
                  : ''}
              </p>
              <p className="text-muted-foreground">
                {t('briefMonth', {
                  amount: formatMoney(brief.monthSpendMinor, brief.currency, locale),
                  budget:
                    brief.budgetUsedPercent != null
                      ? `${brief.budgetUsedPercent}%`
                      : '—',
                })}
              </p>
              {brief.insight ? (
                <p className="font-medium text-foreground">{brief.insight}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            className="rounded-xl border border-border px-4 py-3 text-start transition hover:bg-muted/40"
            onClick={() =>
              onOpenTransactions({
                fromYmd,
                toYmd,
                ...(m.key === 'income' ? { type: 'income' } : {}),
                ...(m.key === 'expenses' ? { type: 'expense' } : {}),
              })
            }
          >
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatMoney(m.value, currency, locale)}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-sm font-medium">{t('byCategory')}</h3>
          <MoneyBars
            items={summary.byCategory.slice(0, 8).map((b) => ({
              key: b.key,
              label: `${b.label} · ${formatMoney(b.amountMinor, currency, locale)}`,
              value: b.amountMinor,
              href: txnHref({
                fromYmd,
                toYmd,
                categoryId: b.key === 'uncategorized' ? undefined : b.key,
                uncategorizedOnly:
                  b.key === 'uncategorized' ? '1' : undefined,
              }),
            }))}
          />
        </section>
        <section>
          <h3 className="mb-3 text-sm font-medium">{t('byScope')}</h3>
          <MoneyBars
            items={summary.byScope.map((b) => ({
              key: b.key,
              label: `${tFinance(`scopes.${b.key}` as 'scopes.personal')} · ${formatMoney(b.amountMinor, currency, locale)}`,
              value: b.amountMinor,
              href: txnHref({ fromYmd, toYmd, scope: b.key }),
            }))}
          />
          <h3 className="mb-3 mt-6 text-sm font-medium">{t('fixedVariable')}</h3>
          <MoneyBars
            items={summary.byFixedVariable.map((b) => ({
              key: b.key,
              label: `${t(b.key === 'fixed' ? 'fixed' : 'variable')} · ${formatMoney(b.amountMinor, currency, locale)}`,
              value: b.amountMinor,
            }))}
          />
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium">{t('budgetTitle')}</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          {t('projectionNote', {
            days: summary.daysElapsed,
            total: summary.daysInMonth,
          })}
        </p>
        {summary.budget.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noBudget')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-muted-foreground">
                  <th className="py-2 font-medium">{t('category')}</th>
                  <th className="py-2 font-medium">{t('budget')}</th>
                  <th className="py-2 font-medium">{t('actual')}</th>
                  <th className="py-2 font-medium">{t('remaining')}</th>
                  <th className="py-2 font-medium">{t('projected')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.budget.map((row) => (
                  <tr
                    key={row.categoryId ?? 'overall'}
                    className="border-b border-border/60"
                  >
                    <td className="py-2">
                      <Link
                        href={txnHref({
                          fromYmd,
                          toYmd,
                          categoryId: row.categoryId ?? undefined,
                        })}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.categoryName}
                      </Link>
                    </td>
                    <td className="py-2 tabular-nums">
                      {formatMoney(row.budgetMinor, currency, locale)}
                    </td>
                    <td className="py-2 tabular-nums">
                      {formatMoney(row.actualMinor, currency, locale)}
                    </td>
                    <td className="py-2 tabular-nums">
                      {formatMoney(row.remainingMinor, currency, locale)}
                    </td>
                    <td className="py-2 tabular-nums text-muted-foreground">
                      {formatMoney(row.projectedMonthEndMinor, currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {t('projectedTotal', {
            amount: formatMoney(
              summary.projectedMonthEndMinor,
              currency,
              locale,
            ),
          })}
        </p>
      </section>

      <IncomeStreams
        incomeMinor={summary.incomeMinor}
        expensesMinor={summary.expensesMinor}
        currency={currency}
        byIncomeSource={summary.byIncomeSource}
        month={month}
      />

      <section>
        <h3 className="mb-3 text-sm font-medium">{t('trendTitle')}</h3>
        <TrendBars
          items={summary.momTrend.map((row) => ({
            key: row.monthYmd,
            label: row.monthYmd.slice(0, 7),
            value: row.expensesMinor,
          }))}
        />
      </section>
    </div>
  );
}
