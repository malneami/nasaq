import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idColumn, softDelete, timestamps, userIdColumn } from './common';
import { relationshipCategoryEnum } from './enums';

export const contacts = pgTable(
  'contacts',
  {
    id: idColumn(),
    userId: userIdColumn(),
    name: text('name').notNull(),
    organization: text('organization'),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    category: relationshipCategoryEnum('category')
      .notNull()
      .default('personal'),
    lastInteractionAt: timestamp('last_interaction_at', {
      withTimezone: true,
      mode: 'date',
    }),
    nextFollowUpAt: timestamp('next_follow_up_at', {
      withTimezone: true,
      mode: 'date',
    }),
    notes: text('notes'),
    tags: text('tags').array().notNull().default([]),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('contacts_user_id_idx').on(table.userId),
    index('contacts_category_idx').on(table.userId, table.category),
    index('contacts_next_follow_up_idx').on(table.userId, table.nextFollowUpAt),
  ],
);

export const interactions = pgTable(
  'interactions',
  {
    id: idColumn(),
    userId: userIdColumn(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    channel: text('channel'),
    summary: text('summary'),
    ...timestamps,
  },
  (table) => [
    index('interactions_user_id_idx').on(table.userId),
    index('interactions_contact_id_idx').on(table.contactId),
  ],
);

export type SelectContact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;
export type SelectInteraction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;
