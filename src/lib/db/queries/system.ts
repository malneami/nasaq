import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  aiRecommendations,
  auditLogs,
  notifications,
  type InsertAiRecommendation,
  type InsertAuditLog,
  type InsertNotification,
} from '@/lib/db/schema';
import { assertUserId } from './helpers';

export async function listAiRecommendationsForSubject(
  userId: string,
  subjectType: string,
  subjectId: string,
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(aiRecommendations)
    .where(
      and(
        eq(aiRecommendations.userId, id),
        eq(aiRecommendations.subjectType, subjectType),
        eq(aiRecommendations.subjectId, subjectId),
      ),
    )
    .orderBy(desc(aiRecommendations.createdAt));
}

export async function updateAiRecommendation(
  userId: string,
  recommendationId: string,
  values: Partial<Omit<InsertAiRecommendation, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(aiRecommendations)
    .set(values)
    .where(
      and(
        eq(aiRecommendations.userId, id),
        eq(aiRecommendations.id, recommendationId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listAiRecommendations(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(aiRecommendations)
    .where(eq(aiRecommendations.userId, id))
    .orderBy(desc(aiRecommendations.createdAt));
}

export async function getAiRecommendation(
  userId: string,
  recommendationId: string,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(aiRecommendations)
    .where(
      and(
        eq(aiRecommendations.userId, id),
        eq(aiRecommendations.id, recommendationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createAiRecommendation(
  userId: string,
  values: Omit<InsertAiRecommendation, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(aiRecommendations)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function listNotifications(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, id))
    .orderBy(desc(notifications.createdAt));
}

export async function createNotification(
  userId: string,
  values: Omit<InsertNotification, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(notifications)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.userId, id), eq(notifications.id, notificationId)),
    )
    .returning();
  return row ?? null;
}

export async function listAuditLogs(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, id))
    .orderBy(desc(auditLogs.createdAt));
}

export async function createAuditLog(
  userId: string,
  values: Omit<InsertAuditLog, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(auditLogs)
    .values({ ...values, userId: id })
    .returning();
  return row;
}
