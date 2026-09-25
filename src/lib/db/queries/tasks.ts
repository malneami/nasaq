import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  taskLifeAreas,
  tasks,
  type InsertTask,
  type TaskStatus,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listTasks(
  userId: string,
  filters?: { status?: TaskStatus; statuses?: TaskStatus[]; projectId?: string },
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, id),
        notDeleted(tasks.deletedAt),
        filters?.status ? eq(tasks.status, filters.status) : undefined,
        filters?.statuses && filters.statuses.length > 0
          ? inArray(tasks.status, filters.statuses)
          : undefined,
        filters?.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
      ),
    )
    .orderBy(desc(tasks.updatedAt));
}

export async function getTask(userId: string, taskId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, id),
        eq(tasks.id, taskId),
        notDeleted(tasks.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createTask(
  userId: string,
  values: Omit<InsertTask, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(tasks)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateTask(
  userId: string,
  taskId: string,
  values: Partial<Omit<InsertTask, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(tasks)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(tasks.userId, id), eq(tasks.id, taskId)))
    .returning();
  return row ?? null;
}

export async function deleteTask(userId: string, taskId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasks.userId, id), eq(tasks.id, taskId)))
    .returning();
  return row ?? null;
}

export async function listTaskLifeAreaIds(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) {
    return [];
  }
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(taskLifeAreas)
    .where(
      and(eq(taskLifeAreas.userId, id), inArray(taskLifeAreas.taskId, taskIds)),
    );
}

export async function setTaskLifeAreas(
  userId: string,
  taskId: string,
  lifeAreaIds: string[],
) {
  const id = assertUserId(userId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(taskLifeAreas)
      .where(and(eq(taskLifeAreas.userId, id), eq(taskLifeAreas.taskId, taskId)));
    if (lifeAreaIds.length === 0) {
      return;
    }
    await tx.insert(taskLifeAreas).values(
      lifeAreaIds.map((lifeAreaId) => ({
        userId: id,
        taskId,
        lifeAreaId,
      })),
    );
  });
}
