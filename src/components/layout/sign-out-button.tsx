import { getTranslations } from 'next-intl/server';
import { signOut } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

export async function SignOutButton() {
  const t = await getTranslations('auth');

  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        {t('signOut')}
      </Button>
    </form>
  );
}
