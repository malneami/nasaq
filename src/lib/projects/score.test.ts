import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SCORE_FACTORS,
  SCORE_WEIGHTS,
  computePriorityScore,
} from '@/lib/projects/score';

describe('projects/score', () => {
  it('weights sum to 100', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce(
      (total, item) => total + item.weight,
      0,
    );
    assert.equal(sum, 100);
  });

  it('scores all-mid factors near the middle of 0–100', () => {
    const result = computePriorityScore(DEFAULT_SCORE_FACTORS);
    assert.ok(result.score >= 45 && result.score <= 55);
    assert.equal(result.contributions.length, 9);
  });

  it('raises score when benefits are high and costs are low', () => {
    const high = computePriorityScore({
      strategicFit: 10,
      expectedImpact: 10,
      revenuePotential: 10,
      networkValue: 10,
      personalInterest: 10,
      urgency: 10,
      timeRequirement: 1,
      financialCost: 1,
      complexity: 1,
    });
    const low = computePriorityScore({
      strategicFit: 1,
      expectedImpact: 1,
      revenuePotential: 1,
      networkValue: 1,
      personalInterest: 1,
      urgency: 1,
      timeRequirement: 10,
      financialCost: 10,
      complexity: 10,
    });
    assert.ok(high.score > 85);
    assert.ok(low.score < 15);
    assert.ok(high.score > low.score);
  });
});
