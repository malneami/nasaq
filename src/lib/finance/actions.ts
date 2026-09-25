'use server';

import { requireUserId } from '@/lib/auth/session';
import { DEFAULT_CURRENCY } from '@/lib/constants';
import {
  createAccount,
  createBudget,
  deleteBudget,
  deleteTransaction,
  getAccount,
  getBudgetsForMonth,
  getTransaction,
  listAccounts,
  listBudgets,
  listTransactionCategories,
  listTransactions,
  sumAccountBalance,
  updateAccount,
  updateBudget,
  updateTransaction,
  upsertMerchantRule,
  type TransactionFilters,
} from '@/lib/db/queries/finance';
import { createAuditLog } from '@/lib/db/queries/system';
import { listProjects } from '@/lib/db/queries/projects';
import { ingest } from '@/lib/finance/engine';
import { normalizeMerchant } from '@/lib/finance/merchant';
import { getSpendMonth, getSpendToday } from '@/lib/finance/spend';
import { toMinor } from '@/lib/money';
import type { IngestSummary } from '@/lib/finance/types';
import {
  accountFormSchema,
  budgetFormSchema,
  csvImportSchema,
  quickTransactionSchema,
  smsImportSchema,
  transactionFormSchema,
  type AccountFormInput,
  type BudgetFormInput,
  type CsvImportInput,
  type QuickTransactionInput,
  type SmsImportInput,
  type TransactionFormInput,
} from '@/lib/validations/finance';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function parseMajorToMinor(raw: string, currency: string = DEFAULT_CURRENCY): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return toMinor(value, currency);
}

function emptyOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function writeAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown>,
  actor: 'user' | 'ai' | 'system' = 'user',
) {
  await createAuditLog(userId, {
    actor,
    action,
    entityType,
    entityId,
    after,
  });
}

export type AccountDto = {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  isActive: boolean;
  balanceMinor: number;
};

export type CategoryDto = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type TransactionDto = {
  id: string;
  accountId: string;
  accountName: string | null;
  occurredOn: string;
  amountMinor: number;
  currency: string;
  type: string;
  merchant: string | null;
  categoryId: string | null;
  categoryName: string | null;
  scope: string;
  projectId: string | null;
  notes: string | null;
  source: string;
  confidence: number | null;
  cardLabel: string | null;
  needsReview: boolean;
};

export type BudgetDto = {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  amountMinor: number;
  currency: string;
  month: string;
};

