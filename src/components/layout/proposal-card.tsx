'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  acceptChiefProposal,
  dismissChiefProposal,
} from '@/lib/chief-of-staff/actions';
import type { CosProposal } from '@/lib/chief-of-staff/types';
import { cn } from '@/lib/utils';

export function ProposalCard({
  proposal,
  onResolved,
}: {
  proposal: CosProposal;
  onResolved?: (id: string, status: 'accepted' | 'dismissed') => void;
}) {
  const t = useTranslations('askAi');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<'accepted' | 'dismissed' | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  async function accept(confirmOverLimit = false) {
    if (!proposal.id || pending) return;
    setPending(true);
    try {
      const result = await acceptChiefProposal(proposal, { confirmOverLimit });
      if (result.needsConfirm) {
        const ok = window.confirm(
          t('overLimitConfirm', {
            count: result.activeCount ?? 0,
            limit: result.activeLimit ?? 0,
          }),
        );
        if (ok) {
          await accept(true);
        }
        return;
      }
      if (result.error) {
        toast.error(t(`errors.${result.error}` as 'errors.failed'));
        return;
      }
      if (result.handoff) {
        setDraft(result.handoff.draft ?? result.handoff.message ?? null);
        toast.message(result.handoff.message ?? t('handoffReady'));
      } else {
        toast.success(t('accepted'));
      }
      setDone('accepted');
      onResolved?.(proposal.id, 'accepted');
    } finally {
      setPending(false);
    }
  }

  async function dismiss() {
    if (!proposal.id || pending) return;
    setPending(true);
    try {
      const result = await dismissChiefProposal(proposal.id);
      if (result.error) {
        toast.error(t('errors.failed'));
        return;
      }
      setDone('dismissed');
      onResolved?.(proposal.id, 'dismissed');
      toast.message(t('dismissed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm',
        done === 'dismissed' && 'opacity-50',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{proposal.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('confidence', { value: Math.round(proposal.confidence * 100) })}
            {proposal.handoffOnly ? ` · ${t('handoffOnly')}` : ''}
          </p>
        </div>
        <span className="rounded-md bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {t(`kinds.${proposal.kind}` as 'kinds.top3')}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground">{proposal.rationale}</p>
      {draft ? (
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-background p-2 text-xs">
          {draft}
        </pre>
      ) : null}
      {!done ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void accept()}
          >
            {t('accept')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void dismiss()}
          >
            {t('dismiss')}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {done === 'accepted' ? t('accepted') : t('dismissed')}
        </p>
      )}
    </div>
  );
}
