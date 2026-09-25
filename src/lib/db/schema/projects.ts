import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  currencyColumn,
  idColumn,
  moneyColumn,
  softDelete,
  timestamps,
  userIdColumn,
} from './common';
import {
  aiActionEnum,
  projectStageEnum,
  projectStateEnum,
  riskLevelEnum,
} from './enums';

export type ProjectLink = {
  url: string;
  label?: string;
};

export const projects = pgTable(
  'projects',
  {
    id: idColumn(),
    userId: userIdColumn(),
    name: text('name').notNull(),
    description: text('description'),
    strategicObjective: text('strategic_objective'),
    desiredOutcome: text('desired_outcome'),
    owner: text('owner'),
    state: projectStateEnum('state').notNull().default('incubator'),
    stage: projectStageEnum('stage').notNull().default('idea'),
    progress: integer('progress').notNull().default(0),
    currentMilestoneId: uuid('current_milestone_id'),
    nextMilestoneId: uuid('next_milestone_id'),
    targetDate: date('target_date', { mode: 'date' }),
    nextAction: text('next_action'),
    riskLevel: riskLevelEnum('risk_level').notNull().default('medium'),
    blockers: text('blockers'),
    dependencies: text('dependencies'),
    timeInvestedMinutes: moneyColumn('time_invested_minutes'),
    moneyInvested: moneyColumn('money_invested'),
    estimatedFutureCost: moneyColumn('estimated_future_cost'),
    currency: currencyColumn(),
    links: jsonb('links').$type<ProjectLink[]>(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('projects_user_id_idx').on(table.userId),
    index('projects_user_state_idx').on(table.userId, table.state),
    index('projects_target_date_idx').on(table.userId, table.targetDate),
    check(
      'projects_progress_range',
      sql`${table.progress} >= 0 AND ${table.progress} <= 100`,
    ),
  ],
);

export const milestones = pgTable(
  'milestones',
  {
    id: idColumn(),
    userId: userIdColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    targetDate: date('target_date', { mode: 'date' }),
    isDone: boolean('is_done').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('milestones_user_id_idx').on(table.userId),
    index('milestones_project_id_idx').on(table.projectId),
  ],
);

export const projectScores = pgTable(
  'project_scores',
  {
    id: idColumn(),
    userId: userIdColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    strategicFit: smallint('strategic_fit').notNull(),
    expectedImpact: smallint('expected_impact').notNull(),
    revenuePotential: smallint('revenue_potential').notNull(),
    networkValue: smallint('network_value').notNull(),
    personalInterest: smallint('personal_interest').notNull(),
    timeRequirement: smallint('time_requirement').notNull(),
    financialCost: smallint('financial_cost').notNull(),
    complexity: smallint('complexity').notNull(),
    urgency: smallint('urgency').notNull(),
    computedScore: integer('computed_score').notNull(),
    aiRecommendation: aiActionEnum('ai_recommendation'),
    computedAt: timestamp('computed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index('project_scores_user_id_idx').on(table.userId),
    index('project_scores_project_id_idx').on(table.projectId),
    check(
      'project_scores_range',
      sql`${table.strategicFit} between 1 and 10
        and ${table.expectedImpact} between 1 and 10
        and ${table.revenuePotential} between 1 and 10
        and ${table.networkValue} between 1 and 10
        and ${table.personalInterest} between 1 and 10
        and ${table.timeRequirement} between 1 and 10
        and ${table.financialCost} between 1 and 10
        and ${table.complexity} between 1 and 10
        and ${table.urgency} between 1 and 10
        and ${table.computedScore} between 0 and 100`,
    ),
  ],
);

export const projectFinances = pgTable(
  'project_finances',
  {
    id: idColumn(),
    userId: userIdColumn(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    moneyInvested: moneyColumn('money_invested'),
    revenue: moneyColumn('revenue'),
    timeInvestedMinutes: moneyColumn('time_invested_minutes'),
    currency: currencyColumn(),
    ...timestamps,
  },
  (table) => [
    index('project_finances_user_id_idx').on(table.userId),
    uniqueIndex('project_finances_project_id_idx').on(table.projectId),
  ],
);

export type SelectProject = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type SelectMilestone = typeof milestones.$inferSelect;
export type InsertMilestone = typeof milestones.$inferInsert;
export type SelectProjectScore = typeof projectScores.$inferSelect;
export type InsertProjectScore = typeof projectScores.$inferInsert;
export type SelectProjectFinance = typeof projectFinances.$inferSelect;
export type InsertProjectFinance = typeof projectFinances.$inferInsert;
