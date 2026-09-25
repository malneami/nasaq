import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  inboxItems,
  type InboxStatus,
  type InsertInboxItem,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listInboxItems(
  userId: string,
  filters?: { status?: InboxStatus },
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.userId, id),
        notDeleted(inboxItems.deletedAt),
        filters?.status ? eq(inboxItems.status, filters.status) : undefined,
      ),
    )
    .orderBy(desc(inboxItems.createdAt));
}

export async function getInboxItem(userId: string, inboxItemId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(inboxItems)
    .where(
      and(
        eq(inboxItems.userId, id),
        eq(inboxItems.id, inboxItemId),
        notDeleted(inboxItems.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createInboxItem(
  userId: string,
  values: Omit<InsertInboxItem, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(inboxItems)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateInboxItem(
  userId: string,
  inboxItemId: string,
  values: Partial<Omit<InsertInboxItem, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(inboxItems)
    .set(values)
    .where(and(eq(inboxItems.userId, id), eq(inboxItems.id, inboxItemId)))
    .returning();
  return row ?? null;
}

export async function deleteInboxItem(userId: string, inboxItemId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(inboxItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(inboxItems.userId, id), eq(inboxItems.id, inboxItemId)))
    .returning();
  return row ?? null;
}
