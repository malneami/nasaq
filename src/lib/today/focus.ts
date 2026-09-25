import { z } from 'zod';
import type { DailyFocusItem } from '@/lib/today/types';

const focusItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['task', 'text']),
  text: z.string().trim().min(1).max(300),
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().nullable().optional(),
  projectName: z.string().max(200).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(24 * 60).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.string().optional(),
});

const briefFocusSchema = z.object({
  outcomes: z.array(focusItemSchema).max(6).optional(),
  proposal: z.array(focusItemSchema).max(6).optional(),
});

export type DailyBriefFocus = {
  outcomes: DailyFocusItem[];
  proposal: DailyFocusItem[] | null;
};

export function parseDailyFocus(content: unknown): DailyBriefFocus {
  const parsed = briefFocusSchema.safeParse(content ?? {});
  if (!parsed.success) {
    return { outcomes: [], proposal: null };
  }
  const outcomes = (parsed.data.outcomes ?? []) as DailyFocusItem[];
  const proposal = parsed.data.proposal?.length
    ? (parsed.data.proposal as DailyFocusItem[])
    : null;
  return { outcomes, proposal };
}

export function serializeDailyFocus(focus: DailyBriefFocus): Record<string, unknown> {
  return {
    outcomes: focus.outcomes,
    proposal: focus.proposal,
  };
}

export function clampOutcomes(
  items: DailyFocusItem[],
  limit: number,
): { items: DailyFocusItem[]; truncated: boolean } {
  if (items.length <= limit) {
    return { items, truncated: false };
  }
  return { items: items.slice(0, limit), truncated: true };
}

export function toFocusItem(input: {
  id: string;
  title: string;
  taskId?: string;
  projectId?: string | null;
  projectName?: string | null;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  status?: DailyFocusItem['status'];
}): DailyFocusItem {
  return {
    id: input.id,
    kind: input.taskId ? 'task' : 'text',
    text: input.title,
    taskId: input.taskId,
    projectId: input.projectId,
    projectName: input.projectName,
    estimatedMinutes: input.estimatedMinutes,
    dueDate: input.dueDate,
    status: input.status,
  };
}
