'use server';

import { requireUserId } from '@/lib/auth/session';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import {
  createCalendarEvent,
  createTimeBlock,
  deleteCalendarEvent,
  deleteTimeBlock,
  getCalendarEvent,
  listTimeBlocks,
  updateCalendarEvent,
  updateTimeBlock,
} from '@/lib/db/queries/calendar';
import { getProfile } from '@/lib/db/queries/profiles';
import { createAuditLog } from '@/lib/db/queries/system';
import type { RecurrenceRule, ShiftKind } from '@/lib/db/schema';
import {
  getWeekCapacity,
  listOccurrences,
} from '@/lib/capacity/service';
import type {
  CalendarBoardDto,
  OccurringEvent,
  ProtectedBlockDto,
} from '@/lib/calendar/types';
import {
  addDaysYmd,
  startOfWeekYmd,
  weekdayFromYmd,
  ymdInTimeZone,
  zonedDateTimeToUtc,
  zonedDayRange,
} from '@/lib/time/zoned';
import {
  eventFormSchema,
  moveEventSchema,
  protectedBlockSchema,
  type EventFormInput,
  type ProtectedBlockInput,
} from '@/lib/validations/calendar';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  if (
    error instanceof Error &&
    (error.message.includes('DATABASE_URL') ||
      error.message.includes('Invalid URL') ||
      error.message.includes('Postgres'))
  ) {
    return 'database';
  }
  if (error instanceof Error && error.message) {
    console.error('[calendar]', error.message);
  }
  return 'failed';
}

async function writeAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown>,
) {
  await createAuditLog(userId, {
    actor: 'user',
    action,
    entityType,
    entityId,
    after,
  });
}

async function userZone(userId: string) {
  const profile = await getProfile(userId);
  return {
    timeZone: profile?.timezone || DEFAULT_TIMEZONE,
    preferences: profile?.preferences ?? null,
  };
}

function buildRecurrence(
  input: EventFormInput,
): RecurrenceRule | null {
  if (input.recurrenceFreq === 'none') {
    return null;
  }
  return {
    freq: input.recurrenceFreq,
    interval: input.recurrenceInterval,
  };
}

function resolveRange(
  input: EventFormInput,
  timeZone: string,
): { startsAt: Date; endsAt: Date } {
  if (input.allDay) {
    const startsAt = zonedDateTimeToUtc(input.startYmd, '00:00', timeZone);
    const endsAt = zonedDateTimeToUtc(
      addDaysYmd(input.endYmd, 1),
      '00:00',
      timeZone,
    );
    return { startsAt, endsAt };
  }
  const startsAt = zonedDateTimeToUtc(
    input.startYmd,
    input.startHm,
    timeZone,
  );
  const endsAt = zonedDateTimeToUtc(input.endYmd, input.endHm, timeZone);
  return { startsAt, endsAt };
}

export async function loadCalendarBoard(input: {
  view?: 'day' | 'week' | 'month';
  anchorYmd?: string;
}): Promise<
  { ok: true; data: CalendarBoardDto } | { ok: false; error: string }
> {
  try {
    const userId = await requireUserId();
    const { timeZone } = await userZone(userId);
    const view = input.view ?? 'week';
    const today = ymdInTimeZone(new Date(), timeZone);
    const anchorYmd = input.anchorYmd ?? today;
    const weekStartYmd = startOfWeekYmd(anchorYmd, timeZone, 0);

    let rangeStartYmd = weekStartYmd;
    let rangeEndYmd = addDaysYmd(weekStartYmd, 6);
    if (view === 'day') {
      rangeStartYmd = anchorYmd;
      rangeEndYmd = anchorYmd;
    } else if (view === 'month') {
      const monthStart = `${anchorYmd.slice(0, 8)}01`;
      const nextMonth = addDaysYmd(
        `${anchorYmd.slice(0, 7)}-28`,
        5,
      ).slice(0, 8) + '01';
      rangeStartYmd = startOfWeekYmd(monthStart, timeZone, 0);
      rangeEndYmd = addDaysYmd(
        startOfWeekYmd(addDaysYmd(nextMonth, -1), timeZone, 0),
        6,
      );
    }

    const range = {
      start: zonedDayRange(rangeStartYmd, timeZone).start,
      end: zonedDayRange(addDaysYmd(rangeEndYmd, 1), timeZone).start,
    };

    const [events, weekCapacity, blocks] = await Promise.all([
      listOccurrences(userId, range.start, range.end, timeZone),
      getWeekCapacity(userId, weekStartYmd),
      listTimeBlocks(userId),
    ]);

    const dayCapacity =
      weekCapacity.days.find((d) => d.dateYmd === anchorYmd) ?? null;

    const protectedBlocks: ProtectedBlockDto[] = blocks.map((block) => ({
      id: block.id,
      label: block.label,
      eventType: block.eventType,
      weekday: block.weekday ?? 0,
      startHm: block.startHm ?? '22:00',
      endHm: block.endHm ?? '23:00',
      isProtected: block.isProtected,
    }));

    return {
      ok: true,
      data: {
        view,
        anchorYmd,
        weekStartYmd,
        rangeStartYmd,
        rangeEndYmd,
        timeZone,
        events,
        weekCapacity,
        dayCapacity,
        protectedBlocks,
      },
    };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}

export async function saveCalendarEvent(
  input: EventFormInput & { id?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const parsed = eventFormSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'invalid' };
    }
    const { timeZone } = await userZone(userId);
    const { startsAt, endsAt } = resolveRange(parsed.data, timeZone);
    if (endsAt <= startsAt) {
      return { ok: false, error: 'invalidRange' };
    }

    const isProtected =
      parsed.data.isProtected ||
      parsed.data.eventType === 'family' ||
      parsed.data.eventType === 'protected' ||
      parsed.data.eventType === 'recovery';

    const values = {
      title: parsed.data.title,
      eventType: parsed.data.eventType,
      startsAt,
      endsAt,
      allDay: parsed.data.allDay,
      projectId: parsed.data.projectId || null,
      contactId: parsed.data.contactId || null,
      isProtected,
      notes: parsed.data.notes?.trim() || null,
      shiftKind: (parsed.data.shiftKind ?? null) as ShiftKind | null,
      recurrence: buildRecurrence(parsed.data),
    };

    if (input.id) {
      const existing = await getCalendarEvent(userId, input.id);
      if (!existing) {
        return { ok: false, error: 'notFound' };
      }
      const updated = await updateCalendarEvent(userId, input.id, values);
      if (!updated) {
        return { ok: false, error: 'failed' };
      }
      await writeAudit(userId, 'calendar.event.update', 'calendar_event', updated.id, {
        title: updated.title,
        eventType: updated.eventType,
      });
      return { ok: true, id: updated.id };
    }

    const created = await createCalendarEvent(userId, values);
    await writeAudit(userId, 'calendar.event.create', 'calendar_event', created.id, {
      title: created.title,
      eventType: created.eventType,
    });
    return { ok: true, id: created.id };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}

