import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import {
  currencyColumn,
  defaultPreferences,
  preferencesDefaultSql,
  timestamps,
  type ProfilePreferences,
} from './common';
import { appLocaleEnum } from './enums';

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  displayName: text('display_name'),
  locale: appLocaleEnum('locale').notNull().default('en'),
  timezone: text('timezone').notNull().default('Asia/Riyadh'),
  currency: currencyColumn(),
  preferences: jsonb('preferences')
    .$type<ProfilePreferences>()
    .notNull()
    .default(preferencesDefaultSql),
  ...timestamps,
});

export type SelectProfile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

export { defaultPreferences };
export type { ProfilePreferences };
