import { Settings } from 'lucide-react';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export async function TopBar({ userEmail }: { userEmail?: string }) {
  const t = await getTranslations('nav');

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border px-4 sm:px-6">
      {userEmail ? (
        <span className="me-auto truncate text-sm text-muted-foreground">
          {userEmail}
        </span>
      ) : null}
      <LanguageSwitcher />
      <ThemeToggle />
      <Button type="button" variant="ghost" size="icon-sm" asChild>
        <Link href="/settings" aria-label={t('settings')}>
          <Settings />
        </Link>
      </Button>
      <SignOutButton />
    </header>
  );
}
