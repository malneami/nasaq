import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/app-shell';
import { redirect } from '@/lib/i18n/navigation';
import { getCurrentUser } from '@/lib/supabase/server';

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) {
    redirect({ href: '/login', locale });
  }

  return (
    <AppShell userEmail={user?.email ?? undefined}>{children}</AppShell>
  );
}
