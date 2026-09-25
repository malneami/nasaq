import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  goalLifeAreas,
  goalProjects,
  goals,
  type InsertGoal,
  type InsertGoalLifeArea,
  type InsertGoalProject,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listGoals(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(goals)
    .where(and(eq(goals.userId, id), notDeleted(goals.deletedAt)))
    .orderBy(desc(goals.updatedAt));
}

export async function getGoal(userId: string, goalId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, id),
        eq(goals.id, goalId),
        notDeleted(goals.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createGoal(
  userId: string,
  values: Omit<InsertGoal, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(goals)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateGoal(
  userId: string,
  goalId: string,
  values: Partial<Omit<InsertGoal, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(goals)
    .set(values)
    .where(and(eq(goals.userId, id), eq(goals.id, goalId)))
    .returning();
  return row ?? null;
}

export async function deleteGoal(userId: string, goalId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(goals)
    .set({ deletedAt: new Date() })
    .where(and(eq(goals.userId, id), eq(goals.id, goalId)))
    .returning();
  return row ?? null;
}

export async function linkGoalLifeArea(
  userId: string,
  values: Omit<InsertGoalLifeArea, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(goalLifeAreas)
    .values({ ...values, userId: id })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function linkGoalProject(
  userId: string,
  values: Omit<InsertGoalProject, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(goalProjects)
    .values({ ...values, userId: id })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function listGoalLifeAreaIds(userId: string, goalIds: string[]) {
  if (goalIds.length === 0) {
    return [];
  }
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(goalLifeAreas)
    .where(
      and(
        eq(goalLifeAreas.userId, id),
        inArray(goalLifeAreas.goalId, goalIds),
      ),
    );
}

export async function listGoalProjectIds(userId: string, goalIds: string[]) {
  if (goalIds.length === 0) {
    return [];
  }
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(goalProjects)
    .where(
      and(eq(goalProjects.userId, id), inArray(goalProjects.goalId, goalIds)),
    );
}

export async function setGoalLifeAreas(
  userId: string,
  goalId: string,
  lifeAreaIds: string[],
) {
  const id = assertUserId(userId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(goalLifeAreas)
      .where(
        and(eq(goalLifeAreas.userId, id), eq(goalLifeAreas.goalId, goalId)),
      );
    if (lifeAreaIds.length === 0) {
      return;
    }
    await tx.insert(goalLifeAreas).values(
      lifeAreaIds.map((lifeAreaId) => ({
        userId: id,
        goalId,
        lifeAreaId,
      })),
    );
  });
}

export async function setGoalProjects(
  userId: string,
  goalId: string,
  projectIds: string[],
) {
  const id = assertUserId(userId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(goalProjects)
      .where(and(eq(goalProjects.userId, id), eq(goalProjects.goalId, goalId)));
    if (projectIds.length === 0) {
      return;
    }
    await tx.insert(goalProjects).values(
      projectIds.map((projectId) => ({
        userId: id,
        goalId,
        projectId,
      })),
    );
  });
}
