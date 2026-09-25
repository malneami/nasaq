'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocale } from 'next-intl';
import {
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  type CurrencyCode,
  type TimezoneName,
} from '@/lib/constants';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { isAppLocale, type AppLocale } from '@/lib/i18n/routing';

type Preferences = {
  locale: AppLocale;
  timezone: TimezoneName;
  currency: CurrencyCode;
  setLocale: (locale: AppLocale) => void;
  setTimezone: (timezone: TimezoneName) => void;
  setCurrency: (currency: CurrencyCode) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

export function PreferencesProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: AppLocale;
}) {
  const intlLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [timezone, setTimezone] = useState<TimezoneName>(DEFAULT_TIMEZONE);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  const setLocale = useCallback(
    (next: AppLocale) => {
      router.replace(pathname, { locale: next });
    },
    [pathname, router],
  );

  const value = useMemo<Preferences>(
    () => ({
      locale: isAppLocale(intlLocale) ? intlLocale : locale,
      timezone,
      currency,
      setLocale,
      setTimezone,
      setCurrency,
    }),
    [intlLocale, locale, timezone, currency, setLocale],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }

  return context;
}
