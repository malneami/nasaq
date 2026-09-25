'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { InboxItemDto } from '@/lib/inbox/types';

function statusLabel(
  item: InboxItemDto,
  t: ReturnType<typeof useTranslations<'inbox'>>,
) {
  if (item.status === 'processed') {
    return t('statusProcessed');
  }
  if (item.status === 'discarded') {
    return t('statusDiscarded');
  }
  const state = item.payload.classificationStatus;
  if (state === 'pending') {
    return t('statusClassifying');
  }
  if (state === 'failed') {
    return t('statusFailed');
  }
  if (state === 'needs_confirmation') {
    return t('statusNeedsConfirmation');
  }
  if (item.aiType) {
    return t('statusSuggested', { type: t(`types.${item.aiType}`) });
  }
  return t('statusClassifying');
}

export function InboxList({
  title,
  items,
  empty,
  collapsed,
  onToggleCollapsed,
  selectedIds,
  onToggleSelected,
  onOpen,
  onRetry,
  showBulk,
  onBulkDiscard,
  onBulkReclassify,
}: {
  title: string;
  items: InboxItemDto[];
  empty: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onOpen: (item: InboxItemDto) => void;
  onRetry: (id: string) => void;
  showBulk?: boolean;
  onBulkDiscard?: () => void;
  onBulkReclassify?: () => void;
}) {
  const t = useTranslations('inbox');
  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
        {onToggleCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ms-auto"
            onClick={onToggleCollapsed}
          >
            {collapsed ? t('expand') : t('collapse')}
          </Button>
        ) : null}
      </div>

      {showBulk && selectedCount > 0 ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onBulkReclassify}
          >
            {t('reclassify')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onBulkDiscard}
          >
            {t('discard')}
          </Button>
        </div>
      ) : null}

      {collapsed ? null : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3">
                {showBulk ? (
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelected(item.id)}
                    aria-label={t('selectItem')}
                  />
                ) : null}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start"
                  onClick={() => onOpen(item)}
                >
                  <p className="truncate text-sm font-medium">{item.rawText}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Riyadh',
                    }).format(new Date(item.createdAt))}
                    {' · '}
                    {statusLabel(item, t)}
                  </p>
                </button>
                {item.payload.classificationStatus === 'failed' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRetry(item.id)}
                  >
                    {t('retry')}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
