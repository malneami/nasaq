import { getLocale } from 'next-intl/server';
import { redirect } from '@/lib/i18n/navigation';

export default async function LocaleIndexPage() {
  const locale = await getLocale();
  redirect({ href: '/today', locale });
}
