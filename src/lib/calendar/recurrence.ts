import type { RecurrenceRule } from '@/lib/db/schema';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import {
  addDaysYmd,
  weekdayFromYmd,
  ymdInTimeZone,
  zonedDateTimeToUtc,
} from '@/lib/time/zoned';

export function parseRecurrence(value: unknown): RecurrenceRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const rec = value as RecurrenceRule;
  if (rec.freq !== 'daily' && rec.freq !== 'weekly') {
    return null;
  }
  const interval = Number(rec.interval) || 1;
  return {
    freq: rec.freq,
    interval: Math.max(1, Math.min(30, interval)),
    byWeekday: rec.byWeekday,
    until: rec.until,
  };
}

function clockHm(source: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(source);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

function sameClock(source: Date, targetYmd: string, timeZone: string): Date {
  return zonedDateTimeToUtc(targetYmd, clockHm(source, timeZone), timeZone);
}

/**
 * Expand a seeded event across [rangeStart, rangeEnd). Duration is preserved.
 */
export function expandRecurring(
  seedStart: Date,
  seedEnd: Date,
  recurrence: RecurrenceRule | null,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): { startsAt: Date; endsAt: Date }[] {
  const duration = seedEnd.getTime() - seedStart.getTime();
  if (duration <= 0) {
    return [];
  }
  if (!recurrence) {
    if (seedStart < rangeEnd && seedEnd > rangeStart) {
      return [{ startsAt: seedStart, endsAt: seedEnd }];
    }
    return [];
  }

  const seedYmd = ymdInTimeZone(seedStart, timeZone);
  const rangeStartYmd = ymdInTimeZone(rangeStart, timeZone);
  const rangeEndYmd = ymdInTimeZone(new Date(rangeEnd.getTime() - 1), timeZone);
  const untilYmd =
    recurrence.until && recurrence.until < rangeEndYmd
      ? recurrence.until
      : rangeEndYmd;

  const out: { startsAt: Date; endsAt: Date }[] = [];
  const interval = recurrence.interval;

  if (recurrence.freq === 'daily') {
    let cursor = seedYmd < rangeStartYmd ? rangeStartYmd : seedYmd;
    const seedDay = Date.parse(`${seedYmd}T00:00:00Z`);
    while (cursor <= untilYmd && out.length < 400) {
      const days = Math.round(
        (Date.parse(`${cursor}T00:00:00Z`) - seedDay) / 86_400_000,
      );
      if (days >= 0 && days % interval === 0) {
        const startsAt = sameClock(seedStart, cursor, timeZone);
        const endsAt = new Date(startsAt.getTime() + duration);
        if (startsAt < rangeEnd && endsAt > rangeStart) {
          out.push({ startsAt, endsAt });
        }
      }
      cursor = addDaysYmd(cursor, 1);
    }
    return out;
  }

  const days = recurrence.byWeekday?.length
    ? recurrence.byWeekday
    : [weekdayFromYmd(seedYmd, timeZone)];
  let cursor = seedYmd < rangeStartYmd ? rangeStartYmd : seedYmd;
  const seedWeekStart = Date.parse(`${seedYmd}T00:00:00Z`);
  while (cursor <= untilYmd && out.length < 400) {
    const wd = weekdayFromYmd(cursor, timeZone);
    if (days.includes(wd)) {
      const weeks = Math.floor(
        Math.round(
          (Date.parse(`${cursor}T00:00:00Z`) - seedWeekStart) / 86_400_000,
        ) / 7,
      );
      if (weeks >= 0 && weeks % interval === 0) {
        const startsAt = sameClock(seedStart, cursor, timeZone);
        const endsAt = new Date(startsAt.getTime() + duration);
        if (startsAt < rangeEnd && endsAt > rangeStart) {
          out.push({ startsAt, endsAt });
        }
      }
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}

export function expandWeeklyBlock(input: {
  weekday: number;
  startHm: string;
  endHm: string;
  rangeStart: Date;
  rangeEnd: Date;
  timeZone?: string;
}): { startsAt: Date; endsAt: Date }[] {
  const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
  let cursor = ymdInTimeZone(input.rangeStart, timeZone);
  const last = ymdInTimeZone(
    new Date(input.rangeEnd.getTime() - 1),
    timeZone,
  );
  const out: { startsAt: Date; endsAt: Date }[] = [];
  while (cursor <= last && out.length < 400) {
    if (weekdayFromYmd(cursor, timeZone) === input.weekday) {
      const startsAt = zonedDateTimeToUtc(cursor, input.startHm, timeZone);
      let endsAt = zonedDateTimeToUtc(cursor, input.endHm, timeZone);
      if (endsAt <= startsAt) {
        endsAt = zonedDateTimeToUtc(
          addDaysYmd(cursor, 1),
          input.endHm,
          timeZone,
        );
      }
      if (startsAt < input.rangeEnd && endsAt > input.rangeStart) {
        out.push({ startsAt, endsAt });
      }
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}
