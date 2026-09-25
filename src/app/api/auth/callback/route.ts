import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicEnv } from '@/lib/env';
import { isAppLocale, routing } from '@/lib/i18n/routing';

function safeNextPath(next: string | null): string {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\')
  ) {
    return `/${routing.defaultLocale}/today`;
  }

  const locale = next.split('/')[1];
  if (!locale || !isAppLocale(locale)) {
    return `/${routing.defaultLocale}/today`;
  }

  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const locale = next.split('/')[1] ?? routing.defaultLocale;
  const errorRedirect = `${origin}/${locale}/login?error=oauth`;

  if (searchParams.get('error') || !code) {
    return NextResponse.redirect(errorRedirect);
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.redirect(errorRedirect);
  }

  let redirectResponse = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        redirectResponse = NextResponse.redirect(`${origin}${next}`);
        cookiesToSet.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(errorRedirect);
  }

  return redirectResponse;
}
