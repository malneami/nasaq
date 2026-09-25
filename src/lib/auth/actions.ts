'use server';

import { getLocale } from 'next-intl/server';
import { redirect } from '@/lib/i18n/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { authSchema, type AuthInput } from '@/lib/validations/auth';

export type AuthErrorKey =
  | 'invalidEmail'
  | 'passwordMin'
  | 'invalidCredentials'
  | 'createFailed'
  | 'notConfigured'
  | 'confirmEmail';

export type AuthActionResult = {
  error?: AuthErrorKey;
  success?: AuthErrorKey;
};

function parseAuthInput(
  input: AuthInput,
): { ok: true; data: AuthInput } | { ok: false; error: AuthErrorKey } {
  const parsed = authSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'email') {
      return { ok: false, error: 'invalidEmail' };
    }
    return { ok: false, error: 'passwordMin' };
  }

  return { ok: true, data: parsed.data };
}

export async function signIn(input: AuthInput): Promise<AuthActionResult> {
  const parsed = parseAuthInput(input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  if (!isSupabaseConfigured()) {
    return { error: 'notConfigured' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: 'invalidCredentials' };
  }

  const locale = await getLocale();
  redirect({ href: '/today', locale });
  return {};
}

export async function signUp(input: AuthInput): Promise<AuthActionResult> {
  const parsed = parseAuthInput(input);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  if (!isSupabaseConfigured()) {
    return { error: 'notConfigured' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    return { error: 'createFailed' };
  }

  if (!data.session) {
    return { success: 'confirmEmail' };
  }

  const locale = await getLocale();
  redirect({ href: '/today', locale });
  return {};
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const locale = await getLocale();
  redirect({ href: '/login', locale });
}
