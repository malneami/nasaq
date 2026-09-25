import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  currencyColumn,
  idColumn,
  moneyColumn,
  softDelete,
  timestamps,
  userIdColumn,
} from './common';
import {
  accountTypeEnum,
  budgetPeriodEnum,
  dataSourceEnum,
  financialGoalKindEnum,
  moneyScopeEnum,
  transactionTypeEnum,
} from './enums';
import { projects } from './projects';

export const accounts = pgTable(
  'accounts',
  {
    id: idColumn(),
    userId: userIdColumn(),
    name: text('name').notNull(),
    accountType: accountTypeEnum('account_type').notNull().default('cash'),
    currency: currencyColumn(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index('accounts_user_id_idx').on(table.userId),
    uniqueIndex('accounts_user_name_idx').on(table.userId, table.name),
  ],
);

export const transactionCategories = pgTable(
  'transaction_categories',
  {
    id: idColumn(),
    userId: userIdColumn(),
    name: text('name').notNull(),
    parentId: uuid('parent_id'),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('transaction_categories_user_id_idx').on(table.userId),
    uniqueIndex('transaction_categories_user_name_idx').on(
      table.userId,
      table.name,
    ),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: idColumn(),
    userId: userIdColumn(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    occurredOn: date('occurred_on', { mode: 'date' }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }),
    amount: moneyColumn('amount'),
    currency: currencyColumn(),
    type: transactionTypeEnum('type').notNull(),
    merchant: text('merchant'),
    categoryId: uuid('category_id').references(() => transactionCategories.id, {
      onDelete: 'set null',
    }),
    scope: moneyScopeEnum('scope').notNull().default('personal'),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    source: dataSourceEnum('source').notNull().default('manual'),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    sourceRef: text('source_ref'),
    externalId: text('external_id'),
    /** Label or last-4 only — never full PAN or banking credentials. */
    cardLabel: text('card_label'),
    needsReview: boolean('needs_review').notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('transactions_user_id_idx').on(table.userId),
    index('transactions_account_id_idx').on(table.accountId),
    index('transactions_occurred_on_idx').on(table.userId, table.occurredOn),
    index('transactions_project_id_idx').on(table.projectId),
    index('transactions_category_id_idx').on(table.categoryId),
    uniqueIndex('transactions_user_external_id_idx').on(
      table.userId,
      table.externalId,
    ),
  ],
);

/**
 * Learned merchant → category mappings from user corrections.
 * Precedence: explicit rule > AI > Other.
 */
export const merchantRules = pgTable(
  'merchant_rules',
  {
    id: idColumn(),
    userId: userIdColumn(),
    normalizedMerchant: text('normalized_merchant').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => transactionCategories.id, { onDelete: 'cascade' }),
    scope: moneyScopeEnum('scope'),
    hitCount: integer('hit_count').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index('merchant_rules_user_id_idx').on(table.userId),
    uniqueIndex('merchant_rules_user_merchant_idx').on(
      table.userId,
      table.normalizedMerchant,
    ),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: idColumn(),
    userId: userIdColumn(),
    categoryId: uuid('category_id').references(() => transactionCategories.id, {
      onDelete: 'set null',
    }),
    period: budgetPeriodEnum('period').notNull().default('month'),
    amount: moneyColumn('amount'),
    currency: currencyColumn(),
    month: date('month', { mode: 'date' }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('budgets_user_id_idx').on(table.userId),
    index('budgets_month_idx').on(table.userId, table.month),
    index('budgets_category_id_idx').on(table.categoryId),
  ],
);

export const financialGoals = pgTable(
  'financial_goals',
  {
    id: idColumn(),
    userId: userIdColumn(),
    name: text('name').notNull(),
    targetAmount: moneyColumn('target_amount'),
    currentAmount: moneyColumn('current_amount'),
    currency: currencyColumn(),
    targetDate: date('target_date', { mode: 'date' }),
    kind: financialGoalKindEnum('kind').notNull().default('savings'),
    ...timestamps,
  },
  (table) => [index('financial_goals_user_id_idx').on(table.userId)],
);

export type SelectAccount = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type SelectTransactionCategory =
  typeof transactionCategories.$inferSelect;
export type InsertTransactionCategory =
  typeof transactionCategories.$inferInsert;
export type SelectTransaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type SelectBudget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;
export type SelectFinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = typeof financialGoals.$inferInsert;
export type SelectMerchantRule = typeof merchantRules.$inferSelect;
export type InsertMerchantRule = typeof merchantRules.$inferInsert;
