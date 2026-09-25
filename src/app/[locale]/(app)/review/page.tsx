import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { ReviewHub } from '@/components/reviews/review-hub';
import { createPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = createPageMetadata('review');

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations('pages.review');
  const params = await searchParams;
  const tab = ['morning', 'shutdown', 'weekly', 'monthly'].includes(
    params.tab ?? '',
  )
    ? (params.tab as 'morning' | 'shutdown' | 'weekly' | 'monthly')
    : undefined;

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center gap-3 border-b border-primary/25 pb-4">
        <span className="size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgb(232_160_28_/_0.18)]" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <Suspense>
        <ReviewHub initialTab={tab} />
      </Suspense>
    </section>
  );
}
