'use server';

import { requireUserId } from '@/lib/auth/session';
import { getLocale } from 'next-intl/server';
import {
  acceptCosProposal,
  dismissCosProposal,
} from '@/lib/chief-of-staff/accept';
import { runDecisionEngine } from '@/lib/chief-of-staff/decision';
import { runChiefOfStaff } from '@/lib/chief-of-staff/run';
import type {
  CosChatMessage,
  CosProposal,
} from '@/lib/chief-of-staff/types';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function toLocale(locale: string): 'en' | 'ar' {
  return locale === 'ar' ? 'ar' : 'en';
}

export async function askChiefOfStaff(input: {
  message: string;
  history?: CosChatMessage[];
}): Promise<{
  reply?: string;
  proposals?: CosProposal[];
  clarifyingQuestion?: string | null;
  error?: string;
}> {
  const message = input.message.trim().slice(0, 2000);
  if (!message) return { error: 'invalid' };
  try {
    const userId = await requireUserId();
    const locale = toLocale(await getLocale());
    const result = await runChiefOfStaff({
      userId,
      message,
      history: input.history,
      locale,
      mode: 'chat',
    });
    return {
      reply: result.reply,
      proposals: result.proposals,
      clarifyingQuestion: result.clarifyingQuestion,
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function askDecisionEngine(input: {
  demand: string;
  note?: string;
}): Promise<{
  reply?: string;
  proposals?: CosProposal[];
  clarifyingQuestion?: string | null;
  disposition?: string | null;
  error?: string;
}> {
  const demand = input.demand.trim().slice(0, 1000);
  if (!demand) return { error: 'invalid' };
  try {
    const userId = await requireUserId();
    const locale = toLocale(await getLocale());
    const result = await runDecisionEngine({
      userId,
      demand,
      note: input.note,
      locale,
    });
    return {
      reply: result.reply,
      proposals: result.proposals,
      clarifyingQuestion: result.clarifyingQuestion,
      disposition: result.disposition,
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function acceptChiefProposal(
  proposal: CosProposal,
  options?: { confirmOverLimit?: boolean },
): Promise<{
  error?: string;
  needsConfirm?: boolean;
  handoff?: { kind: string; draft?: string; message?: string };
  href?: string;
  activeCount?: number;
  activeLimit?: number;
}> {
  return acceptCosProposal(proposal, options);
}

export async function dismissChiefProposal(
  recommendationId: string,
): Promise<{ error?: string }> {
  if (!recommendationId) return { error: 'invalid' };
  return dismissCosProposal(recommendationId);
}
