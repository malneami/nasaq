import { DEFAULT_TIMEZONE } from '@/lib/constants';
import {
  BUSY_EVENT_TYPES,
  CAPACITY_DEFAULTS,
  ENERGY_CAPACITY_FACTOR,
  SHIFT_RECOVERY_HOURS,
} from '@/lib/capacity/constants';
import { isProtectedKind } from '@/lib/capacity/protected';
import type {
  CapacityBreakdownLine,
  CapacityConfig,
  CapacityEvent,
  DayCapacity,
  WeekCapacity,
} from '@/lib/capacity/types';
import type { ShiftKind } from '@/lib/db/schema';
import {
  addDaysYmd,
  startOfWeekYmd,
  zonedDateTimeToUtc,
} from '@/lib/time/zoned';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function wakingWindow(
  ymd: string,
  config: CapacityConfig,
): { start: Date; end: Date } {
  const start = zonedDateTimeToUtc(ymd, config.wakeHm, config.timeZone);
  let end = zonedDateTimeToUtc(ymd, config.sleepHm, config.timeZone);
  if (end <= start) {
    end = zonedDateTimeToUtc(
      addDaysYmd(ymd, 1),
      config.sleepHm,
      config.timeZone,
    );
  }
  return { start, end };
}

function clip(
  start: Date,
  end: Date,
  winStart: Date,
  winEnd: Date,
): { start: number; end: number } | null {
  const s = Math.max(start.getTime(), winStart.getTime());
  const e = Math.min(end.getTime(), winEnd.getTime());
  return e > s ? { start: s, end: e } : null;
}

function unionHours(ranges: { start: number; end: number }[]): number {
  if (ranges.length === 0) {
    return 0;
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let total = 0;
  let curS = sorted[0].start;
  let curE = sorted[0].end;
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    if (next.start <= curE) {
      curE = Math.max(curE, next.end);
    } else {
      total += curE - curS;
      curS = next.start;
      curE = next.end;
    }
  }
  total += curE - curS;
  return total / 3_600_000;
}

function inferShiftKind(event: CapacityEvent, timeZone: string): ShiftKind | null {
  if (event.eventType !== 'shift') {
    return null;
  }
  if (event.shiftKind) {
    return event.shiftKind;
  }
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(event.startsAt)
      .find((part) => part.type === 'hour')?.value ?? 12,
  );
  if (hour >= 20 || hour < 6) {
    return 'night';
  }
  if (hour >= 14) {
    return 'evening';
  }
  return 'day';
}

function hadNightShiftOn(
  ymd: string,
  events: CapacityEvent[],
  config: CapacityConfig,
): boolean {
  const { start, end } = wakingWindow(ymd, config);
  return events.some((event) => {
    if (event.eventType !== 'shift') {
      return false;
    }
    if (!(event.startsAt < end && event.endsAt > start)) {
      return false;
    }
    return inferShiftKind(event, config.timeZone) === 'night';
  });
}

