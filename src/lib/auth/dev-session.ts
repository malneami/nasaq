import type { User } from '@supabase/supabase-js';

export const DEV_COOKIE_NAME = 'nasaq-dev-session';
const DEV_COOKIE_VALUE = 'active';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

const DEV_USER = {
  id: DEV_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@nasaq.dev',
  app_metadata: { provider: 'dev' as const },
  user_metadata: {},
  created_at: '2025-01-01T00:00:00.000Z',
} as unknown as User;

/** Returns the mock dev user when the cookie value matches, else null. */
export function getDevUser(cookieValue: string | undefined): User | null {
  if (process.env.NODE_ENV !== 'development') return null;
  if (cookieValue === DEV_COOKIE_VALUE) return DEV_USER;
  return null;
}

export function getDevCookieValue(): string {
  return DEV_COOKIE_VALUE;
}
