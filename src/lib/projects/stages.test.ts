import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_ACTION_TO_STATE,
  PROJECT_STAGES,
  adjacentStage,
  resolveProjectStages,
} from '@/lib/projects/stages';

describe('projects/stages', () => {
  it('maps advisory AI actions to portfolio states', () => {
    assert.equal(AI_ACTION_TO_STATE.activate, 'active');
    assert.equal(AI_ACTION_TO_STATE.incubate, 'incubator');
    assert.equal(AI_ACTION_TO_STATE.stop, 'stopped');
  });

  it('fills missing preference stages from the default order', () => {
    const stages = resolveProjectStages({
      active_project_limit: 3,
      top_outcomes_limit: 3,
      confidence_threshold: 0.7,
      project_stages: ['building', 'idea'],
    });
    assert.equal(stages[0], 'building');
    assert.equal(stages[1], 'idea');
    assert.ok(stages.includes('scale'));
    assert.equal(stages.length, PROJECT_STAGES.length);
  });

  it('moves one stage forward or back', () => {
    const stages = [...PROJECT_STAGES];
    assert.equal(adjacentStage(stages, 'idea', 1), 'validation');
    assert.equal(adjacentStage(stages, 'idea', -1), null);
  });
});
