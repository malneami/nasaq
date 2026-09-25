import 'server-only';

import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { createInboxItem } from '@/lib/db/queries/inbox';
import { getProfile } from '@/lib/db/queries/profiles';
import { getDailyBrief, upsertDailyBrief } from '@/lib/db/queries/reviews';
import { createAuditLog } from '@/lib/db/queries/system';
import { mergeBriefContent } from '@/lib/reviews/brief-merge';
import type { ShutdownModel } from '@/lib/reviews/types';
import { assembleToday } from '@/lib/today/assemble';
import type { DailyFocusItem } from '@/lib/today/types';
import { ymdInTimeZone, ymdToUtcDate } from '@/lib/time/zoned';

function emptyReflection(): ShutdownModel['reflection'] {
  return {
    completedNotes: '',
    unfinishedNotes: '',
    ideas: '',
    commitments: '',
    followUps: '',
  };
}

export async function loadShutdown(
  userId: string,
): Promise<ShutdownModel> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const existing = await getDailyBrief(userId, ymdToUtcDate(todayYmd));
  const stored = (existing?.content as { shutdown?: ShutdownModel } | null)
    ?.shutdown;

  const today = await assembleToday(userId);
  const completed = today.outcomes.confirmed.filter(
    (o) => o.status === 'completed',
  );
  const unfinished = today.outcomes.confirmed.filter(
    (o) => o.status !== 'completed',
  );

  // Also treat empty status confirmed items as unfinished for reassessment
  const unfinishedWork =
    unfinished.length > 0
      ? unfinished
      : today.outcomes.confirmed.filter((o) => o.status !== 'completed');

  return {
    dateYmd: todayYmd,
    completedOutcomes: completed,
    unfinished: unfinishedWork,
    carryOverCandidates: stored?.carryOverCandidates ?? [],
    reflection: stored?.reflection ?? emptyReflection(),
    completedAt: stored?.completedAt ?? null,
  };
}

/**
 * Save shutdown. Carry-over goes to candidate pool only — NEVER auto Top 3.
 */
export async function saveShutdown(
  userId: string,
  input: {
    reflection: ShutdownModel['reflection'];
    carryOverIds: string[];
    unfinished: DailyFocusItem[];
  },
): Promise<ShutdownModel> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const briefDate = ymdToUtcDate(todayYmd);
  const existing = await getDailyBrief(userId, briefDate);

  const carryOverCandidates = input.unfinished.filter((item) =>
    input.carryOverIds.includes(item.id),
  );

  // Capture free-text ideas / commitments into inbox (user-initiated)
  const ideas = input.reflection.ideas.trim();
  if (ideas) {
    await createInboxItem(userId, {
      rawText: ideas,
      inputKind: 'text',
      status: 'unprocessed',
      aiPayload: { classificationStatus: 'pending' },
    });
  }
  const commitments = input.reflection.commitments.trim();
  if (commitments) {
    await createInboxItem(userId, {
      rawText: `Commitment: ${commitments}`,
      inputKind: 'text',
      status: 'unprocessed',
      aiPayload: { classificationStatus: 'pending' },
    });
  }

  // Persist carry-over pool for tomorrow's planning (not as confirmed outcomes)
  const prior = (existing?.content as Record<string, unknown>) ?? {};
  const tomorrowCandidates = [
    ...(((prior.carryOverPool as DailyFocusItem[]) ?? []).filter(
      (c) => !carryOverCandidates.some((x) => x.id === c.id),
    )),
    ...carryOverCandidates.map((c) => ({
      ...c,
      status: 'focus' as const,
    })),
  ].slice(0, 12);

  const model: ShutdownModel = {
    dateYmd: todayYmd,
    completedOutcomes: [],
    unfinished: input.unfinished,
    carryOverCandidates,
    reflection: input.reflection,
    completedAt: new Date().toISOString(),
  };

  // Reload completed from live today for stored snapshot
  const today = await assembleToday(userId);
  model.completedOutcomes = today.outcomes.confirmed.filter(
    (o) => o.status === 'completed',
  );

  await upsertDailyBrief(
    userId,
    briefDate,
    mergeBriefContent(prior, {
      shutdown: model,
      carryOverPool: tomorrowCandidates,
    }),
  );

  await createAuditLog(userId, {
    actor: 'user',
    action: 'evening_shutdown',
    entityType: 'daily_brief',
    entityId: todayYmd,
    after: {
      carryOverCount: carryOverCandidates.length,
      // Explicit: carry-over is NOT tomorrow's Top 3
      autoPromoted: false,
    },
  });

  return model;
}
