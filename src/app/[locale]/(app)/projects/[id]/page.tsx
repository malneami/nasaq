import { getTranslations } from 'next-intl/server';
import { ProjectDetail } from '@/components/projects/project-detail';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations('projects');
  await params;
  return { title: t('workspaceTitle') };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-3xl">
      <ProjectDetail projectId={id} />
    </section>
  );
}
