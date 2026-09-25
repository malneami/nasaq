import { getTranslations } from 'next-intl/server';
import type { AppNavKey } from '@/lib/nav-items';
import { PageHeader } from '@/components/layout/page-header';

export async function PlaceholderPage({ page }: { page: AppNavKey }) {
  const t = await getTranslations(`pages.${page}`);

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader title={t('title')} description={t('description')} />
    </section>
  );
}
