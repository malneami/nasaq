import {
  getBudgetsForMonth,
  listTransactions,
  sumAccountBalance,
  sumSpendBetween,
} from '@/lib/db/queries/finance';
import { getProfile } from '@/lib/db/queries/profiles';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { monthStartYmd, ymdInTimeZone } from '@/lib/time/zoned';
import type { TransactionFilters } from '@/lib/db/queries/finance';

export async function getTransactions(
  userId: string,
  filters?: TransactionFilters,
) {
  return listTransactions(userId, filters);
}

export async function getAccountBalance(
  userId: string,
  accountId: string,
  asOf?: string,
) {
  return sumAccountBalance(userId, accountId, asOf);
}

export async function getSpendToday(userId: string, now = new Date()) {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const today = ymdInTimeZone(now, timeZone);
  return sumSpendBetween(userId, today, today);
}

export async function getSpendMonth(
  userId: string,
  month?: string,
  now = new Date(),
) {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const today = ymdInTimeZone(now, timeZone);
  const start = monthStartYmd(month ?? today);
  const end = month && month.slice(0, 7) !== today.slice(0, 7)
    ? `${month.slice(0, 7)}-31`
    : today;
  return sumSpendBetween(userId, start, end);
}

export async function getBudget(userId: string, month: string) {
  return getBudgetsForMonth(userId, month);
}
