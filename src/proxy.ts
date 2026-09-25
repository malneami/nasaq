import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { APP_ROUTE_PATHS } from '@/lib/nav-items';
import { isAppLocale, routing } from '@/lib/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const handleI18nRouting = createIntlMiddleware(routing);

function stripLocale(pathname: string): string {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];

  if (maybeLocale && isAppLocale(maybeLocale)) {
    const rest = `/${segments.slice(2).join('/')}`;
    return rest === '/' ? '/' : rest.replace(/\/$/, '') || '/';
  }

  return pathname;
}

function getLocaleFromPath(pathname: string) {
  const maybeLocale = pathname.split('/')[1];
  return maybeLocale && isAppLocale(maybeLocale)
    ? maybeLocale
    : routing.defaultLocale;
}

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  source.cookies.getAll().forEach(({ name, value }) => {
    redirectResponse.cookies.set(name, value);
  });
  return redirectResponse;
}

export default async function proxy(request: NextRequest) {
  const i18nResponse = handleI18nRouting(request);
  const { response, user } = await updateSession(request, i18nResponse);

  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  const pathname = stripLocale(request.nextUrl.pathname);
  const locale = getLocaleFromPath(request.nextUrl.pathname);
  const isLogin = pathname === '/login';
  const isAppRoute =
    pathname === '/' ||
    APP_ROUTE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return redirectWithCookies(url, response);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/today`;
    return redirectWithCookies(url, response);
  }

  return response;
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
