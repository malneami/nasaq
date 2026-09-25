import {
  DEFAULT_PROJECT_STAGES,
  type ProfilePreferences,
  type ProjectStage,
} from '@/lib/db/schema';

export const PROJECT_STAGES: readonly ProjectStage[] = DEFAULT_PROJECT_STAGES;

export const PROJECT_STATES = [
  'active',
  'maintain',
  'waiting',
  'incubator',
  'someday',
  'completed',
  'stopped',
] as const;

export const BOARD_STATES = [
  'active',
  'maintain',
  'waiting',
  'incubator',
] as const;

export const COLLAPSED_STATES = ['someday', 'completed', 'stopped'] as const;

export const AI_ACTION_TO_STATE: Record<
  'activate' | 'maintain' | 'incubate' | 'reassess' | 'stop',
  (typeof PROJECT_STATES)[number]
> = {
  activate: 'active',
  maintain: 'maintain',
  incubate: 'incubator',
  reassess: 'waiting',
  stop: 'stopped',
};

export function resolveProjectStages(
  preferences?: ProfilePreferences | null,
): ProjectStage[] {
  const configured = preferences?.project_stages;
  if (!configured || configured.length === 0) {
    return [...PROJECT_STAGES];
  }
  const allowed = new Set(PROJECT_STAGES);
  const unique: ProjectStage[] = [];
  for (const stage of configured) {
    if (allowed.has(stage) && !unique.includes(stage)) {
      unique.push(stage);
    }
  }
  for (const stage of PROJECT_STAGES) {
    if (!unique.includes(stage)) {
      unique.push(stage);
    }
  }
  return unique;
}

export function adjacentStage(
  stages: ProjectStage[],
  current: ProjectStage,
  direction: 1 | -1,
): ProjectStage | null {
  const index = stages.indexOf(current);
  if (index < 0) {
    return null;
  }
  return stages[index + direction] ?? null;
}
