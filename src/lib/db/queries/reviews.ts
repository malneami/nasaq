import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  dailyBriefs,
  weeklyReviews,
  type InsertDailyBrief,
  type InsertWeeklyReview,
  type ReviewType,
} from '@/lib/db/schema';
import { assertUserId } from './helpers';

export async function listDailyBriefs(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(dailyBriefs)
    .where(eq(dailyBriefs.userId, id))
    .orderBy(desc(dailyBriefs.briefDate));
}

export async function getDailyBrief(userId: string, briefDate: Date) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(dailyBriefs)
    .where(
      and(eq(dailyBriefs.userId, id), eq(dailyBriefs.briefDate, briefDate)),
    )
    .limit(1);
  return row ?? null;
}

export async function createDailyBrief(
  userId: string,
  values: Omit<InsertDailyBrief, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(dailyBriefs)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function upsertDailyBrief(
  userId: string,
  briefDate: Date,
  content: Record<string, unknown>,
) {
  const id = assertUserId(userId);
  const existing = await getDailyBrief(id, briefDate);
  const now = new Date();
  if (existing) {
    const [row] = await getDb()
      .update(dailyBriefs)
      .set({ content, generatedAt: now, updatedAt: now })
      .where(and(eq(dailyBriefs.userId, id), eq(dailyBriefs.id, existing.id)))
      .returning();
    return row ?? existing;
  }
  try {
    return await createDailyBrief(id, {
      briefDate,
      content,
      generatedAt: now,
    });
  } catch {
    const raced = await getDailyBrief(id, briefDate);
    if (!raced) {
      throw new Error('Could not persist daily brief.');
    }
    const [row] = await getDb()
      .update(dailyBriefs)
      .set({ content, generatedAt: now, updatedAt: now })
      .where(and(eq(dailyBriefs.userId, id), eq(dailyBriefs.id, raced.id)))
      .returning();
    return row ?? raced;
  }
}

export async function listWeeklyReviews(
  userId: string,
  reviewType?: ReviewType,
) {
  const id = assertUserId(userId);
  const clauses = [eq(weeklyReviews.userId, id)];
  if (reviewType) {
    clauses.push(eq(weeklyReviews.reviewType, reviewType));
  }
  return getDb()
    .select()
    .from(weeklyReviews)
    .where(and(...clauses))
    .orderBy(desc(weeklyReviews.periodStart));
}

export async function getWeeklyReviewByPeriod(
  userId: string,
  reviewType: ReviewType,
  periodStart: Date,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.userId, id),
        eq(weeklyReviews.reviewType, reviewType),
        eq(weeklyReviews.periodStart, periodStart),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createWeeklyReview(
  userId: string,
  values: Omit<InsertWeeklyReview, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(weeklyReviews)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function upsertWeeklyReview(
  userId: string,
  values: {
    reviewType: ReviewType;
    periodStart: Date;
    periodEnd: Date;
    content: Record<string, unknown>;
    topOutcomes?: unknown[] | null;
  },
) {
  const id = assertUserId(userId);
  const existing = await getWeeklyReviewByPeriod(
    id,
    values.reviewType,
    values.periodStart,
  );
  const now = new Date();
  if (existing) {
    const [row] = await getDb()
      .update(weeklyReviews)
      .set({
        periodEnd: values.periodEnd,
        content: values.content,
        topOutcomes: values.topOutcomes ?? existing.topOutcomes,
        updatedAt: now,
      })
      .where(
        and(eq(weeklyReviews.userId, id), eq(weeklyReviews.id, existing.id)),
      )
      .returning();
    return row ?? existing;
  }
  return createWeeklyReview(id, {
    reviewType: values.reviewType,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    content: values.content,
    topOutcomes: values.topOutcomes ?? null,
  });
}
