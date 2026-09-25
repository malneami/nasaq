/**
 * Finance intelligence — deterministic knobs only.
 * AI may phrase these figures; it never invents them.
 */

/** Categories treated as fixed obligations for breakdowns. */
export const FIXED_CATEGORY_NAMES = [
  'Housing',
  'Utilities',
  'Subscriptions',
  'Education',
  'Health',
] as const;

/** Category spend ≥ this multiple of its recent baseline is "unusual". */
export const UNUSUAL_SPEND_FACTOR = 1.5;

/** Absolute minor-unit floor before a category can be flagged unusual. */
export const UNUSUAL_MIN_MINOR = 5000; // 50 SAR

/** Subscription detection: same merchant, ≥ this count in lookback. */
export const SUBSCRIPTION_MIN_OCCURRENCES = 2;

/** Lookback months for subscription / baseline detection. */
export const SUBSCRIPTION_LOOKBACK_MONTHS = 4;

/** Amount similarity band for recurring detection (± percent). */
export const SUBSCRIPTION_AMOUNT_TOLERANCE_PCT = 15;

/**
 * Financial Health Score (0–100) — fully explainable.
 * Each factor contributes weight × score01 × 100 to the total.
 */
export const HEALTH_SCORE_WEIGHTS = {
  savingsRate: 0.25,
  emergencyRunway: 0.25,
  burnVsIncome: 0.2,
  recurringLoad: 0.15,
  debtLoad: 0.15,
} as const;

/** Months of burn covered by emergency fund for a full score. */
export const EMERGENCY_FULL_RUNWAY_MONTHS = 6;

/** Savings rate (%) that earns a full savings-rate factor. */
export const SAVINGS_RATE_FULL_PCT = 20;
