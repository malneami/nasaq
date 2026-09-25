'use server';

import { requireUserId } from '@/lib/auth/session';
import { getLocale } from 'next-intl/server';
import { ensureDailyFinanceBrief } from '@/lib/finance/intelligence/brief';
import { phraseCfoAnswer } from '@/lib/finance/intelligence/cfo';
import { buildCfoAggregates } from '@/lib/finance/intelligence/cfo-aggregates';
import {
  getHealthScore,
  getMonthlyFinanceSummary,
  getSubscriptions,
  getUnusualSpending,
  getVentureFinance,
} from '@/lib/finance/intelligence/service';
import type {
  DailyFinanceBrief,
  HealthScore,
  MonthlyFinanceSummary,
  SubscriptionItem,
  UnusualSpendItem,
  VentureFinanceRow,
} from '@/lib/finance/intelligence/types';
import type { AppLocale } from '@/lib/i18n/routing';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

export async function fetchMonthlyFinanceSummary(
  month?: string,
): Promise<{ summary?: MonthlyFinanceSummary; error?: string }> {
  try {
    const userId = await requireUserId();
    const summary = await getMonthlyFinanceSummary(userId, month);
    return { summary };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchSubscriptions(): Promise<{
  subscriptions?: SubscriptionItem[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { subscriptions: await getSubscriptions(userId) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchUnusualSpending(month?: string): Promise<{
  unusual?: UnusualSpendItem[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { unusual: await getUnusualSpending(userId, month) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchHealthScore(): Promise<{
  health?: HealthScore;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { health: await getHealthScore(userId) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchVentureFinance(): Promise<{
  ventures?: VentureFinanceRow[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { ventures: await getVentureFinance(userId) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function fetchDailyFinanceBrief(): Promise<{
  brief?: DailyFinanceBrief;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const locale = (await getLocale()) as AppLocale;
    const brief = await ensureDailyFinanceBrief(
      userId,
      locale === 'ar' ? 'ar' : 'en',
    );
    return { brief };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function askPersonalCfo(question: string): Promise<{
  answer?: string;
  declined?: boolean;
  aggregates?: Record<string, unknown>;
  error?: string;
}> {
  const trimmed = question.trim().slice(0, 500);
  if (!trimmed) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const locale = (await getLocale()) as AppLocale;
    const aggregates = await buildCfoAggregates(userId, trimmed);
    const result = await phraseCfoAnswer({
      question: trimmed,
      aggregates,
      locale: locale === 'ar' ? 'ar' : 'en',
    });
    return {
      answer: result.answer,
      declined: result.declined,
      aggregates,
    };
  } catch (error) {
    return { error: asError(error) };
  }
}
