import { z } from 'zod';
import { SCORE_FACTORS } from '@/lib/projects/score';
import { PROJECT_STAGES, PROJECT_STATES } from '@/lib/projects/stages';

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;

export const projectLinkSchema = z.object({
  url: z.string().trim().url().max(2000),
  label: z.string().trim().max(120).optional().or(z.literal('')),
});

export const projectIdentitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().or(z.literal('')),
  strategicObjective: z.string().trim().max(2000).optional().or(z.literal('')),
  desiredOutcome: z.string().trim().max(2000).optional().or(z.literal('')),
  owner: z.string().trim().max(120).optional().or(z.literal('')),
  lifeAreaIds: z.array(z.string().uuid()),
  goalIds: z.array(z.string().uuid()),
});

export const projectProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  currentMilestoneId: z.string().uuid().nullable().optional(),
  nextMilestoneId: z.string().uuid().nullable().optional(),
  targetDate: z.string().optional().or(z.literal('')),
  nextAction: z.string().trim().max(500).optional().or(z.literal('')),
});

export const projectRiskSchema = z.object({
  blockers: z.string().trim().max(4000).optional().or(z.literal('')),
  dependencies: z.string().trim().max(4000).optional().or(z.literal('')),
  riskLevel: z.enum(RISK_LEVELS),
});

export const projectResourcesSchema = z.object({
  timeInvestedMinutes: z.number().int().min(0).max(10_000_000),
  moneyInvestedMajor: z.number().min(0),
  estimatedFutureCostMajor: z.number().min(0),
});

export const projectScoreSchema = z.object(
  Object.fromEntries(
    SCORE_FACTORS.map((key) => [key, z.number().int().min(1).max(10)]),
  ) as Record<(typeof SCORE_FACTORS)[number], z.ZodNumber>,
);

export const projectStateSchema = z.enum(PROJECT_STATES);
export const projectStageSchema = z.enum(PROJECT_STAGES);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  lifeAreaIds: z.array(z.string().uuid()).optional(),
});

export const milestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  targetDate: z.string().optional().or(z.literal('')),
});

export const projectContactSchema = z.object({
  contactId: z.string().uuid(),
  role: z.string().trim().min(1).max(80),
});

export const quickTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const quickCommitmentSchema = z.object({
  description: z.string().trim().min(1).max(500),
  direction: z.enum(['i_promised', 'they_promised']),
});

export const quickWaitingSchema = z.object({
  item: z.string().trim().min(1).max(500),
});

export const aiActionSchema = z.enum([
  'activate',
  'maintain',
  'incubate',
  'reassess',
  'stop',
]);

export type ProjectIdentityInput = z.infer<typeof projectIdentitySchema>;
export type ProjectProgressInput = z.infer<typeof projectProgressSchema>;
export type ProjectRiskInput = z.infer<typeof projectRiskSchema>;
export type ProjectResourcesInput = z.infer<typeof projectResourcesSchema>;
export type ProjectScoreInput = z.infer<typeof projectScoreSchema>;
