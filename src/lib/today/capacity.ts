import type { EventType } from '@/lib/db/schema';
import { zonedDateTimeToUtc } from '@/lib/time/zoned';

export const PROVISIONAL_WINDOW = { startHm: '08:00', endHm: '18:00' } as const;

type TimedBlock = {
  startsAt: Date;
  endsAt: Date;
  eventType: EventType;
};

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Placeholder productive hours until the Task 8 capacity engine exists.
 * Uses a shift if one falls on the day; otherwise 08:00–18:00, minus overlapping events.
 */
export function estimateProvisionalHours(input: {
  ymd: string;
  timeZone: string;
  events: TimedBlock[];
}): number {
  const shifts = input.events.filter((event) => event.eventType === 'shift');
  const windowStart = shifts.length
    ? Math.min(...shifts.map((event) => event.startsAt.getTime()))
    : zonedDateTimeToUtc(input.ymd, PROVISIONAL_WINDOW.startHm, input.timeZone).getTime();
  const windowEnd = shifts.length
    ? Math.max(...shifts.map((event) => event.endsAt.getTime()))
    : zonedDateTimeToUtc(input.ymd, PROVISIONAL_WINDOW.endHm, input.timeZone).getTime();

  const span = Math.max(0, windowEnd - windowStart);
  if (span === 0) {
    return 0;
  }

  let busy = 0;
  for (const event of input.events) {
    if (event.eventType === 'shift') {
      continue;
    }
    busy += overlapMs(
      windowStart,
      windowEnd,
      event.startsAt.getTime(),
      event.endsAt.getTime(),
    );
  }

  const freeHours = (span - Math.min(busy, span)) / 3_600_000;
  return Math.round(Math.max(0, Math.min(12, freeHours)) * 10) / 10;
}
