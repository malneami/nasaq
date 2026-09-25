import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const t = await getTranslations('settings');

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-3 border-b border-primary/25 pb-4">
        <span className="size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgb(232_160_28_/_0.18)]" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>
      <ul className="space-y-2">
        <li>
          <Link
            href="/settings/life-areas"
            className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40"
          >
            <p className="font-medium">{t('lifeAreas')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('lifeAreasHint')}
            </p>
          </Link>
        </li>
        <li>
          <Link
            href={{ pathname: '/projects', query: { tab: 'goals' } }}
            className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40"
          >
            <p className="font-medium">{t('goals')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('goalsHint')}</p>
          </Link>
        </li>
        <li>
          <Link
            href="/settings/project-stages"
            className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40"
          >
            <p className="font-medium">{t('projectStages')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('projectStagesHint')}
            </p>
          </Link>
        </li>
      </ul>
    </section>
  );
}
