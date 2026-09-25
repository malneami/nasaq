'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ProposalCard } from '@/components/layout/proposal-card';
import { askDecisionEngine } from '@/lib/chief-of-staff/actions';
import type { CosProposal } from '@/lib/chief-of-staff/types';
import { DEFAULT_CURRENCY } from '@/lib/constants';
import { toMajor, toMinor } from '@/lib/money';
import type { AppLocale } from '@/lib/i18n/routing';
import {
  INBOX_TYPES,
  type ExtractedFields,
  type InboxItemDto,
  type InboxType,
} from '@/lib/inbox/types';

function selectClassName() {
  return 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';
}

export function ReviewPanel({
  item,
  locale,
  onClose,
  onAccept,
  onDiscard,
  pending,
}: {
  item: InboxItemDto | null;
  locale: AppLocale;
  onClose: () => void;
  onAccept: (input: {
    type: InboxType;
    title: string;
    extracted: ExtractedFields;
    ideaDisposition?: 'project' | 'note';
  }) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
  pending: boolean;
}) {
  const t = useTranslations('inbox');
  const payload = item?.payload;
  const [type, setType] = useState<InboxType | ''>(item?.aiType ?? '');
  const [title, setTitle] = useState(payload?.title ?? item?.rawText ?? '');
  const [ideaDisposition, setIdeaDisposition] = useState<'project' | 'note'>(
    payload?.ideaDisposition ?? 'project',
  );
  const [extracted, setExtracted] = useState<ExtractedFields>(
    payload?.extracted ?? {},
  );
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionReply, setDecisionReply] = useState<string | null>(null);
  const [decisionProposals, setDecisionProposals] = useState<CosProposal[]>(
    [],
  );

  const amountMajor = useMemo(() => {
    if (extracted.amount_minor === undefined) {
      return '';
    }
    return String(
      toMajor(extracted.amount_minor, extracted.currency ?? DEFAULT_CURRENCY),
    );
  }, [extracted.amount_minor, extracted.currency]);

  function patch(update: Partial<ExtractedFields>) {
    setExtracted((current) => ({ ...current, ...update }));
  }

  const needsType = payload?.needs_confirmation && !type;
  const failed = payload?.classificationStatus === 'failed';

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={t('close')}
        className="w-full sm:max-w-md"
      >
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>{t('reviewTitle')}</SheetTitle>
              <SheetDescription>{item.rawText}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
              {payload?.clarifying_question ? (
                <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
                  {payload.clarifying_question}
                </p>
              ) : null}
              {item.aiConfidence !== null ? (
                <p className="text-xs text-muted-foreground">
                  {t('confidence', {
                    value: Math.round(item.aiConfidence * 100),
                  })}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="review-type">{t('suggestedType')}</Label>
                <select
                  id="review-type"
                  className={selectClassName()}
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as InboxType | '')
                  }
                >
                  <option value="">{t('chooseType')}</option>
                  {INBOX_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`types.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-title">{t('titleField')}</Label>
                <Input
                  id="review-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              {type === 'idea' ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      ideaDisposition === 'project' ? 'default' : 'outline'
                    }
                    onClick={() => setIdeaDisposition('project')}
                  >
                    {t('ideaAsProject')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={ideaDisposition === 'note' ? 'default' : 'outline'}
                    onClick={() => setIdeaDisposition('note')}
                  >
                    {t('ideaAsNote')}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="person-name">{t('personName')}</Label>
                <Input
                  id="person-name"
                  value={extracted.person_name ?? ''}
                  onChange={(event) =>
                    patch({ person_name: event.target.value || undefined })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-hint">{t('projectHint')}</Label>
                <Input
                  id="project-hint"
                  value={extracted.project_hint ?? ''}
                  onChange={(event) =>
                    patch({ project_hint: event.target.value || undefined })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due-date">{t('dueDate')}</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={extracted.due_date_iso?.slice(0, 10) ?? ''}
                  onChange={(event) =>
                    patch({ due_date_iso: event.target.value || undefined })
                  }
                />
              </div>
              {(type === 'expense' || type === 'income') && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">{t('amount')}</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountMajor}
                      onChange={(event) => {
                        const major = Number(event.target.value);
                        patch({
                          amount_minor: Number.isFinite(major)
                            ? toMinor(
                                major,
                                extracted.currency ?? DEFAULT_CURRENCY,
                              )
                            : undefined,
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="merchant">{t('merchant')}</Label>
                    <Input
                      id="merchant"
                      value={extracted.merchant ?? ''}
                      onChange={(event) =>
                        patch({ merchant: event.target.value || undefined })
                      }
                    />
                  </div>
                </>
              )}
              {type === 'commitment' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="direction">{t('direction')}</Label>
                  <select
                    id="direction"
                    className={selectClassName()}
                    value={extracted.direction ?? 'i_promised'}
                    onChange={(event) =>
                      patch({
                        direction: event.target
                          .value as ExtractedFields['direction'],
                      })
                    }
                  >
                    <option value="i_promised">{t('iPromised')}</option>
                    <option value="they_promised">{t('theyPromised')}</option>
                  </select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="notes">{t('notes')}</Label>
                <Textarea
                  id="notes"
                  className="min-h-20"
                  value={extracted.notes ?? ''}
                  onChange={(event) =>
                    patch({ notes: event.target.value || undefined })
                  }
                />
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {t('decisionEngineHint')}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pending || decisionPending}
                  onClick={() => {
                    void (async () => {
                      setDecisionPending(true);
                      try {
                        const result = await askDecisionEngine({
                          demand: title || item.rawText,
                          note: extracted.notes,
                        });
                        if (result.error) {
                          toast.error(t('failed'));
                          return;
                        }
                        setDecisionReply(result.reply ?? null);
                        setDecisionProposals(result.proposals ?? []);
                      } finally {
                        setDecisionPending(false);
                      }
                    })();
                  }}
                >
                  {decisionPending
                    ? t('decisionEngineRunning')
                    : t('decisionEngine')}
                </Button>
                {decisionReply ? (
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    {decisionReply}
                  </p>
                ) : null}
                {decisionProposals.length ? (
                  <div className="mt-2 space-y-2">
                    {decisionProposals.map((p) => (
                      <ProposalCard key={p.id ?? p.title} proposal={p} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void onDiscard(item.id)}
              >
                {t('discard')}
              </Button>
              <Button
                type="button"
                disabled={pending || failed || Boolean(needsType)}
                onClick={() => {
                  if (!type) {
                    return;
                  }
                  void onAccept({
                    type,
                    title,
                    extracted,
                    ideaDisposition:
                      type === 'idea' ? ideaDisposition : undefined,
                  });
                }}
              >
                {t('accept')}
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
