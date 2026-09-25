import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import {
  listCalendarEvents,
  listTimeBlocks,
} from '@/lib/db/queries/calendar';
import { getProfile } from '@/lib/db/queries/profiles';
import {
  expandRecurring,
  expandWeeklyBlock,
  parseRecurrence,
} from '@/lib/calendar/recurrence';
import {
  computeDayCapacity,
  computeWeekCapacity,
  defaultCapacityConfig,
  weekStartFor,
} from '@/lib/capacity/compute';
import { rangeIsProtected } from '@/lib/capacity/protected';
import type {
  CapacityConfig,
  CapacityEvent,
  DayCapacity,
  WeekCapacity,
} from '@/lib/capacity/types';
import { weekdayFromYmd, zonedDayRange } from '@/lib/time/zoned';
import type { EnergyLevel } from '@/lib/db/schema';
import type { OccurringEvent } from '@/lib/calendar/types';

export type { OccurringEvent };

function configFromProfile(
  prefs: {
    wake_hm?: string;
    sleep_hm?: string;
    daily_energy?: EnergyLevel;
  } | null | undefined,
  timeZone: string,
): CapacityConfig {
  return defaultCapacityConfig({
    wakeHm: prefs?.wake_hm,
    sleepHm: prefs?.sleep_hm,
    energy: prefs?.daily_energy,
    timeZone,
  });
}

export async function loadCapacityEvents(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): Promise<CapacityEvent[]> {
  const [rows, blocks] = await Promise.all([
    listCalendarEvents(userId),
    listTimeBlocks(userId),
  ]);
  const events: CapacityEvent[] = [];

  for (const row of rows) {
    const rec = parseRecurrence(row.recurrence);
    const parts = expandRecurring(
      row.startsAt,
      row.endsAt,
      rec,
      rangeStart,
      rangeEnd,
      timeZone,
    );
    for (const part of parts) {
      events.push({
        id: row.id,
        title: row.title,
        startsAt: part.startsAt,
        endsAt: part.endsAt,
        eventType: row.eventType,
        isProtected: row.isProtected,
        shiftKind: row.shiftKind,
      });
    }
  }

  for (const block of blocks) {
    const weekday =
      block.weekday ?? weekdayFromYmd(block.startsAt.toISOString().slice(0, 10), timeZone);
    const startHm =
      block.startHm ??
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(block.startsAt);
    const endHm =
      block.endHm ??
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(block.endsAt);
    const parts = expandWeeklyBlock({
      weekday,
      startHm,
      endHm,
      rangeStart,
      rangeEnd,
      timeZone,
    });
    for (const part of parts) {
      events.push({
        id: block.id,
        title: block.label,
        startsAt: part.startsAt,
        endsAt: part.endsAt,
        eventType: block.eventType,
        isProtected: block.isProtected,
        shiftKind: null,
      });
    }
  }

  return events;
}

export async function listOccurrences(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): Promise<OccurringEvent[]> {
  const [rows, blocks] = await Promise.all([
    listCalendarEvents(userId),
    listTimeBlocks(userId),
  ]);
  const out: OccurringEvent[] = [];

  for (const row of rows) {
    const rec = parseRecurrence(row.recurrence);
    const parts = expandRecurring(
      row.startsAt,
      row.endsAt,
      rec,
      rangeStart,
      rangeEnd,
      timeZone,
    );
    for (const part of parts) {
      out.push({
        id: row.id,
        source: 'event',
        occurrenceKey: `${row.id}:${part.startsAt.toISOString()}`,
        title: row.title,
        eventType: row.eventType,
        startsAt: part.startsAt.toISOString(),
        endsAt: part.endsAt.toISOString(),
        allDay: row.allDay,
        projectId: row.projectId,
        contactId: row.contactId,
        isProtected: row.isProtected,
        notes: row.notes,
        shiftKind: row.shiftKind,
        recurring: Boolean(rec),
      });
    }
  }

  for (const block of blocks) {
    const weekday =
      block.weekday ??
      weekdayFromYmd(block.startsAt.toISOString().slice(0, 10), timeZone);
    const startHm = block.startHm ?? '22:00';
    const endHm = block.endHm ?? '23:00';
    const parts = expandWeeklyBlock({
      weekday,
      startHm,
      endHm,
      rangeStart,
      rangeEnd,
      timeZone,
    });
    for (const part of parts) {
      out.push({
        id: block.id,
        source: 'block',
        occurrenceKey: `${block.id}:${part.startsAt.toISOString()}`,
        title: block.label,
        eventType: block.eventType,
        startsAt: part.startsAt.toISOString(),
        endsAt: part.endsAt.toISOString(),
        allDay: false,
        projectId: null,
        contactId: null,
        isProtected: block.isProtected,
        notes: null,
        shiftKind: null,
        recurring: true,
      });
    }
  }

  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}

export async function getCapacity(
  userId: string,
  dateYmd: string,
): Promise<DayCapacity> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const config = configFromProfile(profile?.preferences, timeZone);
  const prev = new Date(dateYmd);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevYmd = prev.toISOString().slice(0, 10);
  const range = {
    start: zonedDayRange(prevYmd, timeZone).start,
    end: zonedDayRange(dateYmd, timeZone).end,
  };
  const events = await loadCapacityEvents(
    userId,
    range.start,
    range.end,
    timeZone,
  );
  return computeDayCapacity(dateYmd, events, config, prevYmd);
}

export async function getWeekCapacity(
  userId: string,
  weekStartYmd: string,
): Promise<WeekCapacity> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const config = configFromProfile(profile?.preferences, timeZone);
  const prevYmd = new Date(weekStartYmd);
  prevYmd.setUTCDate(prevYmd.getUTCDate() - 1);
  const prev = prevYmd.toISOString().slice(0, 10);
  const last = new Date(weekStartYmd);
  last.setUTCDate(last.getUTCDate() + 6);
  const lastYmd = last.toISOString().slice(0, 10);
  const events = await loadCapacityEvents(
    userId,
    zonedDayRange(prev, timeZone).start,
    zonedDayRange(lastYmd, timeZone).end,
    timeZone,
  );
  return computeWeekCapacity(weekStartYmd, events, config);
}

export async function isProtected(
  userId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const events = await loadCapacityEvents(userId, start, end, timeZone);
  return rangeIsProtected(start, end, events);
}

export { weekStartFor, defaultCapacityConfig };
