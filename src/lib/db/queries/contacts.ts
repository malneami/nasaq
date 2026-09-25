import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  contacts,
  interactions,
  type InsertContact,
  type InsertInteraction,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listContacts(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(contacts)
    .where(and(eq(contacts.userId, id), notDeleted(contacts.deletedAt)))
    .orderBy(asc(contacts.name));
}

export async function getContact(userId: string, contactId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.userId, id),
        eq(contacts.id, contactId),
        notDeleted(contacts.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createContact(
  userId: string,
  values: Omit<InsertContact, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(contacts)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateContact(
  userId: string,
  contactId: string,
  values: Partial<Omit<InsertContact, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(contacts)
    .set(values)
    .where(and(eq(contacts.userId, id), eq(contacts.id, contactId)))
    .returning();
  return row ?? null;
}

export async function deleteContact(userId: string, contactId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(contacts)
    .set({ deletedAt: new Date() })
    .where(and(eq(contacts.userId, id), eq(contacts.id, contactId)))
    .returning();
  return row ?? null;
}

export async function listInteractions(userId: string, contactId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(interactions)
    .where(
      and(eq(interactions.userId, id), eq(interactions.contactId, contactId)),
    )
    .orderBy(desc(interactions.occurredAt));
}

export async function createInteraction(
  userId: string,
  values: Omit<InsertInteraction, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(interactions)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

/** Log an interaction and bump last_interaction_at on the contact. */
export async function logInteraction(
  userId: string,
  values: Omit<InsertInteraction, 'userId'>,
) {
  const row = await createInteraction(userId, values);
  const occurredAt = values.occurredAt ?? new Date();
  await updateContact(userId, values.contactId, {
    lastInteractionAt: occurredAt,
    updatedAt: new Date(),
  });
  return row;
}