function shiftKindsOnDay(
  ymd: string,
  events: CapacityEvent[],
  config: CapacityConfig,
): ShiftKind[] {
  const { start, end } = wakingWindow(ymd, config);
  const kinds = new Set<ShiftKind>();
  for (const event of events) {
    if (event.eventType !== 'shift') {
      continue;
    }
    if (!(event.startsAt < end && event.endsAt > start)) {
      continue;
    }
    const kind = inferShiftKind(event, config.timeZone);
    if (kind) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}

/**
 * Pure day capacity. Pass already-expanded events (including previous-day
 * night shifts that overlap this window). No I/O.
 */
export function computeDayCapacity(
  ymd: string,
  events: CapacityEvent[],
  config: CapacityConfig,
  previousYmd?: string,
): DayCapacity {
  const window = wakingWindow(ymd, config);
  const wakingHours = (window.end.getTime() - window.start.getTime()) / 3_600_000;
  const breakdown: CapacityBreakdownLine[] = [
    { code: 'waking', hours: round1(wakingHours) },
  ];

  const busyByType: Partial<Record<(typeof BUSY_EVENT_TYPES)[number], { start: number; end: number }[]>> =
    {};
  const allBusy: { start: number; end: number }[] = [];

  for (const event of events) {
    const busyType = (BUSY_EVENT_TYPES as readonly string[]).includes(
      event.eventType,
    )
      ? (event.eventType as (typeof BUSY_EVENT_TYPES)[number])
      : isProtectedKind(event.eventType, event.isProtected)
        ? 'protected'
        : null;
    if (!busyType) {
      continue;
    }
    const clipped = clip(event.startsAt, event.endsAt, window.start, window.end);
    if (!clipped) {
      continue;
    }
    allBusy.push(clipped);
    const bucket = busyByType[busyType] ?? [];
    bucket.push(clipped);
    busyByType[busyType] = bucket;
  }

  for (const type of BUSY_EVENT_TYPES) {
    const hours = unionHours(busyByType[type] ?? []);
    if (hours > 0) {
      breakdown.push({ code: type, hours: -round1(hours) });
    }
  }

  const occupiedHours = unionHours(allBusy);
  const freeHours = round1(Math.max(0, wakingHours - occupiedHours));

  let recoveryHours = 0;
  const kinds = shiftKindsOnDay(ymd, events, config);
  for (const kind of kinds) {
    const hours = SHIFT_RECOVERY_HOURS[kind].sameDay;
    if (hours > 0) {
      recoveryHours += hours;
      breakdown.push({
        code: `${kind}_recovery` as CapacityBreakdownLine['code'],
        hours: -hours,
      });
    }
  }
  if (
    previousYmd &&
    hadNightShiftOn(previousYmd, events, config) &&
    !kinds.includes('night')
  ) {
    recoveryHours += SHIFT_RECOVERY_HOURS.night.nextDay;
    breakdown.push({
      code: 'night_recovery',
      hours: -SHIFT_RECOVERY_HOURS.night.nextDay,
    });
  }

  const afterRecovery = Math.max(0, freeHours - recoveryHours);
  const factor = ENERGY_CAPACITY_FACTOR[config.energy];
  let productiveHours = round1(afterRecovery * factor);
  if (factor < 1 && afterRecovery > 0) {
    breakdown.push({
      code: 'energy',
      hours: -round1(afterRecovery - productiveHours),
    });
  }
  productiveHours = round1(Math.max(0, Math.min(freeHours, productiveHours)));

  return {
    dateYmd: ymd,
    freeHours,
    productiveHours,
    breakdown,
  };
}

export function computeWeekCapacity(
  weekStartYmd: string,
  events: CapacityEvent[],
  config: CapacityConfig,
): WeekCapacity {
  const days: DayCapacity[] = [];
  for (let i = 0; i < 7; i += 1) {
    const ymd = addDaysYmd(weekStartYmd, i);
    const previous = addDaysYmd(ymd, -1);
    days.push(computeDayCapacity(ymd, events, config, previous));
  }
  return {
    weekStartYmd,
    days,
    freeHours: round1(days.reduce((sum, day) => sum + day.freeHours, 0)),
    productiveHours: round1(
      days.reduce((sum, day) => sum + day.productiveHours, 0),
    ),
  };
}

export function defaultCapacityConfig(
  overrides?: Partial<CapacityConfig>,
): CapacityConfig {
  return {
    wakeHm: overrides?.wakeHm ?? CAPACITY_DEFAULTS.wakeHm,
    sleepHm: overrides?.sleepHm ?? CAPACITY_DEFAULTS.sleepHm,
    energy: overrides?.energy ?? CAPACITY_DEFAULTS.energy,
    timeZone: overrides?.timeZone ?? DEFAULT_TIMEZONE,
  };
}

export function weekStartFor(ymd: string, timeZone: string): string {
  return startOfWeekYmd(ymd, timeZone, 0);
}
