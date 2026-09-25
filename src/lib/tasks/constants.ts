import type { EnergyLevel, TaskPriority, TaskStatus } from '../db/schema/enums';

/**
 * Deterministic task selection weights. Sum = 100 so the weighted score is already 0–100.
 *
 * Tune here — never inside the ranker.
 */
export const TASK_SELECT_WEIGHTS = {
  deadline: 35,
  priority: 25,
  projectScore: 20,
  timeFit: 12,
  energyFit: 8,
} as const;

/** Allow estimates this far over the stated window before hard-excluding. */
export const TASK_SELECT_SLACK_PERCENT = 15;

/** Never return a full list — a short, explainable set. */
export const TASK_SELECT_LIMIT = 3;

/** Used when a linked project has no `project_scores` row yet. */
export const DEFAULT_PROJECT_PRIORITY_SCORE = 50;

export const TASK_SELECT_PRESETS = [15, 30, 60, 90] as const;

export const CANDIDATE_TASK_STATUSES: readonly TaskStatus[] = [
  'next',
  'scheduled',
  'in_progress',
];

export const DEFAULT_TASK_LIST_STATUSES: readonly TaskStatus[] = [
  'next',
  'in_progress',
  'scheduled',
];

export const ENERGY_RANK: Record<EnergyLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export const PRIORITY_FACTOR: Record<TaskPriority, number> = {
  low: 0.18,
  medium: 0.42,
  high: 0.72,
  urgent: 1,
};

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> =
  {
    inbox: ['next', 'scheduled', 'cancelled'],
    next: ['scheduled', 'in_progress', 'waiting', 'completed', 'cancelled'],
    scheduled: ['next', 'in_progress', 'waiting', 'cancelled'],
    in_progress: ['completed', 'waiting', 'next', 'cancelled'],
    waiting: ['next', 'in_progress', 'cancelled'],
    completed: ['next'],
    cancelled: ['inbox', 'next'],
  };
