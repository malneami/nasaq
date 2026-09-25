'use server';

import { requireUserId } from '@/lib/auth/session';
import { getLocale } from 'next-intl/server';
import { ensureMorningBrief } from '@/lib/reviews/morning';
import { loadShutdown, saveShutdown } from '@/lib/reviews/shutdown';
import {
  assembleWeeklyReview,
  confirmWeeklyTop3,
} from '@/lib/reviews/weekly';
import { assembleMonthlyReview } from '@/lib/reviews/monthly';
import type {
  MorningBriefModel,
  MonthlyReviewModel,
  ShutdownModel,
  WeeklyReviewModel,
} from '@/lib/reviews/types';
import type { DailyFocusItem } from '@/lib/today/types';
import { z } from 'zod';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function toLocale(locale: string): 'en' | 'ar' {
  return locale === 'ar' ? 'ar' : 'en';
}

export async function fetchMorningBrief(): Promise<{
  brief?: MorningBriefModel;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const locale = toLocale(await getLocale());
    return { brief: await ensureMorningBrief(userId, locale) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchShutdown(): Promise<{
  shutdown?: ShutdownModel;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { shutdown: await loadShutdown(userId) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function completeShutdown(input: {
  reflection: ShutdownModel['reflection'];
  carryOverIds: string[];
  unfinished: DailyFocusItem[];
}): Promise<{ shutdown?: ShutdownModel; error?: string }> {
  try {
    const userId = await requireUserId();
    return {
      shutdown: await saveShutdown(userId, input),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchWeeklyReview(weekStartYmd?: string): Promise<{
  review?: WeeklyReviewModel;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const locale = toLocale(await getLocale());
    return {
      review: await assembleWeeklyReview(userId, locale, weekStartYmd),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

const top3Schema = z.array(
  z.object({
    id: z.string(),
    kind: z.enum(['task', 'text']),
    text: z.string().min(1).max(300),
    taskId: z.string().uuid().optional(),
    projectId: z.string().uuid().nullable().optional(),
    projectName: z.string().nullable().optional(),
    estimatedMinutes: z.number().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    status: z.string().optional(),
  }),
);

export async function saveWeeklyTop3(input: {
  periodStart: string;
  items: DailyFocusItem[];
  reflection: WeeklyReviewModel['reflection'];
}): Promise<{ review?: WeeklyReviewModel; error?: string }> {
  const parsed = top3Schema.safeParse(input.items);
  if (!parsed.success) return { error: 'invalid' };
  try {
    const userId = await requireUserId();
    return {
      review: await confirmWeeklyTop3(
        userId,
        input.periodStart,
        parsed.data as DailyFocusItem[],
        input.reflection,
      ),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchMonthlyReview(monthYmd?: string): Promise<{
  review?: MonthlyReviewModel;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const locale = toLocale(await getLocale());
    return {
      review: await assembleMonthlyReview(userId, locale, monthYmd),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}
