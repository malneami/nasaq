import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { FinanceWorkbench } from '@/components/finance/finance-workbench';
import { createPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = createPageMetadata('finance');

export default async function FinancePage() {
  const t = await getTranslations('pages.finance');

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center gap-3 border-b border-primary/25 pb-4">
        <span className="size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgb(232_160_28_/_0.18)]" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <Suspense>
        <FinanceWorkbench />
      </Suspense>
    </section>
  );
}
