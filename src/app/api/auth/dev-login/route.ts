import { NextResponse, type NextRequest } from 'next/server';
import { DEV_COOKIE_NAME, getDevCookieValue } from '@/lib/auth/dev-session';

export function GET(_request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  // Use a relative redirect so the browser stays on the correct host
  const response = NextResponse.json(
    { redirect: '/today' },
    { status: 200 },
  );
  response.cookies.set(DEV_COOKIE_NAME, getDevCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return response;
}
