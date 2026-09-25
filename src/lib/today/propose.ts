import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { getDailyBrief } from '@/lib/db/queries/reviews';
import { getProfile } from '@/lib/db/queries/profiles';
import { getNextActions, selectTasks } from '@/lib/tasks/service';
import { PRIORITY_RANK } from '@/lib/tasks/constants';
import { toFocusItem } from '@/lib/today/focus';
import type { DailyFocusItem } from '@/lib/today/types';
import type { TaskCardDto } from '@/lib/tasks/service';
import { addDaysYmd, ymdInTimeZone, ymdToUtcDate } from '@/lib/time/zoned';

function rankFill(task: TaskCardDto): number {
  const dueBoost = task.dueDate ? 40 : 0;
  return dueBoost + PRIORITY_RANK[task.priority] * 10 + (task.projectScore ?? 50) / 10;
}

/**
 * Deterministic Top 3 proposal. Never writes confirmed outcomes.
 * Weekly seeds + shutdown carry-over feed the candidate pool only.
 */
export async function proposeTopOutcomes(
  userId: string,
  options: { limit: number; minutes: number; now?: Date },
): Promise<DailyFocusItem[]> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const todayYmd = ymdInTimeZone(options.now ?? new Date(), timeZone);
  const yesterday = addDaysYmd(todayYmd, -1);

  const [selected, nextGroups, todayBrief, yesterdayBrief] = await Promise.all([
    selectTasks(userId, {
      minutes: options.minutes,
      energy: 'medium',
      now: options.now,
    }),
    getNextActions(userId),
    getDailyBrief(userId, ymdToUtcDate(todayYmd)),
    getDailyBrief(userId, ymdToUtcDate(yesterday)),
  ]);

  const items: DailyFocusItem[] = [];
  const seen = new Set<string>();

  const seedPools: DailyFocusItem[] = [
    ...(((todayBrief?.content as { weeklySeedCandidates?: DailyFocusItem[] })
      ?.weeklySeedCandidates) ?? []),
    ...(((todayBrief?.content as { carryOverPool?: DailyFocusItem[] })
      ?.carryOverPool) ?? []),
    ...(((yesterdayBrief?.content as { carryOverPool?: DailyFocusItem[] })
      ?.carryOverPool) ?? []),
  ];

  for (const seed of seedPools) {
    if (items.length >= options.limit) break;
    const key = seed.taskId ?? seed.id;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(seed);
  }

  for (const pick of selected.picks) {
    if (items.length >= options.limit) {
      break;
    }
    if (seen.has(pick.task.id)) continue;
    seen.add(pick.task.id);
    items.push(
      toFocusItem({
        id: pick.task.id,
        title: pick.task.title,
        taskId: pick.task.id,
        projectId: pick.task.projectId,
        projectName: pick.task.projectName,
        estimatedMinutes: pick.task.estimatedMinutes,
        dueDate: pick.task.dueDate,
        status: pick.task.status,
      }),
    );
  }

  const extras: TaskCardDto[] = [];
  for (const group of nextGroups) {
    extras.push(...group.tasks);
  }
  extras.sort((a, b) => rankFill(b) - rankFill(a));

  for (const task of extras) {
    if (items.length >= options.limit) {
      break;
    }
    if (seen.has(task.id)) {
      continue;
    }
    seen.add(task.id);
    items.push(
      toFocusItem({
        id: task.id,
        title: task.title,
        taskId: task.id,
        projectId: task.projectId,
        projectName: task.projectName,
        estimatedMinutes: task.estimatedMinutes,
        dueDate: task.dueDate,
        status: task.status,
      }),
    );
  }

  return items;
}
