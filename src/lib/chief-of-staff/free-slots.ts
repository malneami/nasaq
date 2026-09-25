import 'server-only';

import { getCapacity, loadCapacityEvents } from '@/lib/capacity/service';
import { rangeIsProtected } from '@/lib/capacity/protected';
import { getProfile } from '@/lib/db/queries/profiles';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { zonedDayRange, ymdInTimeZone } from '@/lib/time/zoned';

export type FreeSlot = {
  startsAt: string;
  endsAt: string;
  minutes: number;
};

/**
 * Find free NON-protected slots on a day for a requested duration.
 * Never proposes into protected/family/recovery blocks.
 */
export async function findFreeSlots(
  userId: string,
  input: { dateYmd?: string; minutes: number; limit?: number },
): Promise<FreeSlot[]> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const dateYmd =
    input.dateYmd ?? ymdInTimeZone(new Date(), timeZone);
  const need = Math.max(15, Math.min(240, input.minutes));
  const limit = input.limit ?? 3;

  const { start, end } = zonedDayRange(dateYmd, timeZone);
  const events = await loadCapacityEvents(userId, start, end, timeZone);
  const capacity = await getCapacity(userId, dateYmd);

  if (capacity.productiveHours <= 0) {
    return [];
  }

  const slots: FreeSlot[] = [];
  const stepMs = 15 * 60_000;
  const needMs = need * 60_000;
  let cursor = start.getTime();
  const dayEnd = end.getTime();

  // Skip overnight: start scanning from wake-ish (capacity already accounts for wake)
  while (cursor + needMs <= dayEnd && slots.length < limit) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + needMs);
    const protectedHit = rangeIsProtected(slotStart, slotEnd, events);
    if (!protectedHit) {
      // Also reject if any overlapping event (meeting etc.) — treat busy as blocked
      const busy = events.some((ev) => {
        const a = ev.startsAt.getTime();
        const b = ev.endsAt.getTime();
        return a < slotEnd.getTime() && b > slotStart.getTime();
      });
      if (!busy) {
        slots.push({
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString(),
          minutes: need,
        });
        cursor += needMs;
        continue;
      }
    }
    cursor += stepMs;
  }

  return slots;
}
