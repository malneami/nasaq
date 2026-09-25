import { pgEnum } from 'drizzle-orm/pg-core';

export const goalStatusEnum = pgEnum('goal_status', [
  'planned',
  'active',
  'achieved',
  'paused',
  'abandoned',
]);

export const projectStateEnum = pgEnum('project_state', [
  'active',
  'maintain',
  'waiting',
  'incubator',
  'someday',
  'completed',
  'stopped',
]);

export const projectStageEnum = pgEnum('project_stage', [
  'idea',
  'validation',
  'planning',
  'building',
  'testing',
  'launch',
  'scale',
  'completed',
]);

export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high']);

export const taskStatusEnum = pgEnum('task_status', [
  'inbox',
  'next',
  'scheduled',
  'in_progress',
  'waiting',
  'completed',
  'cancelled',
]);

export const taskTypeEnum = pgEnum('task_type', [
  'deep_work',
  'call',
  'meeting',
  'communication',
  'computer',
  'clinical',
  'home',
  'errand',
  'quick_task',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const energyLevelEnum = pgEnum('energy_level', [
  'low',
  'medium',
  'high',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'expense',
  'income',
  'transfer',
  'refund',
  'withdrawal',
  'deposit',
  'fee',
]);

export const moneyScopeEnum = pgEnum('money_scope', [
  'personal',
  'family',
  'business',
]);

export const dataSourceEnum = pgEnum('data_source', [
  'manual',
  'csv',
  'sms',
  'email',
  'api',
]);

export const relationshipCategoryEnum = pgEnum('relationship_category', [
  'partner',
  'investor',
  'advisor',
  'colleague',
  'client',
  'potential_client',
  'professional',
  'personal',
]);

export const commitmentDirectionEnum = pgEnum('commitment_direction', [
  'i_promised',
  'they_promised',
]);

export const commitmentStatusEnum = pgEnum('commitment_status', [
  'open',
  'fulfilled',
  'overdue',
  'cancelled',
]);

export const waitingStatusEnum = pgEnum('waiting_status', [
  'waiting',
  'received',
  'overdue',
  'cancelled',
]);

export const inboxTypeEnum = pgEnum('inbox_type', [
  'task',
  'idea',
  'project',
  'note',
  'person',
  'follow_up',
  'commitment',
  'expense',
  'income',
  'event',
]);

export const inboxStatusEnum = pgEnum('inbox_status', [
  'unprocessed',
  'processed',
  'discarded',
]);

export const eventTypeEnum = pgEnum('event_type', [
  'shift',
  'meeting',
  'family',
  'appointment',
  'deep_work',
  'recovery',
  'protected',
  'other',
]);

export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'other',
]);

export const aiActionEnum = pgEnum('ai_action', [
  'activate',
  'maintain',
  'incubate',
  'reassess',
  'stop',
]);

export const reviewTypeEnum = pgEnum('review_type', ['weekly', 'monthly']);

export const appLocaleEnum = pgEnum('app_locale', ['en', 'ar']);

export const inboxInputKindEnum = pgEnum('inbox_input_kind', [
  'text',
  'voice',
  'link',
  'note',
  'manual_txn',
]);

export const budgetPeriodEnum = pgEnum('budget_period', ['month']);

export const financialGoalKindEnum = pgEnum('financial_goal_kind', [
  'emergency_fund',
  'savings',
  'debt',
  'investment',
]);

export const recommendationStatusEnum = pgEnum('recommendation_status', [
  'pending',
  'accepted',
  'dismissed',
]);

export const auditActorEnum = pgEnum('audit_actor', ['user', 'ai', 'system']);

export type GoalStatus = (typeof goalStatusEnum.enumValues)[number];
export type ProjectState = (typeof projectStateEnum.enumValues)[number];
export type ProjectStage = (typeof projectStageEnum.enumValues)[number];
export type RiskLevel = (typeof riskLevelEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type TaskType = (typeof taskTypeEnum.enumValues)[number];
export type TaskPriority = (typeof taskPriorityEnum.enumValues)[number];
export type EnergyLevel = (typeof energyLevelEnum.enumValues)[number];
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type MoneyScope = (typeof moneyScopeEnum.enumValues)[number];
export type DataSource = (typeof dataSourceEnum.enumValues)[number];
export type RelationshipCategory =
  (typeof relationshipCategoryEnum.enumValues)[number];
export type CommitmentDirection =
  (typeof commitmentDirectionEnum.enumValues)[number];
export type CommitmentStatus = (typeof commitmentStatusEnum.enumValues)[number];
export type WaitingStatus = (typeof waitingStatusEnum.enumValues)[number];
export type InboxType = (typeof inboxTypeEnum.enumValues)[number];
export type InboxStatus = (typeof inboxStatusEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
export type AccountType = (typeof accountTypeEnum.enumValues)[number];
export type AiAction = (typeof aiActionEnum.enumValues)[number];
export type ReviewType = (typeof reviewTypeEnum.enumValues)[number];
export type AppLocaleCode = (typeof appLocaleEnum.enumValues)[number];
export type InboxInputKind = (typeof inboxInputKindEnum.enumValues)[number];
export type BudgetPeriod = (typeof budgetPeriodEnum.enumValues)[number];
export type FinancialGoalKind =
  (typeof financialGoalKindEnum.enumValues)[number];
export type RecommendationStatus =
  (typeof recommendationStatusEnum.enumValues)[number];
export type AuditActor = (typeof auditActorEnum.enumValues)[number];
