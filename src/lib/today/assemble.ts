import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { listCommitments } from '@/lib/db/queries/commitments';
import { listContacts } from '@/lib/db/queries/contacts';
import {
  listAccounts,
  listBudgets,
  listFinancialGoals,
  listTransactions,
} from '@/lib/db/queries/finance';
import { getProfile } from '@/lib/db/queries/profiles';
import { listProjects } from '@/lib/db/queries/projects';
import { getDailyBrief, listWeeklyReviews } from '@/lib/db/queries/reviews';
import {
  getDueFollowups,
  getOverdueCommitments,
  getOverdueWaiting,
} from '@/lib/people/service';
import { getCapacity } from '@/lib/capacity/service';
import { getSpendMonth, getSpendToday } from '@/lib/finance/spend';
import { ensureDailyFinanceBrief } from '@/lib/finance/intelligence/brief';
import { getUnusualSpending } from '@/lib/finance/intelligence/service';
import { getNextActions, listTaskCardsForUser, type TaskCardDto } from '@/lib/tasks/service';
import type { MonthlyReviewModel } from '@/lib/reviews/types';
import { parseDailyFocus, toFocusItem } from '@/lib/today/focus';
import type {
  DailyFocusItem,
  TodayAttentionItem,
  TodayFinanceModel,
  TodayFollowUpItem,
  TodayModel,
  TodayScheduleItem,
} from '@/lib/today/types';
import {
  daysBetweenYmd,
  greetingSlot,
  monthStartYmd,
  ymdInTimeZone,
  ymdToUtcDate,
  zonedDayRange,
} from '@/lib/time/zoned';
import type {
  SelectCalendarEvent,
  SelectFinancialGoal,
  SelectProject,
  SelectTransaction,
} from '@/lib/db/schema';

const FOLLOW_UP_CAP = 5;
const ATTENTION_CAP = 5;
const CANDIDATE_CAP = 12;
const SPENDING_TYPES = new Set(['expense', 'fee']);

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function toYmd(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function eventOverlapsDay(event: SelectCalendarEvent, start: Date, end: Date) {
  return event.startsAt < end && event.endsAt > start;
}

function hydrateOutcomes(
  stored: DailyFocusItem[],
  tasks: TaskCardDto[],
): DailyFocusItem[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return stored.map((item) => {
    if (!item.taskId) {
      return item;
    }
    const live = byId.get(item.taskId);
    if (!live) {
      return item;
    }
    return {
      ...item,
      kind: 'task',
      text: live.title,
      projectId: live.projectId,
      projectName: live.projectName,
      estimatedMinutes: live.estimatedMinutes,
      dueDate: live.dueDate,
      status: live.status,
    };
  });
}

function taskToFocus(task: TaskCardDto): DailyFocusItem {
  return toFocusItem({
    id: task.id,
    title: task.title,
    taskId: task.id,
    projectId: task.projectId,
    projectName: task.projectName,
    estimatedMinutes: task.estimatedMinutes,
    dueDate: task.dueDate,
    status: task.status,
  });
}

function buildSchedule(
  events: SelectCalendarEvent[],
  start: Date,
  end: Date,
): TodayScheduleItem[] {
  return events
    .filter((event) => eventOverlapsDay(event, start, end))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      allDay: event.allDay,
      isProtected: event.isProtected || event.eventType === 'protected' || event.eventType === 'family',
    }));
}

function isSpending(type: string) {
  return SPENDING_TYPES.has(type);
}

