'use server';

import { requireUserId } from '@/lib/auth/session';
import { createAuditLog } from '@/lib/db/queries/system';
import {
  createGoal,
  deleteGoal,
  getGoal,
  listGoalLifeAreaIds,
  listGoalProjectIds,
  listGoals,
  setGoalLifeAreas,
  setGoalProjects,
  updateGoal,
} from '@/lib/db/queries/goals';
import { listLifeAreas } from '@/lib/db/queries/life-areas';
import { listProjects } from '@/lib/db/queries/projects';
import { goalFormSchema, type GoalFormInput } from '@/lib/validations/goal';
import type { GoalStatus } from '@/lib/db/schema';

export type GoalCardDto = {
  id: string;
  title: string;
  description: string | null;
  successMetric: string | null;
  status: GoalStatus;
  progress: number;
  startDate: string | null;
  targetDate: string | null;
  achievedAt: string | null;
  lifeAreaIds: string[];
  projectIds: string[];
};

export type ProjectOptionDto = {
  id: string;
  name: string;
  state: string;
};

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function toIsoDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  return new Date(`${day}T00:00:00.000Z`);
}

async function writeAudit(
  userId: string,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
) {
  await createAuditLog(userId, {
    actor: 'user',
    action,
    entityType: 'goal',
    entityId,
    after,
  });
}

export async function listGoalCards(): Promise<{
  goals?: GoalCardDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listGoals(userId);
    const ids = rows.map((row) => row.id);
    const [areaLinks, projectLinks] = await Promise.all([
      listGoalLifeAreaIds(userId, ids),
      listGoalProjectIds(userId, ids),
    ]);
    const areasByGoal = new Map<string, string[]>();
    for (const link of areaLinks) {
      const current = areasByGoal.get(link.goalId) ?? [];
      current.push(link.lifeAreaId);
      areasByGoal.set(link.goalId, current);
    }
    const projectsByGoal = new Map<string, string[]>();
    for (const link of projectLinks) {
      const current = projectsByGoal.get(link.goalId) ?? [];
      current.push(link.projectId);
      projectsByGoal.set(link.goalId, current);
    }
    return {
      goals: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        successMetric: row.successMetric,
        status: row.status,
        progress: row.progress,
        startDate: toIsoDate(row.startDate),
        targetDate: toIsoDate(row.targetDate),
        achievedAt: row.achievedAt?.toISOString() ?? null,
        lifeAreaIds: areasByGoal.get(row.id) ?? [],
        projectIds: projectsByGoal.get(row.id) ?? [],
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listProjectOptions(): Promise<{
  projects?: ProjectOptionDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listProjects(userId);
    return {
      projects: rows.map((row) => ({
        id: row.id,
        name: row.name,
        state: row.state,
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveGoal(input: {
  id?: string;
  values: GoalFormInput;
}): Promise<{ goalId?: string; error?: string }> {
  const parsed = goalFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }

  try {
    const userId = await requireUserId();
    const values = parsed.data;
    const nextStatus = values.status;
    const existing = input.id ? await getGoal(userId, input.id) : null;
    if (input.id && !existing) {
      return { error: 'notFound' };
    }

    const knownAreas = await listLifeAreas(userId, { includeArchived: true });
    const allowedAreas = new Set(knownAreas.map((area) => area.id));
    const lifeAreaIds = values.lifeAreaIds.filter((id) => allowedAreas.has(id));
    if (lifeAreaIds.length === 0) {
      return { error: 'lifeAreaRequired' };
    }

    const knownProjects = await listProjects(userId);
    const allowedProjects = new Set(knownProjects.map((project) => project.id));
    const projectIds = values.projectIds.filter((id) => allowedProjects.has(id));

    const achievedAt =
      nextStatus === 'achieved'
        ? (existing?.achievedAt ?? new Date())
        : existing?.achievedAt ?? null;

    const fields = {
      title: values.title,
      description: values.description || null,
      successMetric: values.successMetric,
      status: nextStatus,
      // TODO: progress may later be derived from linked project milestones — do not auto-derive yet.
      progress: values.progress,
      startDate: parseDate(values.startDate),
      targetDate: parseDate(values.targetDate),
      achievedAt,
    };

    let goalId = input.id;
    if (goalId) {
      await updateGoal(userId, goalId, { ...fields, updatedAt: new Date() });
      await writeAudit(userId, 'update', goalId, {
        status: nextStatus,
        progress: values.progress,
        achievedAt: achievedAt?.toISOString() ?? null,
      });
    } else {
      const created = await createGoal(userId, fields);
      goalId = created.id;
      await writeAudit(userId, 'create', goalId, { title: values.title });
    }

    await setGoalLifeAreas(userId, goalId, lifeAreaIds);
    await setGoalProjects(userId, goalId, projectIds);
    return { goalId };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveGoal(id: string): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getGoal(userId, id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteGoal(userId, id);
    await writeAudit(userId, 'delete', id, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}
