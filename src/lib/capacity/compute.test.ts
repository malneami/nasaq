import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeDayCapacity, defaultCapacityConfig } from './compute';
import { rangeIsProtected } from './protected';
import type { CapacityEvent } from './types';
import { zonedDateTimeToUtc } from '../time/zoned';

const TZ = 'Asia/Riyadh';
const YMD = '2026-09-16';
const PREV = '2026-09-15';
const CONFIG = defaultCapacityConfig({ timeZone: TZ });

function event(
  overrides: Partial<CapacityEvent> &
    Pick<CapacityEvent, 'eventType' | 'startsAt' | 'endsAt'>,
): CapacityEvent {
  return {
    isProtected: false,
    shiftKind: null,
    ...overrides,
  };
}

describe('computeDayCapacity', () => {
  it('shows productive ≈ free on a day off with no protected time', () => {
    const result = computeDayCapacity(YMD, [], CONFIG);
    assert.equal(result.freeHours, 16);
    assert.equal(result.productiveHours, 16);
  });

  it('drops productive below free after a night shift, with a named recovery line', () => {
    const result = computeDayCapacity(
      YMD,
      [
        event({
          eventType: 'shift',
          shiftKind: 'night',
          startsAt: zonedDateTimeToUtc(YMD, '20:00', TZ),
          endsAt: zonedDateTimeToUtc('2026-09-17', '08:00', TZ),
        }),
      ],
      CONFIG,
    );
    assert.ok(result.productiveHours < result.freeHours - 2);
    const recovery = result.breakdown.find((line) => line.code === 'night_recovery');
    assert.ok(recovery);
    assert.equal(recovery?.hours, -4);
  });

  it('applies leftover night recovery the following day', () => {
    // Ends before wake so YMD is not itself a night-shift day — only nextDay bite applies.
    const night: CapacityEvent = event({
      eventType: 'shift',
      shiftKind: 'night',
      startsAt: zonedDateTimeToUtc(PREV, '20:00', TZ),
      endsAt: zonedDateTimeToUtc(YMD, '06:00', TZ),
    });
    const result = computeDayCapacity(YMD, [night], CONFIG, PREV);
    const leftover = result.breakdown.find((line) => line.code === 'night_recovery');
    assert.ok(leftover);
    assert.equal(leftover?.hours, -2);
    assert.ok(result.productiveHours < result.freeHours);
  });

  it('excludes protected family time from the productive pool', () => {
    const result = computeDayCapacity(
      YMD,
      [
        event({
          eventType: 'family',
          isProtected: true,
          startsAt: zonedDateTimeToUtc(YMD, '18:00', TZ),
          endsAt: zonedDateTimeToUtc(YMD, '20:00', TZ),
        }),
      ],
      CONFIG,
    );
    const family = result.breakdown.find((line) => line.code === 'family');
    assert.equal(family?.hours, -2);
    assert.equal(result.freeHours, 14);
    assert.equal(result.productiveHours, 14);
  });

  it('applies a low-energy modifier after occupancy', () => {
    const medium = computeDayCapacity(YMD, [], CONFIG);
    const low = computeDayCapacity(
      YMD,
      [],
      defaultCapacityConfig({ timeZone: TZ, energy: 'low' }),
    );
    assert.ok(low.productiveHours < medium.productiveHours);
    assert.equal(low.freeHours, medium.freeHours);
    assert.ok(low.breakdown.some((line) => line.code === 'energy'));
  });

  it('never lets productive hours exceed free hours', () => {
    const result = computeDayCapacity(
      YMD,
      [],
      defaultCapacityConfig({ timeZone: TZ, energy: 'high' }),
    );
    assert.ok(result.productiveHours <= result.freeHours);
    assert.ok(result.productiveHours >= 0);
  });
});

describe('rangeIsProtected', () => {
  it('refuses a work window that overlaps a protected block', () => {
    const block = event({
      eventType: 'protected',
      isProtected: true,
      startsAt: zonedDateTimeToUtc(YMD, '12:00', TZ),
      endsAt: zonedDateTimeToUtc(YMD, '14:00', TZ),
    });
    assert.equal(
      rangeIsProtected(
        zonedDateTimeToUtc(YMD, '13:00', TZ),
        zonedDateTimeToUtc(YMD, '15:00', TZ),
        [block],
      ),
      true,
    );
    assert.equal(
      rangeIsProtected(
        zonedDateTimeToUtc(YMD, '09:00', TZ),
        zonedDateTimeToUtc(YMD, '10:00', TZ),
        [block],
      ),
      false,
    );
  });
});
