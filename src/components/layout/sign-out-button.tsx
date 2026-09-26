'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => void handleSignOut()}
    >
      {t('signOut')}
    </Button>
  );
}
