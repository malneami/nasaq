import type { ReactNode } from 'react';
import { BrandMark } from '@/components/layout/brand-mark';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations('app');

  return (
    <div className="nasaq-path-surface relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--navy)_18%,transparent),transparent_64%)]"
      />
      <div className="relative mb-10 flex flex-col items-center text-center">
        <BrandMark size="lg" showName={false} className="mb-5" />
        <p className="text-3xl font-semibold tracking-tight text-primary">
          {t('name')}
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-primary/70">
          {t('productLine')}
        </p>
        <p className="mt-3 max-w-sm text-base text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card/95 p-8 shadow-sm backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}
