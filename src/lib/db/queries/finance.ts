import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  accounts,
  budgets,
  financialGoals,
  merchantRules,
  transactionCategories,
  transactions,
  type InsertAccount,
  type InsertBudget,
  type InsertFinancialGoal,
  type InsertMerchantRule,
  type InsertTransaction,
  type InsertTransactionCategory,
  type MoneyScope,
  type TransactionType,
  type DataSource,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listAccounts(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.userId, id))
    .orderBy(asc(accounts.name));
}

export async function getAccount(userId: string, accountId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, id), eq(accounts.id, accountId)))
    .limit(1);
  return row ?? null;
}

export async function createAccount(
  userId: string,
  values: Omit<InsertAccount, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(accounts)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateAccount(
  userId: string,
  accountId: string,
  values: Partial<Omit<InsertAccount, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(accounts)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(accounts.userId, id), eq(accounts.id, accountId)))
    .returning();
  return row ?? null;
}

export async function listTransactionCategories(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(transactionCategories)
    .where(eq(transactionCategories.userId, id))
    .orderBy(
      asc(transactionCategories.sortOrder),
      asc(transactionCategories.name),
    );
}

export async function createTransactionCategory(
  userId: string,
  values: Omit<InsertTransactionCategory, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(transactionCategories)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export type TransactionFilters = {
  accountId?: string;
  fromYmd?: string;
  toYmd?: string;
  type?: TransactionType;
  categoryId?: string | null;
  scope?: MoneyScope;
  projectId?: string | null;
  source?: DataSource;
  needsReviewOnly?: boolean;
  uncategorizedOnly?: boolean;
  lowConfidenceOnly?: boolean;
  confidenceThreshold?: number;
};

export async function listTransactions(
  userId: string,
  filters?: TransactionFilters,
) {
  const id = assertUserId(userId);
  const clauses = [eq(transactions.userId, id), notDeleted(transactions.deletedAt)];

  if (filters?.accountId) {
    clauses.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters?.fromYmd) {
    clauses.push(gte(transactions.occurredOn, new Date(`${filters.fromYmd}T00:00:00.000Z`)));
  }
  if (filters?.toYmd) {
    clauses.push(lte(transactions.occurredOn, new Date(`${filters.toYmd}T00:00:00.000Z`)));
  }
  if (filters?.type) {
    clauses.push(eq(transactions.type, filters.type));
  }
  if (filters?.categoryId) {
    clauses.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters?.uncategorizedOnly) {
    clauses.push(isNull(transactions.categoryId));
  }
  if (filters?.scope) {
    clauses.push(eq(transactions.scope, filters.scope));
  }
  if (filters?.projectId) {
    clauses.push(eq(transactions.projectId, filters.projectId));
  }
  if (filters?.source) {
    clauses.push(eq(transactions.source, filters.source));
  }
  if (filters?.needsReviewOnly) {
    clauses.push(eq(transactions.needsReview, true));
  }

  return getDb()
    .select()
    .from(transactions)
    .where(and(...clauses))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));
}

export async function getTransaction(userId: string, transactionId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, id),
        eq(transactions.id, transactionId),
        notDeleted(transactions.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createTransaction(
  userId: string,
  values: Omit<InsertTransaction, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(transactions)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  values: Partial<Omit<InsertTransaction, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(transactions)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(transactions.userId, id), eq(transactions.id, transactionId)))
    .returning();
  return row ?? null;
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(transactions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(transactions.userId, id), eq(transactions.id, transactionId)))
    .returning();
  return row ?? null;
}

export async function findTransactionByExternalId(
  userId: string,
  externalId: string,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, id),
        eq(transactions.externalId, externalId),
        notDeleted(transactions.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findHeuristicDuplicate(
  userId: string,
  input: {
    accountId: string;
    occurredOn: Date;
    amount: number;
    merchant: string | null;
  },
) {
  const id = assertUserId(userId);
  const day = input.occurredOn.toISOString().slice(0, 10);
  const rows = await getDb()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, id),
        eq(transactions.accountId, input.accountId),
        eq(transactions.occurredOn, new Date(`${day}T00:00:00.000Z`)),
        eq(transactions.amount, input.amount),
        notDeleted(transactions.deletedAt),
      ),
    )
    .limit(20);
  if (!input.merchant) {
    return rows[0] ?? null;
  }
  const normalized = input.merchant.trim().toUpperCase();
  return (
    rows.find(
      (row) => (row.merchant ?? '').trim().toUpperCase() === normalized,
    ) ?? null
  );
}

