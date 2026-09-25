import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  daysWaiting,
  isCommitmentOverdue,
  isFollowUpDue,
  isWaitingOverdue,
} from './overdue';

const TODAY = '2026-09-16';

describe('isCommitmentOverdue', () => {
  it('marks open commitments past due as overdue', () => {
    assert.equal(
      isCommitmentOverdue({
        status: 'open',
        dueDate: '2026-09-10',
        todayYmd: TODAY,
      }),
      true,
    );
    assert.equal(
      isCommitmentOverdue({
        status: 'open',
        dueDate: '2026-09-20',
        todayYmd: TODAY,
      }),
      false,
    );
    assert.equal(
      isCommitmentOverdue({
        status: 'fulfilled',
        dueDate: '2026-09-01',
        todayYmd: TODAY,
      }),
      false,
    );
  });
});

describe('isWaitingOverdue', () => {
  it('uses expected_at then follow_up_at against today', () => {
    assert.equal(
      isWaitingOverdue({
        status: 'waiting',
        expectedAt: '2026-09-14',
        followUpAt: null,
        todayYmd: TODAY,
      }),
      true,
    );
    assert.equal(
      isWaitingOverdue({
        status: 'waiting',
        expectedAt: null,
        followUpAt: '2026-09-15',
        todayYmd: TODAY,
      }),
      true,
    );
    assert.equal(
      isWaitingOverdue({
        status: 'waiting',
        expectedAt: '2026-09-20',
        followUpAt: null,
        todayYmd: TODAY,
      }),
      false,
    );
    assert.equal(
      isWaitingOverdue({
        status: 'received',
        expectedAt: '2026-09-01',
        followUpAt: null,
        todayYmd: TODAY,
      }),
      false,
    );
  });
});

describe('isFollowUpDue', () => {
  it('is due when next_follow_up_at is today or earlier', () => {
    assert.equal(
      isFollowUpDue({ nextFollowUpAt: '2026-09-16', todayYmd: TODAY }),
      true,
    );
    assert.equal(
      isFollowUpDue({ nextFollowUpAt: '2026-09-17', todayYmd: TODAY }),
      false,
    );
  });
});

describe('daysWaiting', () => {
  it('counts whole days from requested_at', () => {
    assert.equal(daysWaiting('2026-09-10', TODAY), 6);
    assert.equal(daysWaiting(TODAY, TODAY), 0);
  });
});
