export type MoneyBucket = {
  key: string;
  label: string;
  amountMinor: number;
};

export type MonthlyFinanceSummary = {
  monthYmd: string; // YYYY-MM-01
  currency: string;
  incomeMinor: number;
  expensesMinor: number;
  netCashFlowMinor: number;
  savingsMinor: number;
  savingsRatePct: number | null;
  byCategory: MoneyBucket[];
  byScope: MoneyBucket[];
  byFixedVariable: MoneyBucket[];
  byIncomeSource: MoneyBucket[];
  budget: {
    categoryId: string | null;
    categoryName: string;
    budgetMinor: number;
    actualMinor: number;
    remainingMinor: number;
    projectedMonthEndMinor: number;
  }[];
  budgetTotalMinor: number;
  budgetActualMinor: number;
  projectedMonthEndMinor: number;
  momTrend: { monthYmd: string; expensesMinor: number; incomeMinor: number }[];
  daysElapsed: number;
  daysInMonth: number;
};

export type SubscriptionItem = {
  merchant: string;
  cadenceDays: number;
  occurrences: number;
  avgAmountMinor: number;
  monthlyCostMinor: number;
  lastOccurredOn: string;
  currency: string;
};

export type UnusualSpendItem = {
  kind: 'category' | 'transaction';
  id: string;
  label: string;
  amountMinor: number;
  baselineMinor: number;
  ratio: number;
  occurredOn?: string;
};

export type HealthFactor = {
  code:
    | 'savingsRate'
    | 'emergencyRunway'
    | 'burnVsIncome'
    | 'recurringLoad'
    | 'debtLoad';
  weight: number;
  score01: number;
  points: number;
  detail: string;
};

export type HealthScore = {
  score: number;
  currency: string;
  factors: HealthFactor[];
  burnRateMinor: number;
  freeCashFlowMinor: number;
  savingsRatePct: number | null;
  emergencyFundMinor: number;
  emergencyTargetMinor: number;
  emergencyRunwayMonths: number | null;
  recurringMonthlyMinor: number;
  debtMinor: number;
  investmentContributionsMinor: number;
};

export type VentureFinanceRow = {
  projectId: string;
  name: string;
  stage: string;
  state: string;
  investedMinor: number;
  revenueMinor: number;
  netMinor: number;
  timeInvestedMinutes: number;
  currency: string;
};

export type DailyFinanceBrief = {
  dateYmd: string;
  currency: string;
  spendTodayMinor: number;
  largestToday: { merchant: string | null; amountMinor: number } | null;
  topCategoriesToday: MoneyBucket[];
  monthSpendMinor: number;
  budgetUsedPercent: number | null;
  insight: string | null;
  insightFigures: Record<string, number | string | null>;
  enoughData: boolean;
};