export async function removeCalendarEvent(
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const deleted = await deleteCalendarEvent(userId, eventId);
    if (!deleted) {
      return { ok: false, error: 'notFound' };
    }
    await writeAudit(userId, 'calendar.event.delete', 'calendar_event', eventId, {
      title: deleted.title,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}

export async function moveCalendarEvent(input: {
  eventId: string;
  startIso: string;
  endIso: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const parsed = moveEventSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'invalid' };
    }
    const startsAt = new Date(parsed.data.startIso);
    const endsAt = new Date(parsed.data.endIso);
    if (!(endsAt > startsAt)) {
      return { ok: false, error: 'invalidRange' };
    }
    const updated = await updateCalendarEvent(userId, parsed.data.eventId, {
      startsAt,
      endsAt,
      allDay: false,
    });
    if (!updated) {
      return { ok: false, error: 'notFound' };
    }
    await writeAudit(userId, 'calendar.event.move', 'calendar_event', updated.id, {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}

export async function saveProtectedBlock(
  input: ProtectedBlockInput & { id?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const parsed = protectedBlockSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'invalid' };
    }
    const { timeZone } = await userZone(userId);
    const today = ymdInTimeZone(new Date(), timeZone);
    // Seed instance for the next matching weekday
    let seedYmd = today;
    for (let i = 0; i < 7; i += 1) {
      const candidate = addDaysYmd(today, i);
      if (weekdayFromYmd(candidate, timeZone) === parsed.data.weekday) {
        seedYmd = candidate;
        break;
      }
    }
    const startsAt = zonedDateTimeToUtc(
      seedYmd,
      parsed.data.startHm,
      timeZone,
    );
    let endsAt = zonedDateTimeToUtc(seedYmd, parsed.data.endHm, timeZone);
    if (endsAt <= startsAt) {
      endsAt = zonedDateTimeToUtc(
        addDaysYmd(seedYmd, 1),
        parsed.data.endHm,
        timeZone,
      );
    }

    const values = {
      label: parsed.data.label,
      eventType: parsed.data.eventType,
      startsAt,
      endsAt,
      isProtected: parsed.data.isProtected,
      weekday: parsed.data.weekday,
      startHm: parsed.data.startHm,
      endHm: parsed.data.endHm,
    };

    if (input.id) {
      const updated = await updateTimeBlock(userId, input.id, values);
      if (!updated) {
        return { ok: false, error: 'notFound' };
      }
      await writeAudit(userId, 'calendar.block.update', 'time_block', updated.id, {
        label: updated.label,
      });
      return { ok: true, id: updated.id };
    }

    const created = await createTimeBlock(userId, values);
    await writeAudit(userId, 'calendar.block.create', 'time_block', created.id, {
      label: created.label,
    });
    return { ok: true, id: created.id };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}

export async function removeProtectedBlock(
  blockId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const deleted = await deleteTimeBlock(userId, blockId);
    if (!deleted) {
      return { ok: false, error: 'notFound' };
    }
    await writeAudit(userId, 'calendar.block.delete', 'time_block', blockId, {
      label: deleted.label,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}
