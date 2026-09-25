import { getTranslations } from 'next-intl/server';
import type { AppNavKey } from '@/lib/nav-items';

export function createPageMetadata(page: AppNavKey) {
  return async function generateMetadata() {
    const t = await getTranslations(`pages.${page}`);
    return { title: t('title') };
  };
}
