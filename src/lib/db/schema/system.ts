import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { idColumn, timestamps, userIdColumn } from './common';
import { auditActorEnum, recommendationStatusEnum } from './enums';

export const aiRecommendations = pgTable(
  'ai_recommendations',
  {
    id: idColumn(),
    userId: userIdColumn(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    status: recommendationStatusEnum('status').notNull().default('pending'),
    ...timestamps,
  },
  (table) => [
    index('ai_recommendations_user_id_idx').on(table.userId),
    index('ai_recommendations_subject_idx').on(
      table.userId,
      table.subjectType,
      table.subjectId,
    ),
    index('ai_recommendations_status_idx').on(table.userId, table.status),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: idColumn(),
    userId: userIdColumn(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    isRead: boolean('is_read').notNull().default(false),
    scheduledFor: timestamp('scheduled_for', {
      withTimezone: true,
      mode: 'date',
    }),
    ...timestamps,
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_is_read_idx').on(table.userId, table.isRead),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: idColumn(),
    userId: userIdColumn(),
    actor: auditActorEnum('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index('audit_logs_user_id_idx').on(table.userId),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  ],
);

export type SelectAiRecommendation = typeof aiRecommendations.$inferSelect;
export type InsertAiRecommendation = typeof aiRecommendations.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectAuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
