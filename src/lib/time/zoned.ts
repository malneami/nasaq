import { DEFAULT_TIMEZONE } from '@/lib/constants';

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function ymdInTimeZone(
  date: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function hourInTimeZone(
  date: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;
  return Number(hour ?? 0);
}

export function minuteInTimeZone(
  date: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  const minute = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    minute: '2-digit',
  })
    .formatToParts(date)
    .find((part) => part.type === 'minute')?.value;
  return Number(minute ?? 0);
}

export function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = ymdToUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthStartYmd(ymd: string): string {
  return `${ymd.slice(0, 8)}01`;
}

function clockParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    ymd: `${pick('year')}-${pick('month')}-${pick('day')}`,
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedDateTimeToUtc(
  ymd: string,
  timeHm: string,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const utcGuess = Date.parse(`${ymd}T${timeHm}:00.000Z`);
  const instant = new Date(utcGuess);
  const zoned = clockParts(instant, timeZone);
  const asIfUtc = Date.parse(
    `${zoned.ymd}T${zoned.hour}:${zoned.minute}:${zoned.second}.000Z`,
  );
  return new Date(utcGuess - (asIfUtc - utcGuess));
}

export function zonedDayRange(
  ymd: string,
  timeZone: string = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(ymd, '00:00', timeZone),
    end: zonedDateTimeToUtc(addDaysYmd(ymd, 1), '00:00', timeZone),
  };
}

export type GreetingSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export function greetingSlot(
  date: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): GreetingSlot {
  const hour = hourInTimeZone(date, timeZone);
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'evening';
  }
  return 'night';
}

export function formatYmdLocalized(
  ymd: string,
  locale: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const instant = zonedDateTimeToUtc(ymd, '12:00', timeZone);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}

export function formatTimeInZone(
  date: Date,
  locale: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** 0 = Sunday … 6 = Saturday in the given zone. */
export function weekdayFromYmd(
  ymd: string,
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  const instant = zonedDateTimeToUtc(ymd, '12:00', timeZone);
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(instant);
  return WEEKDAY_SHORT[short] ?? 0;
}

export function startOfWeekYmd(
  ymd: string,
  timeZone: string = DEFAULT_TIMEZONE,
  weekStartsOn = 0,
): string {
  const weekday = weekdayFromYmd(ymd, timeZone);
  const delta = (weekday - weekStartsOn + 7) % 7;
  return addDaysYmd(ymd, -delta);
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const from = ymdToUtcDate(fromYmd).getTime();
  const to = ymdToUtcDate(toYmd).getTime();
  return Math.round((to - from) / 86_400_000);
}
