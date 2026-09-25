import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeBriefContent } from '@/lib/reviews/brief-merge';

describe('reviews/brief-merge', () => {
  it('preserves prior morning/finance keys when patching shutdown', () => {
    const merged = mergeBriefContent(
      {
        morning: { dateYmd: '2026-09-16', recommendedFocus: 'Focus' },
        finance: { spendTodayMinor: 1_200 },
      },
      {
        shutdown: { completedAt: '2026-09-16T20:00:00.000Z' },
      },
    );
    assert.equal(
      (merged.morning as { recommendedFocus: string }).recommendedFocus,
      'Focus',
    );
    assert.equal((merged.finance as { spendTodayMinor: number }).spendTodayMinor, 1_200);
    assert.equal(
      (merged.shutdown as { completedAt: string }).completedAt,
      '2026-09-16T20:00:00.000Z',
    );
  });

  it('starts from an empty object when prior content is invalid', () => {
    assert.deepEqual(mergeBriefContent(null, { a: 1 }), { a: 1 });
    assert.deepEqual(mergeBriefContent(['nope'], { b: 2 }), { b: 2 });
  });
});
