import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { profiles, type InsertProfile } from '@/lib/db/schema';
import { assertUserId } from './helpers';

export async function getProfile(userId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, id))
    .limit(1);
  return row ?? null;
}

export async function upsertProfile(
  userId: string,
  values: Omit<InsertProfile, 'userId'>,
) {
  const id = assertUserId(userId);
  const db = getDb();
  const [row] = await db
    .insert(profiles)
    .values({ ...values, userId: id })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: values,
    })
    .returning();
  return row;
}

export async function updateProfile(
  userId: string,
  values: Partial<Omit<InsertProfile, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(profiles)
    .set(values)
    .where(eq(profiles.userId, id))
    .returning();
  return row ?? null;
}
