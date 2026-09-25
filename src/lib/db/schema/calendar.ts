import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { idColumn, timestamps, userIdColumn } from './common';
import { eventTypeEnum } from './enums';
import { contacts } from './people';
import { projects } from './projects';

export type RecurrenceRule = {
  freq: 'daily' | 'weekly';
  interval: number;
  byWeekday?: number[];
  until?: string;
};

export type ShiftKind = 'day' | 'evening' | 'night';

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: idColumn(),
    userId: userIdColumn(),
    title: text('title').notNull(),
    eventType: eventTypeEnum('event_type').notNull().default('other'),
    startsAt: timestamp('starts_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    endsAt: timestamp('ends_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    contactId: uuid('contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    isProtected: boolean('is_protected').notNull().default(false),
    notes: text('notes'),
    shiftKind: text('shift_kind').$type<ShiftKind>(),
    recurrence: jsonb('recurrence').$type<RecurrenceRule | null>(),
    ...timestamps,
  },
  (table) => [
    index('calendar_events_user_id_idx').on(table.userId),
    index('calendar_events_starts_at_idx').on(table.userId, table.startsAt),
    index('calendar_events_project_id_idx').on(table.projectId),
  ],
);

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: idColumn(),
    userId: userIdColumn(),
    label: text('label').notNull(),
    eventType: eventTypeEnum('event_type').notNull().default('protected'),
    startsAt: timestamp('starts_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    endsAt: timestamp('ends_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    isProtected: boolean('is_protected').notNull().default(true),
    weekday: integer('weekday'),
    startHm: text('start_hm'),
    endHm: text('end_hm'),
    ...timestamps,
  },
  (table) => [
    index('time_blocks_user_id_idx').on(table.userId),
    index('time_blocks_starts_at_idx').on(table.userId, table.startsAt),
  ],
);

export type SelectCalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;
export type SelectTimeBlock = typeof timeBlocks.$inferSelect;
export type InsertTimeBlock = typeof timeBlocks.$inferInsert;