function buildFinance(input: {
  todayYmd: string;
  monthStart: string;
  currency: string;
  accountsCount: number;
  transactions: SelectTransaction[];
  budgetTotal: number | null;
  spendingTodayMinor: number;
  spendingMonthMinor: number;
  unusualCount: number;
  briefInsight: string | null;
}): TodayFinanceModel {
  if (input.accountsCount === 0 && input.transactions.length === 0) {
    return {
      empty: true,
      spendingTodayMinor: 0,
      spendingMonthMinor: 0,
      budgetAmountMinor: null,
      budgetUsedPercent: null,
      unclassifiedCount: 0,
      unusualCount: 0,
      briefInsight: null,
      currency: input.currency,
    };
  }

  const monthSpend = input.transactions.filter((row) => {
    const day = toYmd(row.occurredOn);
    return Boolean(
      day && day >= input.monthStart && day <= input.todayYmd && isSpending(row.type),
    );
  });
  const unclassifiedCount = monthSpend.filter((row) => !row.categoryId).length;

  const budgetUsedPercent =
    input.budgetTotal && input.budgetTotal > 0
      ? Math.round((input.spendingMonthMinor / input.budgetTotal) * 100)
      : null;

  return {
    empty: false,
    spendingTodayMinor: input.spendingTodayMinor,
    spendingMonthMinor: input.spendingMonthMinor,
    budgetAmountMinor: input.budgetTotal,
    budgetUsedPercent,
    unclassifiedCount,
    unusualCount: input.unusualCount,
    briefInsight: input.briefInsight,
    currency: input.currency,
  };
}

function buildFollowUps(input: {
  dueFollowups: Awaited<ReturnType<typeof getDueFollowups>>;
  overdueCommitments: Awaited<ReturnType<typeof getOverdueCommitments>>;
  overdueWaiting: Awaited<ReturnType<typeof getOverdueWaiting>>;
  dueTodayCommitments: TodayFollowUpItem[];
}): TodayFollowUpItem[] {
  const items: TodayFollowUpItem[] = [
    ...input.dueFollowups.map((row) => ({
      id: `follow:${row.contactId}`,
      kind: 'follow_up' as const,
      personName: row.personName,
      owed: row.owed,
      dueYmd: row.dueYmd,
      overdue: row.overdue,
      lastContactYmd: row.lastContactYmd,
      staleDays: row.staleDays,
      href: row.href,
    })),
    ...input.overdueCommitments.map((row) => ({
      id: `commit:${row.id}`,
      kind: 'commitment' as const,
      personName: row.personName ?? '—',
      owed: row.description,
      dueYmd: row.dueYmd,
      overdue: true,
      lastContactYmd: null as string | null,
      staleDays: null as number | null,
      href: row.href,
    })),
    ...input.dueTodayCommitments,
    ...input.overdueWaiting.map((row) => ({
      id: `wait:${row.id}`,
      kind: 'waiting' as const,
      personName: row.personName ?? row.org ?? '—',
      owed: row.item,
      dueYmd: row.dueYmd,
      overdue: true,
      lastContactYmd: null as string | null,
      staleDays: null as number | null,
      href: row.href,
    })),
  ];

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    return (a.dueYmd ?? '9999-12-31').localeCompare(b.dueYmd ?? '9999-12-31');
  });

  const seen = new Set<string>();
  const unique: TodayFollowUpItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
    if (unique.length >= FOLLOW_UP_CAP) {
      break;
    }
  }
  return unique;
}

