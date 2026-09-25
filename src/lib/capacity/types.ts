import type { EnergyLevel, EventType, ShiftKind } from '@/lib/db/schema';

export type CapacityEvent = {
  id?: string;
  title?: string;
  startsAt: Date;
  endsAt: Date;
  eventType: EventType;
  isProtected: boolean;
  shiftKind?: ShiftKind | null;
};

export type CapacityConfig = {
  wakeHm: string;
  sleepHm: string;
  energy: EnergyLevel;
  timeZone: string;
};

export type CapacityBreakdownCode =
  | 'waking'
  | 'shift'
  | 'meeting'
  | 'appointment'
  | 'family'
  | 'protected'
  | 'recovery'
  | 'night_recovery'
  | 'evening_recovery'
  | 'day_recovery'
  | 'energy';

export type CapacityBreakdownLine = {
  code: CapacityBreakdownCode;
  hours: number;
};

export type DayCapacity = {
  dateYmd: string;
  freeHours: number;
  productiveHours: number;
  breakdown: CapacityBreakdownLine[];
};

export type WeekCapacity = {
  weekStartYmd: string;
  days: DayCapacity[];
  freeHours: number;
  productiveHours: number;
};
