import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandRecurring, parseRecurrence } from '@/lib/calendar/recurrence';
import { zonedDateTimeToUtc } from '@/lib/time/zoned';

const TZ = 'Asia/Riyadh';

describe('calendar/recurrence', () => {
  it('rejects malformed recurrence payloads', () => {
    assert.equal(parseRecurrence(null), null);
    assert.equal(parseRecurrence({ freq: 'yearly' }), null);
  });

  it('expands a weekly family block across a date range', () => {
    const seedStart = zonedDateTimeToUtc('2026-09-13', '19:00', TZ);
    const seedEnd = zonedDateTimeToUtc('2026-09-13', '21:00', TZ);
    const rangeStart = zonedDateTimeToUtc('2026-09-13', '00:00', TZ);
    const rangeEnd = zonedDateTimeToUtc('2026-09-28', '00:00', TZ);
    const occurrences = expandRecurring(
      seedStart,
      seedEnd,
      { freq: 'weekly', interval: 1 },
      rangeStart,
      rangeEnd,
      TZ,
    );
    assert.ok(occurrences.length >= 2);
    assert.equal(
      occurrences[0]!.endsAt.getTime() - occurrences[0]!.startsAt.getTime(),
      2 * 60 * 60 * 1000,
    );
  });
});
