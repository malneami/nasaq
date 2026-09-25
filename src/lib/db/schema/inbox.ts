import { index, jsonb, numeric, pgTable, text } from 'drizzle-orm/pg-core';
import { idColumn, softDelete, timestamps, userIdColumn } from './common';
import type { InboxAiPayload } from '@/lib/inbox/types';
import { inboxInputKindEnum, inboxStatusEnum, inboxTypeEnum } from './enums';

export const inboxItems = pgTable(
  'inbox_items',
  {
    id: idColumn(),
    userId: userIdColumn(),
    rawText: text('raw_text').notNull(),
    inputKind: inboxInputKindEnum('input_kind').notNull().default('text'),
    aiType: inboxTypeEnum('ai_type'),
    aiPayload: jsonb('ai_payload').$type<InboxAiPayload>(),
    aiConfidence: numeric('ai_confidence', { precision: 4, scale: 3 }),
    status: inboxStatusEnum('status').notNull().default('unprocessed'),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('inbox_items_user_id_idx').on(table.userId),
    index('inbox_items_status_idx').on(table.userId, table.status),
  ],
);

export type SelectInboxItem = typeof inboxItems.$inferSelect;
export type InsertInboxItem = typeof inboxItems.$inferInsert;
