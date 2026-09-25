import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { projectNotes, type InsertProjectNote } from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listProjectNotes(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projectNotes)
    .where(
      and(
        eq(projectNotes.userId, id),
        eq(projectNotes.projectId, projectId),
        notDeleted(projectNotes.deletedAt),
      ),
    )
    .orderBy(desc(projectNotes.updatedAt));
}

export async function createProjectNote(
  userId: string,
  values: Omit<InsertProjectNote, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(projectNotes)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateProjectNote(
  userId: string,
  noteId: string,
  values: Partial<Omit<InsertProjectNote, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(projectNotes)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(projectNotes.userId, id), eq(projectNotes.id, noteId)))
    .returning();
  return row ?? null;
}

export async function deleteProjectNote(userId: string, noteId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(projectNotes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projectNotes.userId, id), eq(projectNotes.id, noteId)))
    .returning();
  return row ?? null;
}
