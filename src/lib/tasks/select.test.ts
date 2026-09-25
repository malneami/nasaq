import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SelectCandidate } from './select';
import { rankTasks } from './select';

const NOW = new Date('2026-09-15T10:00:00.000Z');

function candidate(
  overrides: Partial<SelectCandidate> & Pick<SelectCandidate, 'id' | 'title'>,
): SelectCandidate {
  return {
    status: 'next',
    priority: 'medium',
    energy: 'medium',
    type: 'computer',
    context: '@computer',
    dueDate: null,
    estimatedMinutes: 20,
    projectId: null,
    projectName: null,
    projectScore: 50,
    ...overrides,
  };
}

describe('rankTasks', () => {
  it('never returns waiting tasks', () => {
    const result = rankTasks(
      [
        candidate({ id: 'wait', title: 'Wait on lab', status: 'waiting' }),
        candidate({ id: 'next', title: 'Write note' }),
      ],
      { now: NOW, availableMinutes: 30 },
    );

    assert.equal(result.picks.length, 1);
    assert.equal(result.picks[0]?.task.id, 'next');
    assert.equal(
      result.picks.some((pick) => pick.task.status === 'waiting'),
      false,
    );
  });

  it('lets deadline dominate a later urgent task', () => {
    const result = rankTasks(
      [
        candidate({
          id: 'overdue',
          title: 'Overdue chart',
          dueDate: '2026-09-14',
          priority: 'medium',
        }),
        candidate({
          id: 'later',
          title: 'Later urgent',
          dueDate: '2026-10-15',
          priority: 'urgent',
        }),
      ],
      { now: NOW, availableMinutes: 30 },
    );

    assert.equal(result.picks[0]?.task.id, 'overdue');
    assert.ok(
      (result.picks[0]?.breakdown.deadline ?? 0) >
        (result.picks[1]?.breakdown.deadline ?? 0),
    );
  });

  it('uses time-fit to break otherwise equal ties', () => {
    const result = rankTasks(
      [
        candidate({
          id: 'short',
          title: 'Quick ping',
          estimatedMinutes: 5,
        }),
        candidate({
          id: 'fit',
          title: 'Fill the window',
          estimatedMinutes: 25,
        }),
      ],
      { now: NOW, availableMinutes: 30 },
    );

    assert.equal(result.picks[0]?.task.id, 'fit');
    assert.ok(
      (result.picks[0]?.breakdown.timeFit ?? 0) >
        (result.picks[1]?.breakdown.timeFit ?? 0),
    );
  });

  it('excludes a 90-minute task from a 30-minute window and names it in skipped', () => {
    const result = rankTasks(
      [
        candidate({
          id: 'deep',
          title: 'Draft proposal',
          type: 'deep_work',
          estimatedMinutes: 90,
        }),
        candidate({
          id: 'ok',
          title: 'Triage inbox',
          estimatedMinutes: 20,
        }),
      ],
      { now: NOW, availableMinutes: 30, energy: 'medium', context: '@computer' },
    );

    assert.equal(result.picks.length, 1);
    assert.equal(result.picks[0]?.task.id, 'ok');
    assert.equal(result.skipped?.title, 'Draft proposal');
    assert.equal(result.skipped?.code, 'overtime');
    assert.equal(result.skipped?.estimatedMinutes, 90);
    assert.equal(result.skipped?.availableMinutes, 30);
  });

  it('drops high-energy and mismatched-context tasks when filters are set', () => {
    const result = rankTasks(
      [
        candidate({
          id: 'high',
          title: 'Surgery review',
          energy: 'high',
          estimatedMinutes: 25,
        }),
        candidate({
          id: 'phone',
          title: 'Call clinic',
          type: 'call',
          context: '@phone',
          estimatedMinutes: 15,
        }),
        candidate({
          id: 'ok',
          title: 'Update spreadsheet',
          estimatedMinutes: 20,
        }),
      ],
      {
        now: NOW,
        availableMinutes: 30,
        energy: 'medium',
        context: '@computer',
      },
    );

    assert.deepEqual(
      result.picks.map((pick) => pick.task.id),
      ['ok'],
    );
  });

  it('returns at most three picks', () => {
    const result = rankTasks(
      Array.from({ length: 8 }, (_, index) =>
        candidate({
          id: `t${index}`,
          title: `Task ${index}`,
          estimatedMinutes: 10 + index,
        }),
      ),
      { now: NOW, availableMinutes: 30 },
    );

    assert.ok(result.picks.length <= 3);
  });
});
