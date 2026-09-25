import { sql } from 'drizzle-orm';
import { bigint, char, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ProjectStage } from './enums';

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};

export function userIdColumn() {
  return uuid('user_id').notNull();
}

export function idColumn() {
  return uuid('id').primaryKey().defaultRandom();
}

export function moneyColumn(name: string) {
  return bigint(name, { mode: 'number' }).notNull().default(0);
}

export function nullableMoneyColumn(name: string) {
  return bigint(name, { mode: 'number' });
}

export function currencyColumn() {
  return char('currency', { length: 3 }).notNull().default('SAR');
}

export const DEFAULT_PROJECT_STAGES: readonly ProjectStage[] = [
  'idea',
  'validation',
  'planning',
  'building',
  'testing',
  'launch',
  'scale',
  'completed',
] as const;

export const defaultPreferences = {
  active_project_limit: 3,
  top_outcomes_limit: 3,
  confidence_threshold: 0.7,
  project_stages: [...DEFAULT_PROJECT_STAGES],
  wake_hm: '07:00',
  sleep_hm: '23:00',
  daily_energy: 'medium',
} as const;

export type ProfilePreferences = {
  active_project_limit: number;
  top_outcomes_limit: number;
  confidence_threshold: number;
  project_stages?: ProjectStage[];
  wake_hm?: string;
  sleep_hm?: string;
  daily_energy?: 'low' | 'medium' | 'high';
};

export const preferencesDefaultSql = sql`'{"active_project_limit":3,"top_outcomes_limit":3,"confidence_threshold":0.7}'::jsonb`;
