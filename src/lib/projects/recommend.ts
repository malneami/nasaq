import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';
import { SCORE_FACTORS, type ScoreFactors } from '@/lib/projects/score';
import { aiActionSchema } from '@/lib/validations/project';
import type { AiAction, ProjectStage, ProjectState } from '@/lib/db/schema';

const RECOMMEND_TOOL_NAME = 'recommend_project_action';
const RECOMMEND_TIMEOUT_MS = 20_000;

const recommendToolInputSchema = z.object({
  recommendation: aiActionSchema,
  rationale: z.string().min(1).max(800),
  confidence: z.number().min(0).max(1),
});

export type RecommendContext = {
  name: string;
  state: ProjectState;
  stage: ProjectStage;
  hasNextAction: boolean;
  targetDate: string | null;
  score: number;
  factors: ScoreFactors;
  activeCount: number;
  activeLimit: number;
};

export type RecommendResult = {
  recommendation: AiAction;
  rationale: string;
  confidence: number;
};

const recommendTool: Anthropic.Tool = {
  name: RECOMMEND_TOOL_NAME,
  description:
    'Recommend a portfolio action for one project. Advisory only — do not claim that anything was changed.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['recommendation', 'rationale', 'confidence'],
    properties: {
      recommendation: {
        type: 'string',
        enum: ['activate', 'maintain', 'incubate', 'reassess', 'stop'],
      },
      rationale: {
        type: 'string',
        description: '2–4 sentences. No personal names, emails, or money amounts.',
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
};

function systemPrompt(): string {
  return [
    'You advise on a personal project portfolio. AI suggests; the user decides.',
    'Never instruct the system to change state, score, or fields. Return one action.',
    'activate = commit attention now. maintain = keep running without expanding.',
    'incubate = park for later. reassess = pause and rethink. stop = close it.',
    'Respect the active-project capacity: recommending activate when already at or over the limit requires a strong reason.',
    'Use only the structured context. Do not invent finances, people, or history.',
  ].join(' ');
}

function userPrompt(context: RecommendContext): string {
  const factors = SCORE_FACTORS.map(
    (key) => `${key}=${context.factors[key]}`,
  ).join(', ');
  return [
    `Project name: ${context.name}`,
    `State: ${context.state}`,
    `Stage: ${context.stage}`,
    `Has next action: ${context.hasNextAction ? 'yes' : 'no'}`,
    `Target date: ${context.targetDate ?? 'none'}`,
    `Priority score: ${context.score}`,
    `Factors (1-10): ${factors}`,
    `Active projects: ${context.activeCount} / ${context.activeLimit}`,
  ].join('\n');
}

export async function recommendProjectAction(
  context: RecommendContext,
): Promise<RecommendResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const message = await client.messages.create(
    {
      model,
      max_tokens: 512,
      temperature: 0,
      system: systemPrompt(),
      tools: [recommendTool],
      tool_choice: { type: 'tool', name: RECOMMEND_TOOL_NAME },
      messages: [{ role: 'user', content: userPrompt(context) }],
    },
    { timeout: RECOMMEND_TIMEOUT_MS },
  );

  const toolBlock = message.content.find(
    (block) => block.type === 'tool_use' && block.name === RECOMMEND_TOOL_NAME,
  );
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Recommender did not return structured output.');
  }

  const parsed = recommendToolInputSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    throw new Error('Recommender returned an invalid schema.');
  }

  return parsed.data;
}
