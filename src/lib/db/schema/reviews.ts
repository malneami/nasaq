import {
  date,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { idColumn, timestamps, userIdColumn } from './common';
import { reviewTypeEnum } from './enums';

export const dailyBriefs = pgTable(
  'daily_briefs',
  {
    id: idColumn(),
    userId: userIdColumn(),
    briefDate: date('brief_date', { mode: 'date' }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index('daily_briefs_user_id_idx').on(table.userId),
    uniqueIndex('daily_briefs_user_date_idx').on(table.userId, table.briefDate),
  ],
);

export const weeklyReviews = pgTable(
  'weekly_reviews',
  {
    id: idColumn(),
    userId: userIdColumn(),
    reviewType: reviewTypeEnum('review_type').notNull().default('weekly'),
    periodStart: date('period_start', { mode: 'date' }).notNull(),
    periodEnd: date('period_end', { mode: 'date' }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    topOutcomes: jsonb('top_outcomes').$type<unknown[]>(),
    ...timestamps,
  },
  (table) => [
    index('weekly_reviews_user_id_idx').on(table.userId),
    index('weekly_reviews_period_idx').on(table.userId, table.periodStart),
  ],
);

export type SelectDailyBrief = typeof dailyBriefs.$inferSelect;
export type InsertDailyBrief = typeof dailyBriefs.$inferInsert;
export type SelectWeeklyReview = typeof weeklyReviews.$inferSelect;
export type InsertWeeklyReview = typeof weeklyReviews.$inferInsert;
