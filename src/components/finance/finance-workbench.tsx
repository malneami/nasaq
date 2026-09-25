'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FinanceDashboard } from '@/components/finance/finance-dashboard';
import { FinanceSustainability } from '@/components/finance/finance-sustainability';
import { FinanceVentures } from '@/components/finance/finance-ventures';
import { PersonalCfoPanel } from '@/components/finance/personal-cfo';
import {
  archiveBudget,
  archiveTransaction,
  importCsv,
  importSms,
  listFinanceAccounts,
  listFinanceBudgets,
  listFinanceCategories,
  listFinanceLookups,
  listFinanceTransactions,
  patchTransactionFields,
  quickAddTransaction,
  saveAccount,
  saveBudget,
  type AccountDto,
  type TransactionDto,
} from '@/lib/finance/actions';
import { formatMoney } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import { ACCOUNT_TYPES, MONEY_SCOPES } from '@/lib/validations/finance';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/status-pill';

const ACCOUNTS_KEY = ['finance-accounts'] as const;
const TXNS_KEY = ['finance-transactions'] as const;
const CATS_KEY = ['finance-categories'] as const;
const BUDGETS_KEY = ['finance-budgets'] as const;

const SELECT =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

type Tab =
  | 'overview'
  | 'transactions'
  | 'sustainability'
  | 'ventures'
  | 'cfo'
  | 'accounts'
  | 'import'
  | 'budgets';

const TAB_IDS: Tab[] = [
  'overview',
  'transactions',
  'sustainability',
  'ventures',
  'cfo',
  'accounts',
  'import',
  'budgets',
];

function isTab(value: string | null): value is Tab {
  return Boolean(value && TAB_IDS.includes(value as Tab));
}

type TxnFilterState = {
  fromYmd?: string;
  toYmd?: string;
  type?: string;
  categoryId?: string;
  scope?: string;
  uncategorizedOnly?: boolean;
};

export function FinanceWorkbench() {
  const t = useTranslations('finance');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    isTab(initialTab) ? initialTab : 'overview',
  );
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  });
  const [txnFilters, setTxnFilters] = useState<TxnFilterState>(() => ({
    fromYmd: searchParams.get('fromYmd') ?? undefined,
    toYmd: searchParams.get('toYmd') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    scope: searchParams.get('scope') ?? undefined,
    uncategorizedOnly: searchParams.get('uncategorizedOnly') === '1',
  }));

  useEffect(() => {
    if (isTab(initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const accountsQuery = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => {
      const result = await listFinanceAccounts();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.accounts ?? [];
    },
  });
  const categoriesQuery = useQuery({
    queryKey: CATS_KEY,
    queryFn: async () => {
      const result = await listFinanceCategories();
      return result.categories ?? [];
    },
  });
  const lookupsQuery = useQuery({
    queryKey: ['finance-lookups'],
    queryFn: async () => {
      const result = await listFinanceLookups();
      return result.projects ?? [];
    },
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('tabs.overview') },
    { id: 'transactions', label: t('tabs.transactions') },
    { id: 'sustainability', label: t('tabs.sustainability') },
    { id: 'ventures', label: t('tabs.ventures') },
    { id: 'cfo', label: t('tabs.cfo') },
    { id: 'accounts', label: t('tabs.accounts') },
    { id: 'import', label: t('tabs.import') },
    { id: 'budgets', label: t('tabs.budgets') },
  ];

  return (
    <div className="space-y-6">
      <div className="bento-card flex flex-wrap gap-1 p-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-2xl px-3 py-2 text-sm font-medium transition',
              tab === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <FinanceDashboard
          month={month}
          onMonthChange={setMonth}
          onOpenTransactions={(filters) => {
            setTxnFilters({
              fromYmd: filters.fromYmd,
              toYmd: filters.toYmd,
              type: filters.type,
              categoryId: filters.categoryId,
              scope: filters.scope,
              uncategorizedOnly: filters.uncategorizedOnly === '1',
            });
            setTab('transactions');
          }}
        />
      ) : null}
      {tab === 'transactions' ? (
        <TransactionsPane
          locale={locale}
          accounts={accountsQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          projects={lookupsQuery.data ?? []}
          initialFilters={txnFilters}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: TXNS_KEY });
            void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
          }}
        />
      ) : null}
      {tab === 'sustainability' ? <FinanceSustainability /> : null}
      {tab === 'ventures' ? <FinanceVentures /> : null}
      {tab === 'cfo' ? <PersonalCfoPanel /> : null}
      {tab === 'accounts' ? (
        <AccountsPane
          locale={locale}
          accounts={accountsQuery.data ?? []}
          onChanged={() =>
            void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
          }
        />
      ) : null}
      {tab === 'import' ? (
        <ImportPane
          accounts={accountsQuery.data ?? []}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: TXNS_KEY });
            void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
            setTab('transactions');
          }}
        />
      ) : null}
      {tab === 'budgets' ? (
        <BudgetsPane
          locale={locale}
          categories={categoriesQuery.data ?? []}
        />
      ) : null}
    </div>
  );
}