function buildAttention(input: {
  todayYmd: string;
  projects: SelectProject[];
  nextByProject: Set<string>;
  overdueCommitments: Awaited<ReturnType<typeof getOverdueCommitments>>;
  overdueWaiting: Awaited<ReturnType<typeof getOverdueWaiting>>;
  followUps: TodayFollowUpItem[];
  finance: TodayFinanceModel;
  tasks: TaskCardDto[];
  goals: SelectFinancialGoal[];
  imbalance?: { code: string; message: string }[];
}): TodayAttentionItem[] {
  const items: TodayAttentionItem[] = [];

  for (const commitment of input.overdueCommitments) {
    items.push({
      id: `att-commit-${commitment.id}`,
      urgency: 95,
      title: commitment.description,
      detail: 'overdueCommitment',
      href: commitment.href,
      tone: 'danger',
    });
  }

  for (const waiting of input.overdueWaiting) {
    items.push({
      id: `att-wait-${waiting.id}`,
      urgency: 92,
      title: waiting.item,
      detail: 'overdueWaiting',
      href: waiting.href,
      tone: 'danger',
    });
  }

  for (const follow of input.followUps.filter(
    (row) => row.overdue && row.kind === 'follow_up',
  )) {
    items.push({
      id: `att-${follow.id}`,
      urgency: 88,
      title: follow.personName,
      detail: 'overdueFollowUp',
      href: follow.href,
      tone: 'danger',
    });
  }

  for (const project of input.projects) {
    if (project.state !== 'active') {
      continue;
    }
    const hasTask = input.nextByProject.has(project.id);
    const hasText = Boolean(project.nextAction?.trim());
    if (hasTask || hasText) {
      continue;
    }
    items.push({
      id: `att-proj-${project.id}`,
      urgency: 80,
      title: project.name,
      detail: 'projectNoNext',
      href: `/projects/${project.id}`,
      tone: 'warning',
    });
  }

  for (const task of input.tasks) {
    if (!task.dueDate || task.dueDate >= input.todayYmd) {
      continue;
    }
    if (task.status === 'completed' || task.status === 'cancelled') {
      continue;
    }
    if (task.priority !== 'urgent' && task.priority !== 'high') {
      continue;
    }
    items.push({
      id: `att-task-${task.id}`,
      urgency: 78,
      title: task.title,
      detail: 'overdueTask',
      href: '/projects?tab=tasks',
      tone: 'warning',
    });
  }

  if (input.finance.unclassifiedCount > 0) {
    items.push({
      id: 'att-unclassified',
      urgency: 60,
      title: 'unclassified',
      detail: 'unclassifiedTx',
      href: '/finance?tab=transactions&uncategorizedOnly=1',
      tone: 'info',
    });
  }

  if (input.finance.unusualCount > 0) {
    items.push({
      id: 'att-unusual',
      urgency: 65,
      title: 'unusual',
      detail: 'unusualSpend',
      href: '/finance?tab=overview',
      tone: 'warning',
    });
  }

  for (const callout of input.imbalance ?? []) {
    items.push({
      id: `att-imbalance-${callout.code}`,
      urgency: 55,
      title: callout.message,
      detail: 'imbalance',
      href: '/review?tab=monthly',
      tone: 'info',
    });
  }

  for (const goal of input.goals) {
    const due = toYmd(goal.targetDate);
    if (!due) {
      continue;
    }
    const days = daysBetweenYmd(input.todayYmd, due);
    if (days < 0 || days > 7) {
      continue;
    }
    items.push({
      id: `att-goal-${goal.id}`,
      urgency: 70 - days,
      title: goal.name,
      detail: 'upcomingPayment',
      href: '/finance',
      tone: 'warning',
    });
  }

  items.sort((a, b) => b.urgency - a.urgency);
  const seen = new Set<string>();
  const unique: TodayAttentionItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
    if (unique.length >= ATTENTION_CAP) {
      break;
    }
  }
  return unique;
}

/**
 * Compose the Today command center from existing entities. Never fabricates totals.
 */
