import { DEFAULT_CURRENCY, type CurrencyCode } from '@/lib/constants';
import type { AppLocale } from '@/lib/i18n/routing';

const localeToIntl: Record<AppLocale, string> = {
  en: 'en-SA',
  ar: 'ar-SA',
};

const MINOR_DIGITS: Record<string, number> = {
  SAR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
};

function fractionDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

export function toMinor(
  major: number,
  currency: CurrencyCode | string = DEFAULT_CURRENCY,
): number {
  const factor = 10 ** fractionDigits(currency);
  return Math.round(major * factor);
}

export function toMajor(
  minor: number,
  currency: CurrencyCode | string = DEFAULT_CURRENCY,
): number {
  const factor = 10 ** fractionDigits(currency);
  return minor / factor;
}

export function formatMoney(
  minor: number,
  currency: CurrencyCode | string = DEFAULT_CURRENCY,
  locale: AppLocale = 'en',
): string {
  return new Intl.NumberFormat(localeToIntl[locale], {
    style: 'currency',
    currency,
  }).format(toMajor(minor, currency));
}
