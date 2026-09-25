/**
 * Typed exports for Reviews (Task 12) and other consumers.
 * All functions are read-only over the user's financial data.
 */
export {
  getMonthlyFinanceSummary,
  getSubscriptions,
  getUnusualSpending,
  getHealthScore,
  getVentureFinance,
} from '@/lib/finance/intelligence/service';
export { ensureDailyFinanceBrief } from '@/lib/finance/intelligence/brief';
export type {
  MonthlyFinanceSummary,
  SubscriptionItem,
  UnusualSpendItem,
  HealthScore,
  VentureFinanceRow,
  DailyFinanceBrief,
} from '@/lib/finance/intelligence/types';
export { HEALTH_SCORE_WEIGHTS } from '@/lib/finance/intelligence/constants';
