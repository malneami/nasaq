import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CalendarWorkbench } from '@/components/calendar/calendar-workbench';
import { PageHeader } from '@/components/layout/page-header';
import { loadCalendarBoard } from '@/lib/calendar/actions';
import { createPageMetadata } from '@/lib/page-metadata';
import { startOfWeekYmd, ymdInTimeZone } from '@/lib/time/zoned';
import { DEFAULT_TIMEZONE } from '@/lib/constants';

export const generateMetadata = createPageMetadata('calendar');

async function CalendarBoard() {
  const today = ymdInTimeZone(new Date(), DEFAULT_TIMEZONE);
  const weekStart = startOfWeekYmd(today, DEFAULT_TIMEZONE, 0);
  const result = await loadCalendarBoard({
    view: 'week',
    anchorYmd: weekStart,
  });
  return (
    <CalendarWorkbench
      initialBoard={result.ok ? result.data : null}
      initialError={result.ok ? null : result.error}
    />
  );
}

export default async function CalendarPage() {
  const t = await getTranslations('pages.calendar');

  return (
    <section className="mx-auto max-w-7xl">
      <PageHeader title={t('title')} description={t('description')} />
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <CalendarBoard />
      </Suspense>
    </section>
  );
}
