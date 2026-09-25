import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  commitments,
  waitingItems,
  type InsertCommitment,
  type InsertWaitingItem,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listCommitments(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(commitments)
    .where(and(eq(commitments.userId, id), notDeleted(commitments.deletedAt)))
    .orderBy(desc(commitments.updatedAt));
}

export async function getCommitment(userId: string, commitmentId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.userId, id),
        eq(commitments.id, commitmentId),
        notDeleted(commitments.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createCommitment(
  userId: string,
  values: Omit<InsertCommitment, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(commitments)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateCommitment(
  userId: string,
  commitmentId: string,
  values: Partial<Omit<InsertCommitment, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(commitments)
    .set(values)
    .where(and(eq(commitments.userId, id), eq(commitments.id, commitmentId)))
    .returning();
  return row ?? null;
}

export async function deleteCommitment(userId: string, commitmentId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(commitments)
    .set({ deletedAt: new Date() })
    .where(and(eq(commitments.userId, id), eq(commitments.id, commitmentId)))
    .returning();
  return row ?? null;
}

export async function listWaitingItems(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(waitingItems)
    .where(and(eq(waitingItems.userId, id), notDeleted(waitingItems.deletedAt)))
    .orderBy(desc(waitingItems.updatedAt));
}

export async function getWaitingItem(userId: string, waitingItemId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(waitingItems)
    .where(
      and(
        eq(waitingItems.userId, id),
        eq(waitingItems.id, waitingItemId),
        notDeleted(waitingItems.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listCommitmentsForContact(
  userId: string,
  contactId: string,
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.userId, id),
        eq(commitments.contactId, contactId),
        notDeleted(commitments.deletedAt),
      ),
    )
    .orderBy(desc(commitments.updatedAt));
}

export async function listWaitingForContact(userId: string, contactId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(waitingItems)
    .where(
      and(
        eq(waitingItems.userId, id),
        eq(waitingItems.contactId, contactId),
        notDeleted(waitingItems.deletedAt),
      ),
    )
    .orderBy(desc(waitingItems.updatedAt));
}

export async function createWaitingItem(
  userId: string,
  values: Omit<InsertWaitingItem, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(waitingItems)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateWaitingItem(
  userId: string,
  waitingItemId: string,
  values: Partial<Omit<InsertWaitingItem, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(waitingItems)
    .set(values)
    .where(and(eq(waitingItems.userId, id), eq(waitingItems.id, waitingItemId)))
    .returning();
  return row ?? null;
}

export async function deleteWaitingItem(userId: string, waitingItemId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(waitingItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(waitingItems.userId, id), eq(waitingItems.id, waitingItemId)))
    .returning();
  return row ?? null;
}