function toYmd(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export async function listFinanceAccounts(): Promise<{
  accounts?: AccountDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listAccounts(userId);
    const accountsDto: AccountDto[] = [];
    for (const row of rows) {
      const balanceMinor = await sumAccountBalance(userId, row.id);
      accountsDto.push({
        id: row.id,
        name: row.name,
        accountType: row.accountType,
        currency: row.currency,
        isActive: row.isActive,
        balanceMinor,
      });
    }
    return { accounts: accountsDto };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveAccount(input: {
  id?: string;
  values: AccountFormInput;
}): Promise<{ accountId?: string; error?: string }> {
  const parsed = accountFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    if (input.id) {
      const existing = await getAccount(userId, input.id);
      if (!existing) {
        return { error: 'notFound' };
      }
      await updateAccount(userId, input.id, parsed.data);
      await writeAudit(userId, 'update', 'account', input.id, parsed.data);
      return { accountId: input.id };
    }
    const created = await createAccount(userId, parsed.data);
    await writeAudit(userId, 'create', 'account', created.id, parsed.data);
    return { accountId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listFinanceCategories(): Promise<{
  categories?: CategoryDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listTransactionCategories(userId);
    return {
      categories: rows.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        sortOrder: row.sortOrder,
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listFinanceTransactions(filters?: {
  accountId?: string;
  fromYmd?: string;
  toYmd?: string;
  type?: string;
  categoryId?: string;
  scope?: string;
  projectId?: string;
  source?: string;
  needsReviewOnly?: boolean;
  uncategorizedOnly?: boolean;
}): Promise<{ transactions?: TransactionDto[]; error?: string }> {
  try {
    const userId = await requireUserId();
    const queryFilters: TransactionFilters = {
      accountId: filters?.accountId,
      fromYmd: filters?.fromYmd,
      toYmd: filters?.toYmd,
      type: filters?.type as TransactionFilters['type'],
      categoryId: filters?.categoryId,
      scope: filters?.scope as TransactionFilters['scope'],
      projectId: filters?.projectId,
      source: filters?.source as TransactionFilters['source'],
      needsReviewOnly: filters?.needsReviewOnly,
      uncategorizedOnly: filters?.uncategorizedOnly,
    };
    const [rows, accounts, categories] = await Promise.all([
      listTransactions(userId, queryFilters),
      listAccounts(userId),
      listTransactionCategories(userId),
    ]);
    const accountName = new Map(accounts.map((row) => [row.id, row.name]));
    const categoryName = new Map(categories.map((row) => [row.id, row.name]));
    return {
      transactions: rows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        accountName: accountName.get(row.accountId) ?? null,
        occurredOn: toYmd(row.occurredOn)!,
        amountMinor: row.amount,
        currency: row.currency,
        type: row.type,
        merchant: row.merchant,
        categoryId: row.categoryId,
        categoryName: row.categoryId
          ? (categoryName.get(row.categoryId) ?? null)
          : null,
        scope: row.scope,
        projectId: row.projectId,
        notes: row.notes,
        source: row.source,
        confidence: row.confidence != null ? Number(row.confidence) : null,
        cardLabel: row.cardLabel,
        needsReview: row.needsReview,
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveTransaction(input: {
  id?: string;
  values: TransactionFormInput;
}): Promise<{ transactionId?: string; error?: string }> {
  const parsed = transactionFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const values = parsed.data;
    const amountMinor = parseMajorToMinor(values.amountMajor);
    if (amountMinor == null) {
      return { error: 'invalid' };
    }
    const account = await getAccount(userId, values.accountId);
    if (!account) {
      return { error: 'notFound' };
    }

    if (input.id) {
      const existing = await getTransaction(userId, input.id);
      if (!existing) {
        return { error: 'notFound' };
      }
      const nextCategoryId = emptyOptional(values.categoryId);
      await updateTransaction(userId, input.id, {
        accountId: values.accountId,
        occurredOn: new Date(`${values.occurredOn}T00:00:00.000Z`),
        amount: amountMinor,
        type: values.type,
        merchant: emptyOptional(values.merchant),
        categoryId: nextCategoryId,
        scope: values.scope,
        projectId: emptyOptional(values.projectId),
        notes: emptyOptional(values.notes),
        cardLabel: emptyOptional(values.cardLabel),
        needsReview: false,
      });

      if (
        nextCategoryId &&
        nextCategoryId !== existing.categoryId &&
        values.merchant
      ) {
        await upsertMerchantRule(userId, {
          normalizedMerchant: normalizeMerchant(values.merchant),
          categoryId: nextCategoryId,
          scope: values.scope,
        });
      }

      await writeAudit(userId, 'update', 'transaction', input.id, {
        amount: amountMinor,
        categoryId: nextCategoryId,
      });
      return { transactionId: input.id };
    }

    const summary = await ingest(userId, 'manual', {
      amountMinor,
      date: values.occurredOn,
      merchant: values.merchant,
      type: values.type,
      accountId: values.accountId,
      notes: values.notes,
      scope: values.scope,
      projectId: emptyOptional(values.projectId),
      cardLabel: emptyOptional(values.cardLabel),
      categoryId: emptyOptional(values.categoryId),
    });
    const created = summary.rows.find((row) => row.transactionId);
    return { transactionId: created?.transactionId };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function quickAddTransaction(
  input: QuickTransactionInput,
): Promise<{ transactionId?: string; error?: string }> {
  const parsed = quickTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const amountMinor = parseMajorToMinor(parsed.data.amountMajor);
    if (amountMinor == null) {
      return { error: 'invalid' };
    }
    const summary = await ingest(userId, 'manual', {
      amountMinor,
      date: parsed.data.occurredOn,
      merchant: parsed.data.merchant,
      type: parsed.data.type,
      accountId: emptyOptional(parsed.data.accountId) ?? undefined,
    });
    return {
      transactionId: summary.rows.find((row) => row.transactionId)?.transactionId,
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function patchTransactionFields(input: {
  id: string;
  categoryId?: string | null;
  scope?: 'personal' | 'family' | 'business';
  projectId?: string | null;
  needsReview?: boolean;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getTransaction(userId, input.id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateTransaction(userId, input.id, {
      categoryId:
        input.categoryId === undefined ? existing.categoryId : input.categoryId,
      scope: input.scope ?? existing.scope,
      projectId:
        input.projectId === undefined ? existing.projectId : input.projectId,
      needsReview:
        input.needsReview === undefined ? false : input.needsReview,
    });
    if (
      input.categoryId &&
      input.categoryId !== existing.categoryId &&
      existing.merchant
    ) {
      await upsertMerchantRule(userId, {
        normalizedMerchant: normalizeMerchant(existing.merchant),
        categoryId: input.categoryId,
        scope: input.scope ?? existing.scope,
      });
    }
    await writeAudit(userId, 'categorize', 'transaction', input.id, {
      categoryId: input.categoryId,
      scope: input.scope,
      learned: Boolean(input.categoryId && existing.merchant),
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveTransaction(
  id: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getTransaction(userId, id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteTransaction(userId, id);
    await writeAudit(userId, 'delete', 'transaction', id, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function importCsv(
  input: CsvImportInput,
): Promise<{ summary?: IngestSummary; error?: string }> {
  const parsed = csvImportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const summary = await ingest(userId, 'csv', {
      csvText: parsed.data.csvText,
      mapping: {
        date: parsed.data.dateColumn,
        amount: parsed.data.amountColumn,
        merchant: parsed.data.merchantColumn || undefined,
        type: parsed.data.typeColumn || undefined,
      },
      defaultAccountId: emptyOptional(parsed.data.accountId) ?? undefined,
    });
    await writeAudit(userId, 'import', 'transactions', userId, {
      adapter: 'csv',
      imported: summary.imported,
      duplicates: summary.duplicates,
      needsReview: summary.needsReview,
    });
    return { summary };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function importSms(
  input: SmsImportInput,
): Promise<{ summary?: IngestSummary; error?: string }> {
  const parsed = smsImportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const summary = await ingest(userId, 'sms', {
      text: parsed.data.text,
      defaultAccountId: emptyOptional(parsed.data.accountId) ?? undefined,
    });
    await writeAudit(userId, 'import', 'transactions', userId, {
      adapter: 'sms',
      imported: summary.imported,
      duplicates: summary.duplicates,
      needsReview: summary.needsReview,
    });
    return { summary };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listFinanceBudgets(month?: string): Promise<{
  budgets?: BudgetDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = month
      ? await getBudgetsForMonth(userId, month)
      : await listBudgets(userId);
    const categories = await listTransactionCategories(userId);
    const categoryName = new Map(categories.map((row) => [row.id, row.name]));
    return {
      budgets: rows.map((row) => ({
        id: row.id,
        categoryId: row.categoryId,
        categoryName: row.categoryId
          ? (categoryName.get(row.categoryId) ?? null)
          : null,
        amountMinor: row.amount,
        currency: row.currency,
        month: toYmd(row.month)!,
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveBudget(input: {
  id?: string;
  values: BudgetFormInput;
}): Promise<{ budgetId?: string; error?: string }> {
  const parsed = budgetFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const amountMinor = parseMajorToMinor(
      parsed.data.amountMajor,
      parsed.data.currency || DEFAULT_CURRENCY,
    );
    if (amountMinor == null) {
      return { error: 'invalid' };
    }
    const month = `${parsed.data.month.slice(0, 7)}-01`;
    const fields = {
      categoryId: emptyOptional(parsed.data.categoryId),
      amount: amountMinor,
      currency: parsed.data.currency,
      month: new Date(`${month}T00:00:00.000Z`),
      period: 'month' as const,
    };
    if (input.id) {
      await updateBudget(userId, input.id, fields);
      await writeAudit(userId, 'update', 'budget', input.id, {
        amount: amountMinor,
        month,
      });
      return { budgetId: input.id };
    }
    const created = await createBudget(userId, fields);
    await writeAudit(userId, 'create', 'budget', created.id, {
      amount: amountMinor,
      month,
    });
    return { budgetId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveBudget(id: string): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await deleteBudget(userId, id);
    await writeAudit(userId, 'delete', 'budget', id, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listFinanceLookups(): Promise<{
  projects?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const projects = await listProjects(userId);
    return {
      projects: projects.map((row) => ({ id: row.id, name: row.name })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function getFinanceSpendSnapshot(): Promise<{
  todayMinor?: number;
  monthMinor?: number;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const [todayMinor, monthMinor] = await Promise.all([
      getSpendToday(userId),
      getSpendMonth(userId),
    ]);
    return { todayMinor, monthMinor };
  } catch (error) {
    return { error: asError(error) };
  }
}
