import type { EventType, TaskStatus } from '@/lib/db/schema';

export type DailyFocusItem = {
  id: string;
  kind: 'task' | 'text';
  text: string;
  taskId?: string;
  projectId?: string | null;
  projectName?: string | null;
  estimatedMinutes?: number | null;
  dueDate?: string | null;
  status?: TaskStatus | 'focus';
};

export type TodayHeaderModel = {
  dateYmd: string;
  timezone: string;
  displayName: string | null;
  greeting: 'morning' | 'afternoon' | 'evening' | 'night';
  shiftTitle: string | null;
  capacityHours: number;
  capacityProvisional: boolean;
  focusStatus: 'empty' | 'proposed' | 'confirmed';
  confirmedCount: number;
  outcomesLimit: number;
  currency: string;
};

export type TodayScheduleItem = {
  id: string;
  title: string;
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  isProtected: boolean;
};

export type TodayFollowUpItem = {
  id: string;
  kind: 'follow_up' | 'commitment' | 'waiting';
  personName: string;
  owed: string;
  dueYmd: string | null;
  overdue: boolean;
  lastContactYmd: string | null;
  staleDays: number | null;
  href: string;
};

export type TodayFinanceModel = {
  empty: boolean;
  spendingTodayMinor: number;
  spendingMonthMinor: number;
  budgetAmountMinor: number | null;
  budgetUsedPercent: number | null;
  unclassifiedCount: number;
  unusualCount: number;
  briefInsight: string | null;
  currency: string;
};

export type TodayAttentionDetail =
  | 'overdueCommitment'
  | 'overdueFollowUp'
  | 'overdueWaiting'
  | 'projectNoNext'
  | 'overdueTask'
  | 'unclassifiedTx'
  | 'unusualSpend'
  | 'imbalance'
  | 'upcomingPayment';

export type TodayAttentionItem = {
  id: string;
  urgency: number;
  title: string;
  detail: TodayAttentionDetail;
  href: string;
  tone: 'danger' | 'warning' | 'info';
};

export type TodayOutcomesModel = {
  confirmed: DailyFocusItem[];
  proposal: DailyFocusItem[] | null;
  limit: number;
  candidates: DailyFocusItem[];
};

export type TodayModel = {
  header: TodayHeaderModel;
  outcomes: TodayOutcomesModel;
  schedule: TodayScheduleItem[];
  followUps: TodayFollowUpItem[];
  finance: TodayFinanceModel;
  attention: TodayAttentionItem[];
};