function TransactionsPane({
  locale,
  accounts,
  categories,
  projects,
  initialFilters,
  onChanged,
}: {
  locale: AppLocale;
  accounts: AccountDto[];
  categories: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  initialFilters?: TxnFilterState;
  onChanged: () => void;
}) {
  const t = useTranslations('finance');
  const [accountId, setAccountId] = useState('all');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(
    Boolean(initialFilters?.uncategorizedOnly),
  );
  const [fromYmd, setFromYmd] = useState(initialFilters?.fromYmd ?? '');
  const [toYmd, setToYmd] = useState(initialFilters?.toYmd ?? '');
  const [scope, setScope] = useState(initialFilters?.scope ?? 'all');
  const [categoryId, setCategoryId] = useState(
    initialFilters?.categoryId ?? 'all',
  );
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [type, setType] = useState<'expense' | 'income'>(
    initialFilters?.type === 'income' ? 'income' : 'expense',
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!initialFilters) return;
    setFromYmd(initialFilters.fromYmd ?? '');
    setToYmd(initialFilters.toYmd ?? '');
    setScope(initialFilters.scope ?? 'all');
    setCategoryId(initialFilters.categoryId ?? 'all');
    setUncategorizedOnly(Boolean(initialFilters.uncategorizedOnly));
  }, [initialFilters]);

  const filters = useMemo(
    () => ({
      accountId: accountId === 'all' ? undefined : accountId,
      needsReviewOnly: needsReviewOnly || undefined,
      uncategorizedOnly: uncategorizedOnly || undefined,
      fromYmd: fromYmd || undefined,
      toYmd: toYmd || undefined,
      scope: scope === 'all' ? undefined : scope,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      type:
        initialFilters?.type === 'income' || initialFilters?.type === 'expense'
          ? initialFilters.type
          : undefined,
    }),
    [
      accountId,
      needsReviewOnly,
      uncategorizedOnly,
      fromYmd,
      toYmd,
      scope,
      categoryId,
      initialFilters?.type,
    ],
  );

  const txnsQuery = useQuery({
    queryKey: [...TXNS_KEY, filters],
    queryFn: async () => {
      const result = await listFinanceTransactions(filters);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.transactions ?? [];
    },
  });

  async function quickAdd() {
    setPending(true);
    try {
      const result = await quickAddTransaction({
        amountMajor: amount,
        merchant,
        type,
        occurredOn: date,
        accountId: accountId === 'all' ? '' : accountId,
      });
      if (result.error) {
        toast.error(t('saveFailed'));
        return;
      }
      setAmount('');
      setMerchant('');
      toast.success(t('saved'));
      onChanged();
      await txnsQuery.refetch();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
        <div className="space-y-1">
          <Label>{t('fields.amount')}</Label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-28"
          />
        </div>
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label>{t('fields.merchant')}</Label>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>
        <select
          className={SELECT}
          value={type}
          onChange={(e) => setType(e.target.value as 'expense' | 'income')}
        >
          <option value="expense">{t('types.expense')}</option>
          <option value="income">{t('types.income')}</option>
        </select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="button" disabled={pending || !amount} onClick={() => void quickAdd()}>
          {t('quickAdd')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={SELECT}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="all">{t('allAccounts')}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          className="h-8 w-auto"
          value={fromYmd}
          onChange={(e) => setFromYmd(e.target.value)}
          aria-label={t('filterFrom')}
        />
        <Input
          type="date"
          className="h-8 w-auto"
          value={toYmd}
          onChange={(e) => setToYmd(e.target.value)}
          aria-label={t('filterTo')}
        />
        <select
          className={SELECT}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="all">{t('allScopes')}</option>
          {MONEY_SCOPES.map((s) => (
            <option key={s} value={s}>
              {t(`scopes.${s}`)}
            </option>
          ))}
        </select>
        <select
          className={SELECT}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="all">{t('allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={needsReviewOnly}
            onChange={(e) => setNeedsReviewOnly(e.target.checked)}
          />
          {t('needsReviewOnly')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={uncategorizedOnly}
            onChange={(e) => setUncategorizedOnly(e.target.checked)}
          />
          {t('uncategorizedOnly')}
        </label>
      </div>

      {txnsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (txnsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyTransactions')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {(txnsQuery.data ?? []).map((txn) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              locale={locale}
              categories={categories}
              projects={projects}
              onChanged={async () => {
                onChanged();
                await txnsQuery.refetch();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TransactionRow({
  txn,
  locale,
  categories,
  projects,
  onChanged,
}: {
  txn: TransactionDto;
  locale: AppLocale;
  categories: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations('finance');
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">
          {txn.merchant || t('noMerchant')}{' '}
          <span className="text-muted-foreground">
            {formatMoney(txn.amountMinor, txn.currency, locale)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {txn.occurredOn} · {txn.accountName} ·{' '}
          {t(`types.${txn.type as 'expense'}`)} ·{' '}
          {t(`sources.${txn.source as 'manual'}`)}
          {txn.cardLabel ? ` · ${txn.cardLabel}` : ''}
        </p>
        {txn.needsReview ? (
          <StatusPill label={t('needsReview')} tone="warning" className="mt-1" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={SELECT}
          value={txn.categoryId ?? ''}
          onChange={(e) =>
            void patchTransactionFields({
              id: txn.id,
              categoryId: e.target.value || null,
            }).then(onChanged)
          }
        >
          <option value="">{t('uncategorized')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          className={SELECT}
          value={txn.scope}
          onChange={(e) =>
            void patchTransactionFields({
              id: txn.id,
              scope: e.target.value as 'personal' | 'family' | 'business',
            }).then(onChanged)
          }
        >
          {MONEY_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {t(`scopes.${scope}`)}
            </option>
          ))}
        </select>
        <select
          className={SELECT}
          value={txn.projectId ?? ''}
          onChange={(e) =>
            void patchTransactionFields({
              id: txn.id,
              projectId: e.target.value || null,
            }).then(onChanged)
          }
        >
          <option value="">{t('noProject')}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => void archiveTransaction(txn.id).then(onChanged)}
        >
          {t('archive')}
        </Button>
      </div>
    </li>
  );
}

function AccountsPane({
  locale,
  accounts,
  onChanged,
}: {
  locale: AppLocale;
  accounts: AccountDto[];
  onChanged: () => void;
}) {
  const t = useTranslations('finance');
  const [name, setName] = useState('');
  const [accountType, setAccountType] =
    useState<(typeof ACCOUNT_TYPES)[number]>('checking');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label>{t('fields.accountName')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <select
          className={SELECT}
          value={accountType}
          onChange={(e) =>
            setAccountType(e.target.value as (typeof ACCOUNT_TYPES)[number])
          }
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`accountTypes.${type}`)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          onClick={() =>
            void saveAccount({
              values: {
                name,
                accountType,
                currency: 'SAR',
                isActive: true,
              },
            }).then((result) => {
              if (result.error) {
                toast.error(t('saveFailed'));
                return;
              }
              setName('');
              toast.success(t('saved'));
              onChanged();
            })
          }
        >
          {t('createAccount')}
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex items-center justify-between px-3 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{account.name}</p>
              <p className="text-xs text-muted-foreground">
                {t(`accountTypes.${account.accountType as 'cash'}`)}
                {!account.isActive ? ` · ${t('inactive')}` : ''}
              </p>
            </div>
            <p className="font-medium">
              {formatMoney(account.balanceMinor, account.currency, locale)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImportPane({
  accounts,
  onDone,
}: {
  accounts: AccountDto[];
  onDone: () => void;
}) {
  const t = useTranslations('finance');
  const [mode, setMode] = useState<'csv' | 'sms'>('csv');
  const [csvText, setCsvText] = useState('');
  const [smsText, setSmsText] = useState('');
  const [dateColumn, setDateColumn] = useState('Date');
  const [amountColumn, setAmountColumn] = useState('Amount');
  const [merchantColumn, setMerchantColumn] = useState('Description');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runImport() {
    setPending(true);
    try {
      const result =
        mode === 'csv'
          ? await importCsv({
              csvText,
              dateColumn,
              amountColumn,
              merchantColumn,
              accountId,
            })
          : await importSms({ text: smsText, accountId });
      if (result.error || !result.summary) {
        toast.error(t('importFailed'));
        return;
      }
      const s = result.summary;
      setSummary(
        t('importSummary', {
          imported: s.imported,
          duplicates: s.duplicates,
          needsReview: s.needsReview,
          failed: s.failed,
        }),
      );
      toast.success(t('importDone'));
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'csv' ? 'default' : 'outline'}
          onClick={() => setMode('csv')}
        >
          {t('csvImport')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'sms' ? 'default' : 'outline'}
          onClick={() => setMode('sms')}
        >
          {t('smsImport')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {mode === 'csv' ? t('csvHint') : t('smsHint')}
      </p>
      <select
        className={SELECT}
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      {mode === 'csv' ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t('mapDate')}</Label>
              <Input value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('mapAmount')}</Label>
              <Input
                value={amountColumn}
                onChange={(e) => setAmountColumn(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('mapMerchant')}</Label>
              <Input
                value={merchantColumn}
                onChange={(e) => setMerchantColumn(e.target.value)}
              />
            </div>
          </div>
          <Textarea
            rows={10}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'Date,Amount,Description\n2026-09-01,25.00,Jarir'}
          />
        </>
      ) : (
        <Textarea
          rows={10}
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder={t('smsPlaceholder')}
        />
      )}
      <Button type="button" disabled={pending} onClick={() => void runImport()}>
        {t('runImport')}
      </Button>
      {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
    </div>
  );
}

function BudgetsPane({
  locale,
  categories,
}: {
  locale: AppLocale;
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations('finance');
  const month = new Date().toISOString().slice(0, 7);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const budgetsQuery = useQuery({
    queryKey: [...BUDGETS_KEY, month],
    queryFn: async () => {
      const result = await listFinanceBudgets(`${month}-01`);
      return result.budgets ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('budgetsHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <select
          className={SELECT}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t('overallBudget')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <Input
          className="w-28"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
        <Button
          type="button"
          onClick={() =>
            void saveBudget({
              values: {
                categoryId,
                amountMajor: amount,
                month: `${month}-01`,
                currency: 'SAR',
              },
            }).then((result) => {
              if (result.error) {
                toast.error(t('saveFailed'));
                return;
              }
              setAmount('');
              void budgetsQuery.refetch();
            })
          }
        >
          {t('saveBudget')}
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {(budgetsQuery.data ?? []).map((budget) => (
          <li
            key={budget.id}
            className="flex items-center justify-between px-3 py-3 text-sm"
          >
            <span>{budget.categoryName ?? t('overallBudget')}</span>
            <div className="flex items-center gap-2">
              <span>
                {formatMoney(budget.amountMinor, budget.currency, locale)}
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() =>
                  void archiveBudget(budget.id).then(() => budgetsQuery.refetch())
                }
              >
                {t('archive')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
