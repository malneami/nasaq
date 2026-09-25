'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp } from '@/lib/auth/actions';
import { authSchema, type AuthInput } from '@/lib/validations/auth';

export function LoginForm() {
  const t = useTranslations('auth');
  const [pendingAction, setPendingAction] = useState<'in' | 'up' | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthInput>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

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

  const isSubmitting = pendingAction !== null;

  return (
    <div className="space-y-5">
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
    </div>
  );
}
