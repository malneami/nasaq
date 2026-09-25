import type { DayCapacity, WeekCapacity } from '@/lib/capacity/types';
import type { EventType, ShiftKind } from '@/lib/db/schema';

export type OccurringEvent = {
  id: string;
  source: 'event' | 'block';
  occurrenceKey: string;
  title: string;
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  projectId: string | null;
  contactId: string | null;
  isProtected: boolean;
  notes: string | null;
  shiftKind: ShiftKind | null;
  recurring: boolean;
};

export type ProtectedBlockDto = {
  id: string;
  label: string;
  eventType: string;
  weekday: number;
  startHm: string;
  endHm: string;
  isProtected: boolean;
};

export type CalendarBoardDto = {
  view: 'day' | 'week' | 'month';
  anchorYmd: string;
  weekStartYmd: string;
  rangeStartYmd: string;
  rangeEndYmd: string;
  timeZone: string;
  events: OccurringEvent[];
  weekCapacity: WeekCapacity | null;
  dayCapacity: DayCapacity | null;
  protectedBlocks: ProtectedBlockDto[];
};
