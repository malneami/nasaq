import { z } from 'zod';

export const PROPOSAL_KINDS = [
  'top3',
  'time_block',
  'project_state',
  'task_create',
  'follow_up_draft',
  'commitment_create',
  'waiting_create',
  'decision_disposition',
  'handoff_message',
  'handoff_finance',
] as const;

export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const DECISION_DISPOSITIONS = [
  'do_now',
  'schedule',
  'delegate',
  'waiting',
  'incubate',
  'drop',
] as const;

export type DecisionDisposition = (typeof DECISION_DISPOSITIONS)[number];

export const proposalBaseSchema = z.object({
  kind: z.enum(PROPOSAL_KINDS),
  title: z.string().min(1).max(200),
  rationale: z.string().min(1).max(800),
  confidence: z.number().min(0).max(1),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional().nullable(),
  handoffOnly: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type CosProposal = z.infer<typeof proposalBaseSchema> & {
  id?: string; // ai_recommendations id once persisted
};

export type CosChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals?: CosProposal[];
  clarifyingQuestion?: string | null;
  createdAt: string;
};

export type CosSnapshot = {
  dateYmd: string;
  timeZone: string;
  locale: 'en' | 'ar';
  capacity: {
    freeHours: number;
    productiveHours: number;
    provisional: boolean;
  };
  activeProjects: {
    id: string;
    name: string;
    stage: string;
    state: string;
    nextAction: string | null;
    timeInvestedMinutes: number;
    taskCount: number;
  }[];
  overdueCommitments: {
    id: string;
    description: string;
    dueYmd: string | null;
  }[];
  dueFollowUps: {
    contactId: string;
    name: string;
    nextFollowUpYmd: string | null;
  }[];
  overdueWaiting: {
    id: string;
    item: string;
    expectedYmd: string | null;
  }[];
  finance: {
    incomeMinor: number;
    expensesMinor: number;
    netMinor: number;
    topCategories: { label: string; amountMinor: number }[];
    currency: string;
  } | null;
  confidenceThreshold: number;
};

export const COS_TIMEOUT_MS = 45_000;
export const COS_MAX_TOOL_ROUNDS = 4;
