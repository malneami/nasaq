'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CaptureBox } from '@/components/inbox/capture-box';
import { InboxList } from '@/components/inbox/inbox-list';
import { ReviewPanel } from '@/components/inbox/review-panel';
import { useRouter } from '@/lib/i18n/navigation';
import {
  acceptInboxItem,
  captureInboxItem,
  captureManualTransaction,
  discardInboxItems,
  listInbox,
} from '@/lib/inbox/actions';
import { enqueueClassify } from '@/lib/inbox/classify-client';
import type {
  ExtractedFields,
  InboxInputKind,
  InboxItemDto,
  InboxType,
} from '@/lib/inbox/types';
import type { AppLocale } from '@/lib/i18n/routing';

const INBOX_KEY = ['inbox-items'] as const;

const INBOX_ERROR_KEYS = [
  'empty',
  'captureFailed',
  'convertFailed',
  'discardFailed',
  'amountRequired',
  'noCashAccount',
  'typeRequired',
  'unauthenticated',
  'failed',
  'notFound',
] as const;

type InboxErrorKey = (typeof INBOX_ERROR_KEYS)[number];

function errorMessage(
  t: (key: InboxErrorKey) => string,
  key: string | undefined,
  fallback: InboxErrorKey,
) {
  if (key && INBOX_ERROR_KEYS.includes(key as InboxErrorKey)) {
    return t(key as InboxErrorKey);
  }
  return t(fallback);
}

function replaceItem(items: InboxItemDto[], next: InboxItemDto) {
  return items.map((item) => (item.id === next.id ? next : item));
}

export function InboxWorkbench() {
  const t = useTranslations('inbox');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processedOpen, setProcessedOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());

  const inboxQuery = useQuery({
    queryKey: INBOX_KEY,
    queryFn: listInbox,
  });

  const items = useMemo(() => inboxQuery.data ?? [], [inboxQuery.data]);
  const reviewItem = items.find((item) => item.id === reviewId) ?? null;

  const needsReview = useMemo(
    () => items.filter((item) => item.status === 'unprocessed'),
    [items],
  );
  const processed = useMemo(
    () => items.filter((item) => item.status !== 'unprocessed'),
    [items],
  );

  function markClassifying(id: string, active: boolean) {
    setClassifyingIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function queueClassify(id: string, force = false) {
    markClassifying(id, true);
    enqueueClassify(id, force, (item) => {
      markClassifying(id, false);
      if (item) {
        queryClient.setQueryData<InboxItemDto[]>(INBOX_KEY, (current) =>
          current ? replaceItem(current, item) : [item],
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      }
    });
  }

  const captureMutation = useMutation({
    mutationFn: (input: { rawText: string; inputKind: InboxInputKind }) =>
      captureInboxItem(input),
    onSuccess: (result) => {
      if (result.error || !result.item) {
        toast.error(errorMessage(t, result.error, 'captureFailed'));
        return;
      }
      queryClient.setQueryData<InboxItemDto[]>(INBOX_KEY, (current) => [
        result.item!,
        ...(current ?? []),
      ]);
      queueClassify(result.item.id);
    },
  });

  const manualMutation = useMutation({
    mutationFn: captureManualTransaction,
    onSuccess: (result) => {
      if (result.error || !result.item) {
        toast.error(errorMessage(t, result.error, 'captureFailed'));
        return;
      }
      queryClient.setQueryData<InboxItemDto[]>(INBOX_KEY, (current) => [
        result.item!,
        ...(current ?? []).filter((item) => item.id !== result.item?.id),
      ]);
      toast.success(t('converted'), {
        action: result.href
          ? {
              label: t('openEntity'),
              onClick: () => {
                router.push(
                  result.href as
                    | '/inbox'
                    | '/projects'
                    | '/people'
                    | '/finance'
                    | '/calendar',
                );
              },
            }
          : undefined,
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: acceptInboxItem,
    onSuccess: (result) => {
      if (result.error || !result.item) {
        toast.error(errorMessage(t, result.error, 'convertFailed'));
        return;
      }
      queryClient.setQueryData<InboxItemDto[]>(INBOX_KEY, (current) =>
        current ? replaceItem(current, result.item!) : [result.item!],
      );
      setReviewId(null);
      toast.success(t('converted'), {
        action: result.href
          ? {
              label: t('openEntity'),
              onClick: () => {
                router.push(
                  result.href as
                    | '/inbox'
                    | '/projects'
                    | '/people'
                    | '/finance'
                    | '/calendar',
                );
              },
            }
          : undefined,
      });
    },
  });

  const discardMutation = useMutation({
    mutationFn: discardInboxItems,
    onSuccess: (result, ids) => {
      if (result.error) {
        toast.error(t('discardFailed'));
        return;
      }
      queryClient.setQueryData<InboxItemDto[]>(INBOX_KEY, (current) =>
        (current ?? []).map((item) =>
          ids.includes(item.id) ? { ...item, status: 'discarded' } : item,
        ),
      );
      setSelectedIds(new Set());
      setReviewId(null);
    },
  });

  const visibleNeedsReview = needsReview.map((item) =>
    classifyingIds.has(item.id)
      ? {
          ...item,
          payload: {
            ...item.payload,
            classificationStatus: 'pending' as const,
          },
        }
      : item,
  );

  return (
    <div className="space-y-8">
      <CaptureBox
        autoFocus={searchParams.get('focus') === '1'}
        pending={captureMutation.isPending || manualMutation.isPending}
        onCapture={async (input) => {
          await captureMutation.mutateAsync(input);
        }}
        onManualTransaction={async (input) => {
          await manualMutation.mutateAsync(input);
        }}
      />

      {inboxQuery.isError ? (
        <p className="text-sm text-destructive">{t('captureFailed')}</p>
      ) : null}

      <InboxList
        title={t('needsReview')}
        items={visibleNeedsReview}
        empty={t('needsReviewEmpty')}
        selectedIds={selectedIds}
        onToggleSelected={(id) => {
          setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            return next;
          });
        }}
        onOpen={(item) => {
          if (item.payload.classificationStatus === 'pending') {
            return;
          }
          setReviewId(item.id);
        }}
        onRetry={(id) => queueClassify(id, true)}
        showBulk
        onBulkDiscard={() => {
          void discardMutation.mutateAsync([...selectedIds]);
        }}
        onBulkReclassify={() => {
          selectedIds.forEach((id) => queueClassify(id, true));
        }}
      />

      <InboxList
        title={t('processed')}
        items={processed}
        empty={t('processedEmpty')}
        collapsed={!processedOpen}
        onToggleCollapsed={() => setProcessedOpen((open) => !open)}
        selectedIds={new Set()}
        onToggleSelected={() => undefined}
        onOpen={(item) => setReviewId(item.id)}
        onRetry={() => undefined}
      />

      <ReviewPanel
        key={reviewItem?.id ?? 'closed'}
        item={
          reviewItem && reviewItem.status === 'unprocessed' ? reviewItem : null
        }
        locale={locale}
        pending={acceptMutation.isPending || discardMutation.isPending}
        onClose={() => setReviewId(null)}
        onAccept={async (input: {
          type: InboxType;
          title: string;
          extracted: ExtractedFields;
          ideaDisposition?: 'project' | 'note';
        }) => {
          if (!reviewId) {
            return;
          }
          await acceptMutation.mutateAsync({ itemId: reviewId, ...input });
        }}
        onDiscard={async (id) => {
          await discardMutation.mutateAsync([id]);
        }}
      />
    </div>
  );
}
