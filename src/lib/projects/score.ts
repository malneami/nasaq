/**
 * Project Priority Score (0–100) — deterministic, not AI.
 *
 * Nine factors, each 1–10. Benefits raise the score; costs lower it.
 *
 * Weights (sum = 100) live in SCORE_WEIGHTS so they can be tuned later:
 *   Benefits — strategic_fit 18, expected_impact 16, urgency 14,
 *              revenue_potential 12, network_value 10, personal_interest 10
 *   Costs    — time_requirement 8, financial_cost 6, complexity 6
 *
 * Each factor is mapped onto [0, 1] with (value − 1) / 9 so that 1 → 0 and 10 → 1.
 * Cost factors are inverted (10 − value) / 9 so a high raw cost reduces the score.
 * The weighted sum is therefore already on 0–100.
 */

export const SCORE_FACTORS = [
  'strategicFit',
  'expectedImpact',
  'revenuePotential',
  'networkValue',
  'personalInterest',
  'timeRequirement',
  'financialCost',
  'complexity',
  'urgency',
] as const;

export type ScoreFactorKey = (typeof SCORE_FACTORS)[number];

export type ScoreKind = 'benefit' | 'cost';

export const SCORE_WEIGHTS: Record<
  ScoreFactorKey,
  { weight: number; kind: ScoreKind }
> = {
  strategicFit: { weight: 18, kind: 'benefit' },
  expectedImpact: { weight: 16, kind: 'benefit' },
  urgency: { weight: 14, kind: 'benefit' },
  revenuePotential: { weight: 12, kind: 'benefit' },
  networkValue: { weight: 10, kind: 'benefit' },
  personalInterest: { weight: 10, kind: 'benefit' },
  timeRequirement: { weight: 8, kind: 'cost' },
  financialCost: { weight: 6, kind: 'cost' },
  complexity: { weight: 6, kind: 'cost' },
};

export type ScoreFactors = Record<ScoreFactorKey, number>;

export type ScoreContribution = {
  key: ScoreFactorKey;
  kind: ScoreKind;
  value: number;
  weight: number;
  contribution: number;
  signedEffect: number;
};

export type ScoreResult = {
  score: number;
  contributions: ScoreContribution[];
  pullingUp: ScoreFactorKey[];
  pullingDown: ScoreFactorKey[];
};

function clampFactor(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(10, Math.max(1, Math.round(value)));
}

function unitScore(value: number, kind: ScoreKind): number {
  const clamped = clampFactor(value);
  if (kind === 'cost') {
    return (10 - clamped) / 9;
  }
  return (clamped - 1) / 9;
}

export function computePriorityScore(factors: ScoreFactors): ScoreResult {
  const contributions: ScoreContribution[] = SCORE_FACTORS.map((key) => {
    const { weight, kind } = SCORE_WEIGHTS[key];
    const value = clampFactor(factors[key]);
    const unit = unitScore(value, kind);
    const contribution = unit * weight;
    const midpoint = weight / 2;
    return {
      key,
      kind,
      value,
      weight,
      contribution,
      signedEffect: contribution - midpoint,
    };
  });

  const raw = contributions.reduce((sum, item) => sum + item.contribution, 0);
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const pullingUp = [...contributions]
    .filter((item) => item.signedEffect > 0.75)
    .sort((a, b) => b.signedEffect - a.signedEffect)
    .map((item) => item.key);
  const pullingDown = [...contributions]
    .filter((item) => item.signedEffect < -0.75)
    .sort((a, b) => a.signedEffect - b.signedEffect)
    .map((item) => item.key);

  return { score, contributions, pullingUp, pullingDown };
}

export const DEFAULT_SCORE_FACTORS: ScoreFactors = {
  strategicFit: 5,
  expectedImpact: 5,
  revenuePotential: 5,
  networkValue: 5,
  personalInterest: 5,
  timeRequirement: 5,
  financialCost: 5,
  complexity: 5,
  urgency: 5,
};
