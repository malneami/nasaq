import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicEnv } from '@/lib/env';
import { authSchema } from '@/lib/validations/auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = authSchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const errorKey =
      issue?.path[0] === 'email' ? 'invalidEmail' : 'passwordMin';
    return NextResponse.json({ error: errorKey }, { status: 400 });
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 500 });
  }

  let response = NextResponse.json({ success: true });

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

  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    return NextResponse.json({ error: 'createFailed' }, { status: 400 });
  }

  if (!data.session) {
    return NextResponse.json({ success: 'confirmEmail' });
  }

  return response;
}
