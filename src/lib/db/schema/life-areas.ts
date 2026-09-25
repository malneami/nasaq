import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { idColumn, timestamps, userIdColumn } from './common';

export const lifeAreas = pgTable(
  'life_areas',
  {
    id: idColumn(),
    userId: userIdColumn(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    icon: text('icon'),
    color: text('color'),
    isDefault: boolean('is_default').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('life_areas_user_id_idx').on(table.userId),
    uniqueIndex('life_areas_user_name_idx').on(table.userId, table.name),
  ],
);

export type SelectLifeArea = typeof lifeAreas.$inferSelect;
export type InsertLifeArea = typeof lifeAreas.$inferInsert;