export async function assembleToday(
  userId: string,
  now: Date = new Date(),
): Promise<TodayModel> {
  const profile = await safe(getProfile(userId), null);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const currency = profile?.currency || DEFAULT_CURRENCY;
  const outcomesLimit =
    profile?.preferences?.top_outcomes_limit ?? defaultPreferences.top_outcomes_limit;
  const todayYmd = ymdInTimeZone(now, timeZone);
  const { start, end } = zonedDayRange(todayYmd, timeZone);
  const monthStart = monthStartYmd(todayYmd);

  const [
    events,
    brief,
    nextGroups,
    projects,
    contacts,
    dueFollowups,
    overdueCommitments,
    overdueWaiting,
    accounts,
    spendTodayMinor,
    spendMonthMinor,
    budgets,
    financialGoals,
    candidateTasks,
    monthlyReviews,
    dayCapacity,
  ] = await Promise.all([
    safe(listCalendarEvents(userId), []),
    safe(getDailyBrief(userId, ymdToUtcDate(todayYmd)), null),
    safe(getNextActions(userId), []),
    safe(listProjects(userId), []),
    safe(listContacts(userId), []),
    safe(getDueFollowups(userId, todayYmd), []),
    safe(getOverdueCommitments(userId, todayYmd), []),
    safe(getOverdueWaiting(userId, todayYmd), []),
    safe(listAccounts(userId), []),
    safe(getSpendToday(userId, now), 0),
    safe(getSpendMonth(userId, monthStart, now), 0),
    safe(listBudgets(userId), []),
    safe(listFinancialGoals(userId), []),
    safe(listTaskCardsForUser(userId), []),
    safe(listWeeklyReviews(userId, 'monthly'), []),
    safe(getCapacity(userId, todayYmd), null),
  ]);

  // Unclassified / unusual still need transaction rows for alerts.
  const transactions = await safe(listTransactions(userId), []);
  const unusual = await safe(getUnusualSpending(userId, monthStart), []);
  const financeBrief = await safe(ensureDailyFinanceBrief(userId), null);

  const monthlyImbalance = (
    (monthlyReviews[0]?.content as MonthlyReviewModel | undefined)?.imbalance ??
    []
  ).slice(0, 2);

  const dayEvents = events.filter((event) => eventOverlapsDay(event, start, end));
  const shift = dayEvents.find((event) => event.eventType === 'shift') ?? null;
  const schedule = buildSchedule(events, start, end);
  const stored = parseDailyFocus(brief?.content);
  const confirmed = hydrateOutcomes(stored.outcomes, candidateTasks).slice(
    0,
    outcomesLimit,
  );
  const proposal = stored.proposal
    ? hydrateOutcomes(stored.proposal, candidateTasks).slice(0, outcomesLimit)
    : null;

  const candidates: DailyFocusItem[] = [];
  const seen = new Set<string>();
  for (const group of nextGroups) {
    for (const task of group.tasks) {
      if (seen.has(task.id) || candidates.length >= CANDIDATE_CAP) {
        continue;
      }
      seen.add(task.id);
      candidates.push(taskToFocus(task));
    }
  }

  const capacityHours = dayCapacity?.productiveHours ?? 0;

  const overdueCommitIds = new Set(overdueCommitments.map((row) => row.id));
  const contactName = new Map(contacts.map((row) => [row.id, row.name]));
  const dueTodayCommitments: TodayFollowUpItem[] = [];
  const allCommitments = await safe(listCommitments(userId), []);
  for (const row of allCommitments) {
    if (row.status !== 'open' || overdueCommitIds.has(row.id)) {
      continue;
    }
    const due = toYmd(row.dueDate);
    if (!due || due !== todayYmd) {
      continue;
    }
    dueTodayCommitments.push({
      id: `commit:${row.id}`,
      kind: 'commitment',
      personName: row.contactId ? (contactName.get(row.contactId) ?? '—') : '—',
      owed: row.description,
      dueYmd: due,
      overdue: false,
      lastContactYmd: null,
      staleDays: null,
      href: '/people?tab=commitments',
    });
  }

  const followUps = buildFollowUps({
    dueFollowups,
    overdueCommitments,
    overdueWaiting,
    dueTodayCommitments,
  });

  const monthBudgets = budgets.filter((row) => toYmd(row.month) === monthStart);
  const budgetTotal =
    monthBudgets.length > 0
      ? monthBudgets.reduce((sum, row) => sum + row.amount, 0)
      : null;

  const finance = buildFinance({
    todayYmd,
    monthStart,
    currency,
    accountsCount: accounts.length,
    transactions,
    budgetTotal,
    spendingTodayMinor: spendTodayMinor,
    spendingMonthMinor: spendMonthMinor,
    unusualCount: unusual.length,
    briefInsight: financeBrief?.insight ?? null,
  });

  const nextByProject = new Set(
    nextGroups
      .map((group) => group.projectId)
      .filter((id): id is string => Boolean(id)),
  );

  const attention = buildAttention({
    todayYmd,
    projects,
    nextByProject,
    overdueCommitments,
    overdueWaiting,
    followUps,
    finance,
    tasks: candidateTasks,
    goals: financialGoals,
    imbalance: monthlyImbalance.map((i) => ({
      code: i.code,
      message: i.message,
    })),
  });

  const focusStatus =
    confirmed.length > 0
      ? 'confirmed'
      : proposal && proposal.length > 0
        ? 'proposed'
        : 'empty';

  return {
    header: {
      dateYmd: todayYmd,
      timezone: timeZone,
      displayName: profile?.displayName ?? null,
      greeting: greetingSlot(now, timeZone),
      shiftTitle: shift?.title ?? null,
      capacityHours,
      capacityProvisional: dayCapacity == null,
      focusStatus,
      confirmedCount: confirmed.length,
      outcomesLimit,
      currency,
    },
    outcomes: {
      confirmed,
      proposal,
      limit: outcomesLimit,
      candidates,
    },
    schedule,
    followUps,
    finance,
    attention,
  };
}

