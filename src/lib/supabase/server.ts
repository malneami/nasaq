import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from '@/lib/env';
import { DEV_COOKIE_NAME, getDevUser } from '@/lib/auth/dev-session';

export async function createClient() {
  const env = getSupabasePublicEnv();

  if (!env) {
    throw new Error('Supabase public environment variables are not set.');
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; proxy refreshes the session.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  // Dev-only test account bypass
  const devUser = getDevUser(cookieStore.get(DEV_COOKIE_NAME)?.value);
  if (devUser) return devUser;

  if (!getSupabasePublicEnv()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
