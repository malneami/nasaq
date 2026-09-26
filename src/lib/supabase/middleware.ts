import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from '@/lib/env';
import { DEV_COOKIE_NAME, getDevUser } from '@/lib/auth/dev-session';

type SessionResult = {
  response: NextResponse;
  user: User | null;
};

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<SessionResult> {
  const env = getSupabasePublicEnv();

  if (!env) {
    return { response, user: null };
  }

  let user: User | null = null;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  user = authUser;

  // Dev-only test account bypass
  if (!user) {
    const devUser = getDevUser(request.cookies.get(DEV_COOKIE_NAME)?.value);
    if (devUser) user = devUser;
  }

  return { response, user };
}
