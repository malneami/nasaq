import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicEnv } from '@/lib/env';
import { DEV_COOKIE_NAME } from '@/lib/auth/dev-session';

export async function POST(request: NextRequest) {
  const env = getSupabasePublicEnv();

  let response = NextResponse.json({ success: true });

  if (env) {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    await supabase.auth.signOut();
  }

  // Clear dev session cookie if present
  response.cookies.set(DEV_COOKIE_NAME, '', { path: '/', maxAge: 0 });

  return response;
}
