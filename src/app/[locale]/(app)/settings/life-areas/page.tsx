import { getTranslations } from 'next-intl/server';
import { LifeAreasManager } from '@/components/life-areas/life-areas-manager';
import { Link } from '@/lib/i18n/navigation';

export async function generateMetadata() {
  const t = await getTranslations('lifeAreas');
  return { title: t('title') };
}

export default async function LifeAreasSettingsPage() {
  const t = await getTranslations('lifeAreas');
  const settings = await getTranslations('settings');

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-8 border-b border-primary/25 pb-4">
        <Link
          href="/settings"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {settings('back')}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgb(232_160_28_/_0.18)]" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>
      <LifeAreasManager />
    </section>
  );
}
