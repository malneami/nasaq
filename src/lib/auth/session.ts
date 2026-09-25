import 'server-only';

import { getCurrentUser } from '@/lib/supabase/server';

export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  return user.id;
}
