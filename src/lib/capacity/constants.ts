import type { EnergyLevel } from '@/lib/db/schema';

/**
 * Personal recovery model — deterministic, no AI.
 *
 * Tune hours and factors here. The engine never invents extra deductions.
 *
 * Day window defaults (Asia/Riyadh wall clock):
 *   wake 07:00 → sleep 23:00  → 16 waking hours
 *
 * Shift recovery is ADDITIONAL to the hours the shift already occupies.
 * Night shifts take a large same-day bite and a leftover bite the next day.
 */
export const CAPACITY_DEFAULTS = {
  wakeHm: '07:00',
  sleepHm: '23:00',
  energy: 'medium' as EnergyLevel,
} as const;

/** Extra productive hours removed after a shift (not the shift duration). */
export const SHIFT_RECOVERY_HOURS = {
  night: { sameDay: 4, nextDay: 2 },
  evening: { sameDay: 1.5, nextDay: 0 },
  day: { sameDay: 0.5, nextDay: 0 },
} as const;

/**
 * Multiplier applied to remaining productive hours after occupancy + recovery.
 * High cannot exceed free time (the engine caps afterwards).
 */
export const ENERGY_CAPACITY_FACTOR: Record<EnergyLevel, number> = {
  low: 0.8,
  medium: 1,
  high: 1,
};

export const BUSY_EVENT_TYPES = [
  'shift',
  'meeting',
  'appointment',
  'family',
  'protected',
  'recovery',
] as const;

export const PROTECTED_EVENT_TYPES = [
  'family',
  'protected',
  'recovery',
] as const;
