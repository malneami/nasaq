import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampOutcomes,
  parseDailyFocus,
  toFocusItem,
} from '@/lib/today/focus';

describe('today/focus', () => {
  it('builds a task focus item from a title', () => {
    const item = toFocusItem({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Draft board note',
      taskId: '11111111-1111-1111-1111-111111111111',
      estimatedMinutes: 25,
    });
    assert.equal(item.kind, 'task');
    assert.equal(item.text, 'Draft board note');
    assert.equal(item.estimatedMinutes, 25);
  });

  it('parses brief content and ignores invalid shapes', () => {
    const ok = parseDailyFocus({
      outcomes: [
        {
          id: 'a',
          kind: 'text',
          text: 'Protect family dinner',
        },
      ],
      proposal: [],
    });
    assert.equal(ok.outcomes.length, 1);
    assert.equal(ok.proposal, null);

    const bad = parseDailyFocus({ outcomes: 'nope' });
    assert.deepEqual(bad.outcomes, []);
  });

  it('clamps Top outcomes to the configured limit', () => {
    const items = [1, 2, 3, 4].map((n) =>
      toFocusItem({ id: String(n), title: `Outcome ${n}` }),
    );
    const clamped = clampOutcomes(items, 3);
    assert.equal(clamped.items.length, 3);
    assert.equal(clamped.truncated, true);
  });
});
