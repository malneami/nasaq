import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { ProjectsWorkspace } from '@/components/projects/projects-workspace';
import { createPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = createPageMetadata('projects');

export default async function ProjectsPage() {
  const t = await getTranslations('pages.projects');

  return (
    <section className="mx-auto max-w-6xl">
      <div className="bento-card bento-enter mb-8 flex items-center gap-3 p-4" style={{ animationDelay: '0.08s' }}>
        <span className="nasaq-focus-dot" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <Suspense>
        <ProjectsWorkspace />
      </Suspense>
    </section>
  );
}
