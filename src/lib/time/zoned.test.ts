import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDaysYmd,
  daysBetweenYmd,
  greetingSlot,
  startOfWeekYmd,
  ymdInTimeZone,
  zonedDateTimeToUtc,
} from '@/lib/time/zoned';

const TZ = 'Asia/Riyadh';

describe('time/zoned', () => {
  it('adds calendar days without float timestamps', () => {
    assert.equal(addDaysYmd('2026-09-16', 1), '2026-09-17');
    assert.equal(addDaysYmd('2026-09-30', 1), '2026-10-01');
    assert.equal(daysBetweenYmd('2026-09-16', '2026-09-20'), 4);
  });

  it('starts weeks on Sunday in Asia/Riyadh by default', () => {
    // 2026-09-16 is a Wednesday → week start 2026-09-13
    assert.equal(startOfWeekYmd('2026-09-16', TZ, 0), '2026-09-13');
  });

  it('maps wall-clock Riyadh time into UTC', () => {
    const utc = zonedDateTimeToUtc('2026-09-16', '12:00', TZ);
    assert.equal(ymdInTimeZone(utc, TZ), '2026-09-16');
  });

  it('picks greeting slots from local hour', () => {
    const morning = zonedDateTimeToUtc('2026-09-16', '08:00', TZ);
    const evening = zonedDateTimeToUtc('2026-09-16', '19:00', TZ);
    assert.equal(greetingSlot(morning, TZ), 'morning');
    assert.equal(greetingSlot(evening, TZ), 'evening');
  });
});
