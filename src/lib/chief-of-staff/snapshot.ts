import 'server-only';

import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import { getProfile } from '@/lib/db/queries/profiles';
import { listProjects } from '@/lib/db/queries/projects';
import { listTasks } from '@/lib/db/queries/tasks';
import { getCapacity } from '@/lib/capacity/service';
import { getMonthlyFinanceSummary } from '@/lib/finance/intelligence/service';
import {
  getDueFollowups,
  getOverdueCommitments,
  getOverdueWaiting,
} from '@/lib/people/service';
import { ymdInTimeZone } from '@/lib/time/zoned';
import type { CosSnapshot } from '@/lib/chief-of-staff/types';

/**
 * Compact system snapshot for the Chief of Staff.
 * Aggregates only — no raw tables, no account numbers, no full PII.
 */
export async function assembleCosSnapshot(
  userId: string,
  locale: 'en' | 'ar' = 'en',
): Promise<CosSnapshot> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(new Date(), timeZone);
  const threshold =
    profile?.preferences?.confidence_threshold ??
    defaultPreferences.confidence_threshold;

  const [
    capacity,
    projects,
    tasks,
    overdueCommitments,
    dueFollowups,
    overdueWaiting,
    finance,
  ] = await Promise.all([
    getCapacity(userId, todayYmd).catch(() => null),
    listProjects(userId),
    listTasks(userId),
    getOverdueCommitments(userId, todayYmd),
    getDueFollowups(userId, todayYmd),
    getOverdueWaiting(userId, todayYmd),
    getMonthlyFinanceSummary(userId).catch(() => null),
  ]);

  const active = projects.filter(
    (p) => p.state === 'active' || p.state === 'maintain',
  );
  const taskCountByProject = new Map<string, number>();
  for (const task of tasks) {
    if (!task.projectId) continue;
    if (task.status === 'completed' || task.status === 'cancelled') continue;
    taskCountByProject.set(
      task.projectId,
      (taskCountByProject.get(task.projectId) ?? 0) + 1,
    );
  }

  return {
    dateYmd: todayYmd,
    timeZone,
    locale,
    capacity: {
      freeHours: capacity?.freeHours ?? 0,
      productiveHours: capacity?.productiveHours ?? 0,
      provisional: !capacity,
    },
    activeProjects: active.slice(0, 12).map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage,
      state: p.state,
      nextAction: p.nextAction,
      timeInvestedMinutes: p.timeInvestedMinutes,
      taskCount: taskCountByProject.get(p.id) ?? 0,
    })),
    overdueCommitments: overdueCommitments.slice(0, 8).map((row) => ({
      id: row.id,
      description: row.description,
      dueYmd: row.dueYmd ?? null,
    })),
    dueFollowUps: dueFollowups.slice(0, 8).map((row) => ({
      contactId: row.contactId,
      name: row.personName,
      nextFollowUpYmd: row.dueYmd ?? null,
    })),
    overdueWaiting: overdueWaiting.slice(0, 8).map((row) => ({
      id: row.id,
      item: row.item,
      expectedYmd: row.dueYmd ?? null,
    })),
    finance: finance
      ? {
          incomeMinor: finance.incomeMinor,
          expensesMinor: finance.expensesMinor,
          netMinor: finance.netCashFlowMinor,
          topCategories: finance.byCategory.slice(0, 5).map((c) => ({
            label: c.label,
            amountMinor: c.amountMinor,
          })),
          currency: finance.currency || DEFAULT_CURRENCY,
        }
      : null,
    confidenceThreshold: threshold,
  };
}
