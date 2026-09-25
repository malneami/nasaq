import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { idColumn, softDelete, timestamps, userIdColumn } from './common';
import { projects } from './projects';

export const projectNotes = pgTable(
  'project_notes',
  {
    id: idColumn(),
    userId: userIdColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('project_notes_user_id_idx').on(table.userId),
    index('project_notes_project_id_idx').on(table.projectId),
  ],
);

export type SelectProjectNote = typeof projectNotes.$inferSelect;
export type InsertProjectNote = typeof projectNotes.$inferInsert;
