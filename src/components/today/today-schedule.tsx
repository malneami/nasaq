import { getLocale, getTranslations } from 'next-intl/server';
import { EVENT_TYPE_TONES, StatusPill } from '@/components/status-pill';
import { TodaySection } from '@/components/today/today-section';
import { cn } from '@/lib/utils';
import type { TodayScheduleItem } from '@/lib/today/types';
import { formatTimeInZone } from '@/lib/time/zoned';

export async function TodaySchedule({
  items,
  timezone,
}: {
  items: TodayScheduleItem[];
  timezone: string;
}) {
  const t = await getTranslations('today');
  const locale = await getLocale();

  return (
    <TodaySection title={t('scheduleTitle')} href="/calendar" hrefLabel={t('openCalendar')}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('scheduleEmpty')}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => {
            const distinct = item.eventType === 'family' || item.eventType === 'protected' || item.isProtected;
            const start = new Date(item.startsAt);
            const end = new Date(item.endsAt);
            return (
              <li
                key={item.id}
                className={cn(
                  'bento-card flex items-start justify-between gap-3 px-3 py-2.5 text-sm',
                  distinct
                    ? item.eventType === 'family'
                      ? 'border-s-2 border-amber-500 bg-amber-500/8'
                      : 'border-s-2 border-sky-500 bg-sky-500/8'
                    : 'bg-card',
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.allDay
                      ? t('allDay')
                      : `${formatTimeInZone(start, locale, timezone)} – ${formatTimeInZone(end, locale, timezone)}`}
                  </p>
                </div>
                <StatusPill
                  label={t(`eventTypes.${item.eventType}`)}
                  tone={EVENT_TYPE_TONES[item.eventType]}
                />
              </li>
            );
          })}
        </ol>
      )}
    </TodaySection>
  );
}
