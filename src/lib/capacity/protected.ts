import type { EventType } from '@/lib/db/schema';
import { PROTECTED_EVENT_TYPES } from '@/lib/capacity/constants';
import type { CapacityEvent } from '@/lib/capacity/types';

export function isProtectedKind(
  eventType: EventType,
  isProtectedFlag: boolean,
): boolean {
  return (
    isProtectedFlag ||
    (PROTECTED_EVENT_TYPES as readonly string[]).includes(eventType)
  );
}

/** Pure: true if any protected/family/recovery block overlaps [start, end). */
export function rangeIsProtected(
  start: Date,
  end: Date,
  events: CapacityEvent[],
): boolean {
  if (end <= start) {
    return false;
  }
  return events.some((event) => {
    if (!isProtectedKind(event.eventType, event.isProtected)) {
      return false;
    }
    return event.startsAt < end && event.endsAt > start;
  });
}
