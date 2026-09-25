import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { idColumn, softDelete, timestamps, userIdColumn } from './common';
import {
  energyLevelEnum,
  taskPriorityEnum,
  taskStatusEnum,
  taskTypeEnum,
} from './enums';
import { projects } from './projects';

export const tasks = pgTable(
  'tasks',
  {
    id: idColumn(),
    userId: userIdColumn(),
    title: text('title').notNull(),
    description: text('description'),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    parentTaskId: uuid('parent_task_id').references(() => tasks.id, {
      onDelete: 'cascade',
    }),
    sortOrder: integer('sort_order').notNull().default(0),
    owner: text('owner'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    status: taskStatusEnum('status').notNull().default('inbox'),
    type: taskTypeEnum('type').notNull().default('quick_task'),
    dueDate: date('due_date', { mode: 'date' }),
    estimatedMinutes: integer('estimated_minutes'),
    energy: energyLevelEnum('energy').notNull().default('medium'),
    context: text('context'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('tasks_user_id_idx').on(table.userId),
    index('tasks_user_status_idx').on(table.userId, table.status),
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_due_date_idx').on(table.userId, table.dueDate),
    index('tasks_parent_task_id_idx').on(table.parentTaskId),
  ],
);

export type SelectTask = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
