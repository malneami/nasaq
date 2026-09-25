import { getTranslations } from 'next-intl/server';
import { TodaySection } from '@/components/today/today-section';
import { Link } from '@/lib/i18n/navigation';
import type { TodayFollowUpItem } from '@/lib/today/types';

function followUpHref(href: string) {
  if (href === '/people?tab=waiting') {
    return { pathname: '/people' as const, query: { tab: 'waiting' } };
  }
  if (href === '/people?tab=commitments') {
    return { pathname: '/people' as const, query: { tab: 'commitments' } };
  }
  if (href.startsWith('/people/')) {
    return href as `/people/${string}`;
  }
  return '/people' as const;
}

export async function TodayFollowUps({ items }: { items: TodayFollowUpItem[] }) {
  const t = await getTranslations('today');
  if (items.length === 0) {
    return null;
  }

  return (
    <TodaySection title={t('followUpsTitle')} href="/people" hrefLabel={t('openPeople')}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={followUpHref(item.href)}
              className="bento-card block px-3 py-2.5 text-start hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{item.personName}</p>
                {item.overdue ? (
                  <span className="text-xs text-destructive">{t('overdue')}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{item.owed}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.staleDays != null
                  ? t('lastContact', { days: item.staleDays })
                  : t('noContact')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </TodaySection>
  );
}
