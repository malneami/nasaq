'use client';

import type { ReactNode } from 'react';
import { DirectionProvider } from '@/components/ui/direction';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { PreferencesProvider } from '@/components/providers/preferences-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import type { AppLocale } from '@/lib/i18n/routing';

export function AppProviders({
  children,
  locale,
  direction,
}: {
  children: ReactNode;
  locale: AppLocale;
  direction: 'ltr' | 'rtl';
}) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <DirectionProvider dir={direction}>
          <PreferencesProvider locale={locale}>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </PreferencesProvider>
        </DirectionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
