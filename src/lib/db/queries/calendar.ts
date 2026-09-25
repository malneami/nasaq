import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  calendarEvents,
  timeBlocks,
  type InsertCalendarEvent,
  type InsertTimeBlock,
} from '@/lib/db/schema';
import { assertUserId } from './helpers';

export async function listCalendarEvents(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.userId, id))
    .orderBy(asc(calendarEvents.startsAt));
}

export async function listCalendarEventsInRange(
  userId: string,
  start: Date,
  end: Date,
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, id),
        lte(calendarEvents.startsAt, end),
        gte(calendarEvents.endsAt, start),
      ),
    )
    .orderBy(asc(calendarEvents.startsAt));
}

export async function getCalendarEvent(userId: string, eventId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, id), eq(calendarEvents.id, eventId)))
    .limit(1);
  return row ?? null;
}

export async function createCalendarEvent(
  userId: string,
  values: Omit<InsertCalendarEvent, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(calendarEvents)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  values: Partial<Omit<InsertCalendarEvent, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(calendarEvents)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(calendarEvents.userId, id), eq(calendarEvents.id, eventId)))
    .returning();
  return row ?? null;
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.userId, id), eq(calendarEvents.id, eventId)))
    .returning();
  return row ?? null;
}

export async function listTimeBlocks(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(timeBlocks)
    .where(eq(timeBlocks.userId, id))
    .orderBy(asc(timeBlocks.startsAt));
}

export async function createTimeBlock(
  userId: string,
  values: Omit<InsertTimeBlock, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(timeBlocks)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateTimeBlock(
  userId: string,
  blockId: string,
  values: Partial<Omit<InsertTimeBlock, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(timeBlocks)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(timeBlocks.userId, id), eq(timeBlocks.id, blockId)))
    .returning();
  return row ?? null;
}

export async function deleteTimeBlock(userId: string, blockId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .delete(timeBlocks)
    .where(and(eq(timeBlocks.userId, id), eq(timeBlocks.id, blockId)))
    .returning();
  return row ?? null;
}
