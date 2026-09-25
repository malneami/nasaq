import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  goalLifeAreas,
  goals,
  lifeAreas,
  projectLifeAreas,
  projects,
  type InsertLifeArea,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listLifeAreas(
  userId: string,
  options?: { includeArchived?: boolean },
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(lifeAreas)
    .where(
      and(
        eq(lifeAreas.userId, id),
        options?.includeArchived ? undefined : isNull(lifeAreas.archivedAt),
      ),
    )
    .orderBy(asc(lifeAreas.sortOrder), asc(lifeAreas.name));
}

export async function listLifeAreasWithCounts(
  userId: string,
  options?: { includeArchived?: boolean },
) {
  const id = assertUserId(userId);
  const db = getDb();
  const areas = await listLifeAreas(id, options);
  if (areas.length === 0) {
    return [];
  }

  const areaIds = areas.map((area) => area.id);

  const goalCounts = await db
    .select({
      lifeAreaId: goalLifeAreas.lifeAreaId,
      value: count(),
    })
    .from(goalLifeAreas)
    .innerJoin(goals, eq(goals.id, goalLifeAreas.goalId))
    .where(
      and(
        eq(goalLifeAreas.userId, id),
        inArray(goalLifeAreas.lifeAreaId, areaIds),
        eq(goals.status, 'active'),
        notDeleted(goals.deletedAt),
      ),
    )
    .groupBy(goalLifeAreas.lifeAreaId);

  const projectCounts = await db
    .select({
      lifeAreaId: projectLifeAreas.lifeAreaId,
      value: count(),
    })
    .from(projectLifeAreas)
    .innerJoin(projects, eq(projects.id, projectLifeAreas.projectId))
    .where(
      and(
        eq(projectLifeAreas.userId, id),
        inArray(projectLifeAreas.lifeAreaId, areaIds),
        eq(projects.state, 'active'),
        notDeleted(projects.deletedAt),
      ),
    )
    .groupBy(projectLifeAreas.lifeAreaId);

  const goalsByArea = new Map(
    goalCounts.map((row) => [row.lifeAreaId, Number(row.value)]),
  );
  const projectsByArea = new Map(
    projectCounts.map((row) => [row.lifeAreaId, Number(row.value)]),
  );

  return areas.map((area) => ({
    ...area,
    activeGoalCount: goalsByArea.get(area.id) ?? 0,
    activeProjectCount: projectsByArea.get(area.id) ?? 0,
  }));
}

export async function getLifeArea(userId: string, lifeAreaId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(lifeAreas)
    .where(and(eq(lifeAreas.userId, id), eq(lifeAreas.id, lifeAreaId)))
    .limit(1);
  return row ?? null;
}

export async function createLifeArea(
  userId: string,
  values: Omit<InsertLifeArea, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(lifeAreas)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateLifeArea(
  userId: string,
  lifeAreaId: string,
  values: Partial<Omit<InsertLifeArea, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(lifeAreas)
    .set(values)
    .where(and(eq(lifeAreas.userId, id), eq(lifeAreas.id, lifeAreaId)))
    .returning();
  return row ?? null;
}

export async function archiveLifeArea(userId: string, lifeAreaId: string) {
  return updateLifeArea(userId, lifeAreaId, { archivedAt: new Date() });
}

export async function reorderLifeAreas(userId: string, orderedIds: string[]) {
  const id = assertUserId(userId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((areaId, index) =>
        tx
          .update(lifeAreas)
          .set({ sortOrder: index + 1 })
          .where(and(eq(lifeAreas.userId, id), eq(lifeAreas.id, areaId))),
      ),
    );
  });
}

export async function listLifeAreaLinkedGoals(userId: string, lifeAreaId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select({
      id: goals.id,
      title: goals.title,
      status: goals.status,
      progress: goals.progress,
    })
    .from(goalLifeAreas)
    .innerJoin(goals, eq(goals.id, goalLifeAreas.goalId))
    .where(
      and(
        eq(goalLifeAreas.userId, id),
        eq(goalLifeAreas.lifeAreaId, lifeAreaId),
        notDeleted(goals.deletedAt),
      ),
    )
    .orderBy(asc(goals.title));
}

export async function listLifeAreaLinkedProjects(
  userId: string,
  lifeAreaId: string,
) {
  const id = assertUserId(userId);
  return getDb()
    .select({
      id: projects.id,
      name: projects.name,
      state: projects.state,
    })
    .from(projectLifeAreas)
    .innerJoin(projects, eq(projects.id, projectLifeAreas.projectId))
    .where(
      and(
        eq(projectLifeAreas.userId, id),
        eq(projectLifeAreas.lifeAreaId, lifeAreaId),
        notDeleted(projects.deletedAt),
      ),
    )
    .orderBy(asc(projects.name));
}
