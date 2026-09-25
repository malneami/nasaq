import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DECISION_DISPOSITIONS, PROPOSAL_KINDS } from '@/lib/chief-of-staff/types';

describe('chief of staff contracts', () => {
  it('exposes six decision dispositions including drop and incubate', () => {
    assert.ok(DECISION_DISPOSITIONS.includes('drop'));
    assert.ok(DECISION_DISPOSITIONS.includes('incubate'));
    assert.equal(DECISION_DISPOSITIONS.length, 6);
  });

  it('lists proposal kinds without silent money/send execution kinds', () => {
    assert.ok(PROPOSAL_KINDS.includes('handoff_message'));
    assert.ok(PROPOSAL_KINDS.includes('handoff_finance'));
    assert.ok(PROPOSAL_KINDS.includes('follow_up_draft'));
    assert.ok(!PROPOSAL_KINDS.includes('send_message' as never));
    assert.ok(!PROPOSAL_KINDS.includes('move_money' as never));
  });
});
