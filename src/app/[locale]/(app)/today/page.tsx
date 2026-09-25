import { TodayBoard } from '@/components/today/today-board';
import { QuickAddFab } from '@/components/today/quick-add-fab';
import { createPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = createPageMetadata('today');

export default function TodayPage() {
  return (
    <section className="mx-auto max-w-5xl">
      <TodayBoard />
      <QuickAddFab />
    </section>
  );
}
