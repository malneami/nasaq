'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { GoogleGlyph } from '@/components/auth/google-glyph';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { signIn, signUp } from '@/lib/auth/actions';
import { getSupabasePublicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import { authSchema, type AuthInput } from '@/lib/validations/auth';

export function LoginForm({ oauthError = false }: { oauthError?: boolean }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [pendingAction, setPendingAction] = useState<
    'in' | 'up' | 'google' | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthInput>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (oauthError) {
      toast.error(t('googleFailed'));
    }
  }, [oauthError, t]);

  async function submit(values: AuthInput, action: 'in' | 'up'): Promise<void> {
    setPendingAction(action);
    try {
      const result =
        action === 'in' ? await signIn(values) : await signUp(values);

      if (result?.error) {
        toast.error(t(result.error));
      }

      if (result?.success) {
        toast.success(t(result.success));
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function signInWithGoogle() {
    if (!getSupabasePublicEnv()) {
      toast.error(t('notConfigured'));
      return;
    }

    setPendingAction('google');
    try {
      const supabase = createClient();
      const redirectTo = new URL('/api/auth/callback', window.location.origin);
      redirectTo.searchParams.set('next', `/${locale}/today`);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        toast.error(t('googleFailed'));
        setPendingAction(null);
      }
    } catch {
      toast.error(t('googleFailed'));
      setPendingAction(null);
    }
  }

  const isSubmitting = pendingAction !== null;

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full gap-2.5 text-sm font-medium"
        disabled={isSubmitting}
        onClick={() => void signInWithGoogle()}
      >
        <GoogleGlyph className="size-4" />
        {pendingAction === 'google'
          ? t('googleRedirecting')
          : t('continueWithGoogle')}
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <p className="text-xs text-muted-foreground">{t('orEmail')}</p>
        <Separator className="flex-1" />
      </div>

      <form className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email ? (
            <p className="text-sm text-destructive">{t('invalidEmail')}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{t('passwordMin')}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit((values) => submit(values, 'in'))}
          >
            {t('signIn')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={handleSubmit((values) => submit(values, 'up'))}
          >
            {t('createAccount')}
          </Button>
        </div>
      </form>

      {process.env.NODE_ENV === 'development' ? (
        <div className="pt-2">
          <Separator className="mb-4" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            disabled={isSubmitting}
            onClick={async () => {
              await fetch('/api/auth/dev-login');
              window.location.href = `/${locale}/today`;
            }}
          >
            🧪 Sign in as test user
          </Button>
        </div>
      ) : null}
    </div>
  );
}
