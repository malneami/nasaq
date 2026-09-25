import { getTranslations } from 'next-intl/server';
import { TodaySection } from '@/components/today/today-section';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { TodayAttentionItem } from '@/lib/today/types';

function attentionHref(href: string) {
  if (href === '/projects?tab=tasks') {
    return { pathname: '/projects' as const, query: { tab: 'tasks' } };
  }
  if (href === '/people?tab=waiting') {
    return { pathname: '/people' as const, query: { tab: 'waiting' } };
  }
  if (href === '/people?tab=commitments') {
    return { pathname: '/people' as const, query: { tab: 'commitments' } };
  }
  if (href.startsWith('/people/')) {
    return href as `/people/${string}`;
  }
  if (href.startsWith('/finance')) {
    return href as '/finance';
  }
  return href as '/people' | '/finance' | '/projects' | `/projects/${string}`;
}

export async function TodayAttention({ items }: { items: TodayAttentionItem[] }) {
  const t = await getTranslations('today');
  if (items.length === 0) {
    return null;
  }

  return (
    <TodaySection title={t('attentionTitle')}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={attentionHref(item.href)}
              className={cn(
                'block rounded-lg border px-3 py-2 text-start',
                item.tone === 'danger'
                  ? 'border-destructive/30 bg-destructive/5'
                  : item.tone === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/8'
                    : 'border-border/70 bg-muted/30',
              )}
            >
              <p className="font-medium">
                {item.detail === 'unclassifiedTx'
                  ? t('attentionUnclassifiedTitle')
                  : item.detail === 'unusualSpend'
                    ? t('attentionUnusualTitle')
                    : item.detail === 'imbalance'
                      ? t('attentionImbalanceTitle')
                      : item.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t(`attentionDetail.${item.detail}`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </TodaySection>
  );
}
