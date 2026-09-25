import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import type { TodayHeaderModel } from '@/lib/today/types';
import { formatYmdLocalized } from '@/lib/time/zoned';

export async function TodayHeaderView({ header }: { header: TodayHeaderModel }) {
  const t = await getTranslations('today');
  const locale = await getLocale();
  const formattedDate = formatYmdLocalized(header.dateYmd, locale, header.timezone);
  const name = header.displayName?.trim() || t('friend');

  return (
    <header className="space-y-3">
      <p className="text-sm text-muted-foreground">{formattedDate}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {t(`greetings.${header.greeting}`, { name })}
      </h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          {header.shiftTitle
            ? t('shift', { title: header.shiftTitle })
            : t('noShift')}
        </span>
        <span>
          {t('capacity', { hours: header.capacityHours })}
          {header.capacityProvisional ? (
            <>
              {' '}
              <span className="text-xs uppercase tracking-wide">
                {t('provisional')}
              </span>
            </>
          ) : null}
        </span>
      </div>
      <p className="text-sm text-foreground/80">
        {t(`focusStatus.${header.focusStatus}`, {
          count: header.confirmedCount,
          limit: header.outcomesLimit,
        })}
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={{ pathname: '/review', query: { tab: 'morning' } }}
          className="text-primary underline-offset-2 hover:underline"
        >
          {t('openMorningBrief')}
        </Link>
        <Link
          href={{ pathname: '/review', query: { tab: 'shutdown' } }}
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('openShutdown')}
        </Link>
      </div>
    </header>
  );
}
