import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { idColumn, softDelete, timestamps, userIdColumn } from './common';
import { goalStatusEnum } from './enums';

export const goals = pgTable(
  'goals',
  {
    id: idColumn(),
    userId: userIdColumn(),
    title: text('title').notNull(),
    description: text('description'),
    startDate: date('start_date', { mode: 'date' }),
    targetDate: date('target_date', { mode: 'date' }),
    successMetric: text('success_metric'),
    status: goalStatusEnum('status').notNull().default('planned'),
    progress: integer('progress').notNull().default(0),
    achievedAt: timestamp('achieved_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('goals_user_id_idx').on(table.userId),
    index('goals_user_status_idx').on(table.userId, table.status),
    check(
      'goals_progress_range',
      sql`${table.progress} >= 0 AND ${table.progress} <= 100`,
    ),
  ],
);

export type SelectGoal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;
