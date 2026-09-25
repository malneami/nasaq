'use server';

import { requireUserId } from '@/lib/auth/session';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import { getProfile } from '@/lib/db/queries/profiles';
import { getDailyBrief, upsertDailyBrief } from '@/lib/db/queries/reviews';
import { createAuditLog } from '@/lib/db/queries/system';
import { assembleToday } from '@/lib/today/assemble';
import {
  clampOutcomes,
  serializeDailyFocus,
  toFocusItem,
} from '@/lib/today/focus';
import { proposeTopOutcomes } from '@/lib/today/propose';
import type { DailyFocusItem } from '@/lib/today/types';
import { mergeBriefContent } from '@/lib/reviews/brief-merge';
import { ymdInTimeZone, ymdToUtcDate } from '@/lib/time/zoned';
import { z } from 'zod';

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

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

async function writeAudit(
  userId: string,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
) {
  await createAuditLog(userId, {
    actor: 'user',
    action,
    entityType: 'daily_brief',
    entityId,
    after,
  });
}

async function persistFocus(
  userId: string,
  dateYmd: string,
  outcomes: DailyFocusItem[],
  proposal: DailyFocusItem[] | null,
) {
  const briefDate = ymdToUtcDate(dateYmd);
  const existing = await getDailyBrief(userId, briefDate);
  const focus = serializeDailyFocus({ outcomes, proposal });
  return upsertDailyBrief(
    userId,
    briefDate,
    mergeBriefContent(existing?.content, focus),
  );
}

export async function suggestTodayOutcomes(): Promise<{
  proposal?: DailyFocusItem[];
  truncated?: boolean;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const profile = await getProfile(userId);
    const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
    const limit =
      profile?.preferences?.top_outcomes_limit ??
      defaultPreferences.top_outcomes_limit;
    const todayYmd = ymdInTimeZone(new Date(), timeZone);
    const existing = await assembleToday(userId);
    const minutes = Math.max(
      30,
      Math.round((existing.header.capacityHours || 2) * 60),
    );
    const proposed = await proposeTopOutcomes(userId, { limit, minutes });
    const { items, truncated } = clampOutcomes(proposed, limit);
    const brief = await persistFocus(
      userId,
      todayYmd,
      existing.outcomes.confirmed,
      items,
    );
    await writeAudit(userId, 'suggest', brief.id, {
      date: todayYmd,
      proposalCount: items.length,
      confirmedUnchanged: existing.outcomes.confirmed.length,
    });
    return { proposal: items, truncated };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function confirmTodayOutcomes(input: {
  items: DailyFocusItem[];
}): Promise<{ truncated?: boolean; error?: string }> {
  const parsed = z.array(focusItemSchema).safeParse(input.items);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const profile = await getProfile(userId);
    const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
    const limit =
      profile?.preferences?.top_outcomes_limit ??
      defaultPreferences.top_outcomes_limit;
    const todayYmd = ymdInTimeZone(new Date(), timeZone);
    const mapped = parsed.data.map((item) =>
      toFocusItem({
        id: item.id,
        title: item.text,
        taskId: item.taskId,
        projectId: item.projectId,
        projectName: item.projectName,
        estimatedMinutes: item.estimatedMinutes,
        dueDate: item.dueDate,
        status: item.status as DailyFocusItem['status'],
      }),
    );
    const { items, truncated } = clampOutcomes(mapped, limit);
    const brief = await persistFocus(userId, todayYmd, items, null);
    await writeAudit(userId, 'confirm', brief.id, {
      date: todayYmd,
      count: items.length,
    });
    return { truncated };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveTodayOutcomes(input: {
  items: DailyFocusItem[];
}): Promise<{ truncated?: boolean; error?: string }> {
  return confirmTodayOutcomes(input);
}

export async function dismissTodayProposal(): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const profile = await getProfile(userId);
    const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
    const todayYmd = ymdInTimeZone(new Date(), timeZone);
    const model = await assembleToday(userId);
    const brief = await persistFocus(
      userId,
      todayYmd,
      model.outcomes.confirmed,
      null,
    );
    await writeAudit(userId, 'dismiss_proposal', brief.id, { date: todayYmd });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}
