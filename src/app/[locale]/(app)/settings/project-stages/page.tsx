import { getTranslations } from 'next-intl/server';
import { ProjectStagesSettings } from '@/components/projects/project-stages-settings';
import { Link } from '@/lib/i18n/navigation';

export async function generateMetadata() {
  const t = await getTranslations('projects');
  return { title: t('stagesSettingsTitle') };
}

export default async function ProjectStagesSettingsPage() {
  const t = await getTranslations('projects');
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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t('stagesSettingsTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('stagesSettingsHint')}
        </p>
      </div>
      <ProjectStagesSettings />
    </section>
  );
}