export async function listBudgets(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(budgets)
    .where(eq(budgets.userId, id))
    .orderBy(desc(budgets.month));
}

export async function getBudgetsForMonth(userId: string, monthYmd: string) {
  const id = assertUserId(userId);
  const monthStart = `${monthYmd.slice(0, 7)}-01`;
  return getDb()
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, id),
        eq(budgets.month, new Date(`${monthStart}T00:00:00.000Z`)),
      ),
    );
}

export async function createBudget(
  userId: string,
  values: Omit<InsertBudget, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(budgets)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  values: Partial<Omit<InsertBudget, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(budgets)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(budgets.userId, id), eq(budgets.id, budgetId)))
    .returning();
  return row ?? null;
}

export async function deleteBudget(userId: string, budgetId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .delete(budgets)
    .where(and(eq(budgets.userId, id), eq(budgets.id, budgetId)))
    .returning();
  return row ?? null;
}

export async function listFinancialGoals(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(financialGoals)
    .where(eq(financialGoals.userId, id))
    .orderBy(asc(financialGoals.name));
}

export async function createFinancialGoal(
  userId: string,
  values: Omit<InsertFinancialGoal, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(financialGoals)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function getMerchantRule(
  userId: string,
  normalizedMerchant: string,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(merchantRules)
    .where(
      and(
        eq(merchantRules.userId, id),
        eq(merchantRules.normalizedMerchant, normalizedMerchant),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertMerchantRule(
  userId: string,
  values: Omit<InsertMerchantRule, 'userId' | 'hitCount'> & {
    hitCount?: number;
  },
) {
  const id = assertUserId(userId);
  const existing = await getMerchantRule(userId, values.normalizedMerchant);
  if (existing) {
    const [row] = await getDb()
      .update(merchantRules)
      .set({
        categoryId: values.categoryId,
        scope: values.scope ?? existing.scope,
        hitCount: existing.hitCount + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(merchantRules.userId, id), eq(merchantRules.id, existing.id)))
      .returning();
    return row!;
  }
  const [row] = await getDb()
    .insert(merchantRules)
    .values({
      ...values,
      userId: id,
      hitCount: values.hitCount ?? 1,
    })
    .returning();
  return row;
}

export async function bumpMerchantRuleHit(
  userId: string,
  ruleId: string,
) {
  const id = assertUserId(userId);
  await getDb()
    .update(merchantRules)
    .set({
      hitCount: sql`${merchantRules.hitCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(merchantRules.userId, id), eq(merchantRules.id, ruleId)));
}

export async function sumAccountBalance(
  userId: string,
  accountId: string,
  asOfYmd?: string,
) {
  const id = assertUserId(userId);
  const clauses = [
    eq(transactions.userId, id),
    eq(transactions.accountId, accountId),
    notDeleted(transactions.deletedAt),
  ];
  if (asOfYmd) {
    clauses.push(
      lte(transactions.occurredOn, new Date(`${asOfYmd}T00:00:00.000Z`)),
    );
  }
  const [row] = await getDb()
    .select({
      balance: sql<number>`coalesce(sum(
        case
          when ${transactions.type} in ('income', 'deposit', 'refund') then ${transactions.amount}
          when ${transactions.type} in ('expense', 'fee', 'withdrawal') then -${transactions.amount}
          else 0
        end
      ), 0)`,
    })
    .from(transactions)
    .where(and(...clauses));
  return Number(row?.balance ?? 0);
}

export async function sumSpendBetween(
  userId: string,
  fromYmd: string,
  toYmd: string,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select({
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, id),
        notDeleted(transactions.deletedAt),
        gte(transactions.occurredOn, new Date(`${fromYmd}T00:00:00.000Z`)),
        lte(transactions.occurredOn, new Date(`${toYmd}T00:00:00.000Z`)),
        sql`${transactions.type} in ('expense', 'fee')`,
      ),
    );
  return Number(row?.total ?? 0);
}
