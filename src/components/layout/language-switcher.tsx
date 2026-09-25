'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/components/providers/preferences-provider';
import { routing, type AppLocale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const { locale, setLocale } = usePreferences();

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex items-center rounded-lg border border-border bg-background p-0.5"
    >
      {routing.locales.map((code: AppLocale) => (
        <Button
          key={code}
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cn(
            'px-2.5',
            locale === code && 'bg-muted text-foreground',
          )}
        >
          {t(code)}
        </Button>
      ))}
    </div>
  );
}
