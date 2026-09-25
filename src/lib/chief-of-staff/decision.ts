import 'server-only';

import { runChiefOfStaff } from '@/lib/chief-of-staff/run';
import type { CosProposal, DecisionDisposition } from '@/lib/chief-of-staff/types';

/**
 * Decision Engine — Capture → Clarify → Does this matter? → disposition.
 * Bias: reduce unnecessary commitments (Drop/Incubate first-class).
 */
export async function runDecisionEngine(input: {
  userId: string;
  demand: string;
  note?: string;
  locale?: 'en' | 'ar';
}): Promise<{
  reply: string;
  proposals: CosProposal[];
  clarifyingQuestion: string | null;
  disposition: DecisionDisposition | null;
}> {
  const result = await runChiefOfStaff({
    userId: input.userId,
    message: input.note?.trim() || input.demand,
    demand: input.demand,
    locale: input.locale,
    mode: 'decision',
  });

  const decision = result.proposals.find((p) => p.kind === 'decision_disposition');
  const disposition =
    (decision?.payload?.disposition as DecisionDisposition | undefined) ?? null;

  return {
    reply: result.reply,
    proposals: result.proposals,
    clarifyingQuestion: result.clarifyingQuestion,
    disposition,
  };
}
