import { NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyInboxText } from '@/lib/ai/classify';
import { requireUserId } from '@/lib/auth/session';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import { getInboxItem, updateInboxItem } from '@/lib/db/queries/inbox';
import { listLifeAreas } from '@/lib/db/queries/life-areas';
import { getProfile } from '@/lib/db/queries/profiles';
import { listProjects } from '@/lib/db/queries/projects';
import { createAuditLog } from '@/lib/db/queries/system';
import { toInboxItemDto } from '@/lib/inbox/payload';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  type InboxAiPayload,
} from '@/lib/inbox/types';

const bodySchema = z.object({
  itemId: z.string().uuid(),
  force: z.boolean().optional(),
});

function todayInTimeZone(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const item = await getInboxItem(userId, parsedBody.data.itemId);
  if (!item || item.status !== 'unprocessed') {
    return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }

  if (
    !parsedBody.data.force &&
    item.aiType &&
    item.aiPayload &&
    item.aiPayload.classificationStatus &&
    item.aiPayload.classificationStatus !== 'pending' &&
    item.aiPayload.classificationStatus !== 'failed'
  ) {
    return NextResponse.json({ item: toInboxItemDto(item) });
  }

  const [profile, areas, projects] = await Promise.all([
    getProfile(userId),
    listLifeAreas(userId),
    listProjects(userId),
  ]);

  const timezone = profile?.timezone || DEFAULT_TIMEZONE;
  const currency = profile?.currency || DEFAULT_CURRENCY;
  const threshold =
    profile?.preferences?.confidence_threshold ??
    defaultPreferences.confidence_threshold ??
    DEFAULT_CONFIDENCE_THRESHOLD;
  const now = new Date();

  try {
    const result = await classifyInboxText({
      rawText: item.rawText,
      timezone,
      currency,
      nowIso: now.toISOString(),
      todayIso: todayInTimeZone(timezone, now),
      lifeAreaNames: areas.map((area) => area.name),
      projectNames: projects.map((project) => project.name),
    });

    const needsConfirmation =
      result.needs_confirmation || result.confidence < threshold;

    const payload: InboxAiPayload = {
      title: result.title,
      extracted: result.extracted,
      needs_confirmation: needsConfirmation,
      clarifying_question: needsConfirmation
        ? result.clarifying_question
        : undefined,
      classificationStatus: needsConfirmation
        ? 'needs_confirmation'
        : 'suggested',
    };

    const updated = await updateInboxItem(userId, item.id, {
      aiType: result.type,
      aiConfidence: result.confidence.toFixed(3),
      aiPayload: payload,
    });

    await createAuditLog(userId, {
      actor: 'ai',
      action: 'classify',
      entityType: 'inbox_item',
      entityId: item.id,
      after: {
        type: result.type,
        confidence: result.confidence,
        needs_confirmation: needsConfirmation,
      },
    });

    return NextResponse.json({
      item: updated ? toInboxItemDto(updated) : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Classification failed';
    const updated = await updateInboxItem(userId, item.id, {
      aiPayload: {
        classificationStatus: 'failed',
        classifyError: message,
      },
    });

    return NextResponse.json(
      {
        error: 'classifyFailed',
        item: updated ? toInboxItemDto(updated) : null,
      },
      { status: 502 },
    );
  }
}
