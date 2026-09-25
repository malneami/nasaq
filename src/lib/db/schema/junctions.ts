import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps, userIdColumn } from './common';
import { goals } from './goals';
import { lifeAreas } from './life-areas';
import { contacts } from './people';
import { projects } from './projects';
import { tasks } from './tasks';

export const goalLifeAreas = pgTable(
  'goal_life_areas',
  {
    userId: userIdColumn(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    lifeAreaId: uuid('life_area_id')
      .notNull()
      .references(() => lifeAreas.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.goalId, table.lifeAreaId] }),
    index('goal_life_areas_user_id_idx').on(table.userId),
  ],
);

export const projectLifeAreas = pgTable(
  'project_life_areas',
  {
    userId: userIdColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    lifeAreaId: uuid('life_area_id')
      .notNull()
      .references(() => lifeAreas.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.lifeAreaId] }),
    index('project_life_areas_user_id_idx').on(table.userId),
  ],
);

export const goalProjects = pgTable(
  'goal_projects',
  {
    userId: userIdColumn(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.goalId, table.projectId] }),
    index('goal_projects_user_id_idx').on(table.userId),
  ],
);

export const projectContacts = pgTable(
  'project_contacts',
  {
    userId: userIdColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('stakeholder'),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.contactId] }),
    index('project_contacts_user_id_idx').on(table.userId),
    index('project_contacts_contact_id_idx').on(table.contactId),
  ],
);

export const taskLifeAreas = pgTable(
  'task_life_areas',
  {
    userId: userIdColumn(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    lifeAreaId: uuid('life_area_id')
      .notNull()
      .references(() => lifeAreas.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.lifeAreaId] }),
    index('task_life_areas_user_id_idx').on(table.userId),
  ],
);

export type SelectGoalLifeArea = typeof goalLifeAreas.$inferSelect;
export type InsertGoalLifeArea = typeof goalLifeAreas.$inferInsert;
export type SelectProjectLifeArea = typeof projectLifeAreas.$inferSelect;
export type InsertProjectLifeArea = typeof projectLifeAreas.$inferInsert;
export type SelectGoalProject = typeof goalProjects.$inferSelect;
export type InsertGoalProject = typeof goalProjects.$inferInsert;
export type SelectProjectContact = typeof projectContacts.$inferSelect;
export type InsertProjectContact = typeof projectContacts.$inferInsert;
export type SelectTaskLifeArea = typeof taskLifeAreas.$inferSelect;
export type InsertTaskLifeArea = typeof taskLifeAreas.$inferInsert;
