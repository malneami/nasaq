import { z } from 'zod';

export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'other',
] as const;

export const TRANSACTION_TYPES = [
  'expense',
  'income',
  'transfer',
  'refund',
  'withdrawal',
  'deposit',
  'fee',
] as const;

export const MONEY_SCOPES = ['personal', 'family', 'business'] as const;

export const accountFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  accountType: z.enum(ACCOUNT_TYPES),
  currency: z.string().trim().length(3).default('SAR'),
  isActive: z.boolean().default(true),
});

export type AccountFormInput = z.infer<typeof accountFormSchema>;

export const transactionFormSchema = z.object({
  accountId: z.string().uuid(),
  occurredOn: z.string().min(1),
  amountMajor: z.string().trim().min(1),
  type: z.enum(TRANSACTION_TYPES),
  merchant: z.string().trim().max(200).optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  scope: z.enum(MONEY_SCOPES),
  projectId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  cardLabel: z.string().trim().max(40).optional().or(z.literal('')),
});

export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

export const quickTransactionSchema = z.object({
  accountId: z.string().uuid().optional().or(z.literal('')),
  amountMajor: z.string().trim().min(1),
  merchant: z.string().trim().max(200).optional().or(z.literal('')),
  type: z.enum(['expense', 'income']),
  occurredOn: z.string().min(1),
});

export type QuickTransactionInput = z.infer<typeof quickTransactionSchema>;

export const budgetFormSchema = z.object({
  categoryId: z.string().uuid().optional().or(z.literal('')),
  amountMajor: z.string().trim().min(1),
  month: z.string().min(1),
  currency: z.string().trim().length(3).default('SAR'),
});

export type BudgetFormInput = z.infer<typeof budgetFormSchema>;

export const csvImportSchema = z.object({
  csvText: z.string().min(1),
  dateColumn: z.string().min(1),
  amountColumn: z.string().min(1),
  merchantColumn: z.string().optional().or(z.literal('')),
  typeColumn: z.string().optional().or(z.literal('')),
  accountId: z.string().uuid().optional().or(z.literal('')),
});

export type CsvImportInput = z.infer<typeof csvImportSchema>;

export const smsImportSchema = z.object({
  text: z.string().min(1),
  accountId: z.string().uuid().optional().or(z.literal('')),
});

export type SmsImportInput = z.infer<typeof smsImportSchema>;
