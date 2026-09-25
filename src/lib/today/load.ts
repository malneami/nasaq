import { cache } from 'react';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/session';
import { assembleToday } from '@/lib/today/assemble';
import type { TodayModel } from '@/lib/today/types';
import { greetingSlot, ymdInTimeZone } from '@/lib/time/zoned';

function emptyTodayModel(now = new Date()): TodayModel {
  const dateYmd = ymdInTimeZone(now, DEFAULT_TIMEZONE);
  return {
    header: {
      dateYmd,
      timezone: DEFAULT_TIMEZONE,
      displayName: null,
      greeting: greetingSlot(now, DEFAULT_TIMEZONE),
      shiftTitle: null,
      capacityHours: 0,
      capacityProvisional: true,
      focusStatus: 'empty',
      confirmedCount: 0,
      outcomesLimit: defaultPreferences.top_outcomes_limit,
      currency: DEFAULT_CURRENCY,
    },
    outcomes: {
      confirmed: [],
      proposal: null,
      limit: defaultPreferences.top_outcomes_limit,
      candidates: [],
    },
    schedule: [],
    followUps: [],
    finance: {
      empty: true,
      spendingTodayMinor: 0,
      spendingMonthMinor: 0,
      budgetAmountMinor: null,
      budgetUsedPercent: null,
      unclassifiedCount: 0,
      unusualCount: 0,
      briefInsight: null,
      currency: DEFAULT_CURRENCY,
    },
    attention: [],
  };
}

export const getTodayModel = cache(async (): Promise<TodayModel> => {
  try {
    const userId = await requireUserId();
    return await assembleToday(userId);
  } catch {
    return emptyTodayModel();
  }
});
