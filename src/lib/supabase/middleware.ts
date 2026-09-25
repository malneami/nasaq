import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from '@/lib/env';

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

  return { response, user };
}
