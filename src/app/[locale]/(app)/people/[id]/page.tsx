import { getTranslations } from 'next-intl/server';
import { ContactDetailView } from '@/components/people/contact-detail';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations('people');
  await params;
  return { title: t('contactTitle') };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl">
      <ContactDetailView contactId={id} />
    </section>
  );
}
