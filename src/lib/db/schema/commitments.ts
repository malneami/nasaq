import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { idColumn, softDelete, timestamps, userIdColumn } from './common';
import {
  commitmentDirectionEnum,
  commitmentStatusEnum,
  waitingStatusEnum,
} from './enums';
import { contacts } from './people';
import { projects } from './projects';

export const commitments = pgTable(
  'commitments',
  {
    id: idColumn(),
    userId: userIdColumn(),
    direction: commitmentDirectionEnum('direction').notNull(),
    description: text('description').notNull(),
    contactId: uuid('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    createdDate: date('created_date', { mode: 'date' }).notNull().defaultNow(),
    dueDate: date('due_date', { mode: 'date' }),
    status: commitmentStatusEnum('status').notNull().default('open'),
    followUpAt: timestamp('follow_up_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('commitments_user_id_idx').on(table.userId),
    index('commitments_status_idx').on(table.userId, table.status),
    index('commitments_due_date_idx').on(table.userId, table.dueDate),
    index('commitments_project_id_idx').on(table.projectId),
  ],
);

export const waitingItems = pgTable(
  'waiting_items',
  {
    id: idColumn(),
    userId: userIdColumn(),
    contactId: uuid('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    org: text('org'),
    item: text('item').notNull(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    expectedAt: timestamp('expected_at', { withTimezone: true, mode: 'date' }),
    followUpAt: timestamp('follow_up_at', { withTimezone: true, mode: 'date' }),
    status: waitingStatusEnum('status').notNull().default('waiting'),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('waiting_items_user_id_idx').on(table.userId),
    index('waiting_items_status_idx').on(table.userId, table.status),
    index('waiting_items_project_id_idx').on(table.projectId),
  ],
);

export type SelectCommitment = typeof commitments.$inferSelect;
export type InsertCommitment = typeof commitments.$inferInsert;
export type SelectWaitingItem = typeof waitingItems.$inferSelect;
export type InsertWaitingItem = typeof waitingItems.$inferInsert;
