import type { EventType } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

/** Color classes for calendar event chips — muted for sacred time. */
export function eventTypeClass(eventType: EventType, isProtected: boolean) {
  if (eventType === 'family' || (isProtected && eventType !== 'shift')) {
    return 'border-amber-600/40 bg-amber-500/15 text-amber-950 dark:text-amber-100';
  }
  if (eventType === 'protected' || eventType === 'recovery') {
    return 'border-sky-600/35 bg-sky-500/12 text-sky-950 dark:text-sky-100';
  }
  const map: Record<EventType, string> = {
    shift: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-950 dark:text-indigo-100',
    meeting: 'border-border bg-muted/70 text-foreground',
    family: 'border-amber-600/40 bg-amber-500/15 text-amber-950 dark:text-amber-100',
    appointment: 'border-teal-500/40 bg-teal-500/12 text-teal-950 dark:text-teal-100',
    deep_work: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100',
    recovery: 'border-sky-600/35 bg-sky-500/12 text-sky-950 dark:text-sky-100',
    protected: 'border-sky-600/35 bg-sky-500/12 text-sky-950 dark:text-sky-100',
    other: 'border-border bg-secondary text-secondary-foreground',
  };
  return map[eventType];
}

export function capacityBarClass(free: number, productive: number) {
  const ratio = free <= 0 ? 0 : Math.min(1, productive / free);
  return cn(
    'h-1.5 rounded-full bg-muted overflow-hidden',
    ratio < 0.45 && 'ring-1 ring-amber-500/40',
  );
}
