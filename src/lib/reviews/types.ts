import type { DailyFocusItem } from '@/lib/today/types';
import type { DailyFinanceBrief } from '@/lib/finance/intelligence/types';

export type MorningBriefModel = {
  dateYmd: string;
  timeZone: string;
  shiftTitle: string | null;
  schedule: { title: string; startsAt: string; endsAt: string; eventType: string; isProtected: boolean }[];
  top3: DailyFocusItem[];
  productiveHours: number;
  freeHours: number;
  followUps: { name: string; dueYmd: string | null }[];
  protectedCommitments: { title: string; startsAt: string; endsAt: string }[];
  finance: {
    spendTodayMinor: number;
    spendMonthMinor: number;
    currency: string;
    insight: string | null;
  };
  attention: { title: string; detail: string }[];
  recommendedFocus: string;
  figures: Record<string, number | string | null>;
};

export type ShutdownModel = {
  dateYmd: string;
  completedOutcomes: DailyFocusItem[];
  unfinished: DailyFocusItem[];
  carryOverCandidates: DailyFocusItem[];
  reflection: {
    completedNotes: string;
    unfinishedNotes: string;
    ideas: string;
    commitments: string;
    followUps: string;
  };
  completedAt: string | null;
};

export type WeeklySectionKey =
  | 'outcomes'
  | 'time'
  | 'projects'
  | 'relationships'
  | 'commitments'
  | 'family'
  | 'finance'
  | 'reflection'
  | 'nextWeek';

export type WeeklyReviewModel = {
  periodStart: string;
  periodEnd: string;
  outcomes: { text: string; kind: string }[];
  time: {
    productiveHours: number;
    freeHours: number;
    byProject: { name: string; minutes: number }[];
  };
  projects: {
    progressed: { id: string; name: string; stage: string; progress: number }[];
    blocked: { id: string; name: string; reason: string }[];
  };
  relationships: { name: string; dueYmd: string | null; staleDays: number | null }[];
  commitments: { description: string; direction: string; dueYmd: string | null }[];
  family: {
    protectedHoursScheduled: number;
    protectedHoursHeld: number;
    adherencePct: number | null;
    breaches: number;
  };
  finance: {
    incomeMinor: number;
    expensesMinor: number;
    netMinor: number;
    currency: string;
  } | null;
  reflection: { worked: string; didnt: string; stop: string };
  proposedTop3: DailyFocusItem[];
  confirmedTop3: DailyFocusItem[] | null;
  synthesis: string | null;
};

export type DimensionCode =
  | 'career'
  | 'ventures'
  | 'family'
  | 'health'
  | 'finance'
  | 'development'
  | 'relationships';

export type DimensionIndicator = {
  code: DimensionCode;
  labelKey: string;
  score01: number;
  detail: string;
  derivation: string;
};

export type ImbalanceCallout = {
  code: DimensionCode;
  weeksLow: number;
  message: string;
};

export type MonthlyReviewModel = {
  periodStart: string;
  periodEnd: string;
  dimensions: DimensionIndicator[];
  imbalance: ImbalanceCallout[];
  northStar: NorthStarModel;
  synthesis: string | null;
};

export type NorthStarModel = {
  percent: number | null;
  weeksCounted: number;
  weeksPassing: number;
  supporting: {
    strategicProgress: number | null;
    overdueCommitments: number;
    protectedAdherencePct: number | null;
    financialHealth: number | null;
    weeklyReviewsCompleted: number;
    capacityUsedPct: number | null;
  };
  note: string;
};

export type { DailyFinanceBrief };
