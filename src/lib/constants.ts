export const DEFAULT_CURRENCY = 'SAR' as const;
export const DEFAULT_TIMEZONE = 'Asia/Riyadh' as const;

export type CurrencyCode = typeof DEFAULT_CURRENCY;
export type TimezoneName = typeof DEFAULT_TIMEZONE;
