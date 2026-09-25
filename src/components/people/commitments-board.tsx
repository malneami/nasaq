'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COMMITMENT_STATUS_TONES,
  StatusPill,
} from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { AppLocale } from '@/lib/i18n/routing';
import {
  archiveCommitment,
  listCommitmentCards,
  listPeopleLookups,
  saveCommitment,
  setCommitmentStatus,
  type CommitmentCardDto,
} from '@/lib/people/actions';
import {
  COMMITMENT_DIRECTIONS,
  commitmentFormSchema,
  type CommitmentFormInput,
} from '@/lib/validations/people';
import { cn } from '@/lib/utils';

const COMMITMENTS_KEY = ['commitment-cards'] as const;
const LOOKUPS_KEY = ['people-lookups'] as const;
const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

function emptyValues(
  defaults?: Partial<CommitmentFormInput>,
): CommitmentFormInput {
  return {
    description: '',
    direction: 'i_promised',
    contactId: '',
    projectId: '',
    dueDate: '',
    followUpAt: '',
    status: 'open',
    ...defaults,
  };
}

function toFormValues(row: CommitmentCardDto): CommitmentFormInput {
  return {
    description: row.description,
    direction: row.direction,
    contactId: row.contactId ?? '',
    projectId: row.projectId ?? '',
    dueDate: row.dueDate ?? '',
    followUpAt: row.followUpAt ?? '',
    status: row.status,
  };
}

function CommitmentColumn({
  title,
  hint,
  rows,
  onEdit,
  onFulfilled,
  onCancel,
}: {
  title: string;
  hint: string;
  rows: CommitmentCardDto[];
  onEdit: (row: CommitmentCardDto) => void;
  onFulfilled: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslations('people');
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyCommitments')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                'rounded-xl border border-border px-3 py-3',
                row.overdue && 'border-rose-500/40 bg-rose-500/5',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{row.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[row.personName, row.projectName]
                      .filter(Boolean)
                      .join(' · ') || t('standalone')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.dueDate
                      ? row.daysUntil != null && row.daysUntil < 0
                        ? t('daysOverdue', { count: Math.abs(row.daysUntil) })
                        : t('dueOn', { date: row.dueDate })
                      : t('noDueDate')}
                  </p>
                </div>
                <StatusPill
                  label={t(`commitmentStatuses.${row.displayStatus}`)}
                  tone={COMMITMENT_STATUS_TONES[row.displayStatus]}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => onFulfilled(row.id)}
                >
                  {t('markFulfilled')}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => onEdit(row)}
                >
                  {t('edit')}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => onCancel(row.id)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CommitmentsBoard({
  defaultContactId,
  defaultDirection,
}: {
  defaultContactId?: string;
  defaultDirection?: 'i_promised' | 'they_promised';
}) {
  const t = useTranslations('people');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CommitmentCardDto | 'new' | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const commitmentsQuery = useQuery({
    queryKey: COMMITMENTS_KEY,
    queryFn: async () => {
      const result = await listCommitmentCards();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.commitments ?? [];
    },
  });

  const lookupsQuery = useQuery({
    queryKey: LOOKUPS_KEY,
    queryFn: async () => {
      const result = await listPeopleLookups();
      return {
        contacts: result.contacts ?? [],
        projects: result.projects ?? [],
      };
    },
  });

  const form = useForm<CommitmentFormInput>({
    resolver: zodResolver(commitmentFormSchema),
    defaultValues: emptyValues({
      contactId: defaultContactId ?? '',
      direction: defaultDirection ?? 'i_promised',
    }),
  });

  const visible = useMemo(() => {
    const rows = (commitmentsQuery.data ?? []).filter((row) => {
      if (row.status === 'cancelled' || row.status === 'fulfilled') {
        return false;
      }
      if (defaultContactId && row.contactId !== defaultContactId) {
        return false;
      }
      return true;
    });
    return {
      iPromised: rows.filter((row) => row.direction === 'i_promised'),
      theyPromised: rows.filter((row) => row.direction === 'they_promised'),
    };
  }, [commitmentsQuery.data, defaultContactId]);

  function openEditor(row: CommitmentCardDto | 'new') {
    setEditing(row);
    form.reset(
      row === 'new'
        ? emptyValues({
            contactId: defaultContactId ?? '',
            direction: defaultDirection ?? 'i_promised',
          })
        : toFormValues(row),
    );
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: COMMITMENTS_KEY });
  }

  async function onSave(values: CommitmentFormInput) {
    setPending(true);
    try {
      const result = await saveCommitment({
        id: editing && editing !== 'new' ? editing.id : undefined,
        values,
      });
      if (result.error) {
        toast.error(t('saveFailed'));
        return;
      }
      toast.success(t('saved'));
      setEditing(null);
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('commitmentsTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('commitmentsHint')}
          </p>
        </div>
        <Button type="button" onClick={() => openEditor('new')}>
          {t('createCommitment')}
        </Button>
      </div>

      {commitmentsQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : commitmentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CommitmentColumn
            title={t('iPromised')}
            hint={t('iPromisedHint')}
            rows={visible.iPromised}
            onEdit={openEditor}
            onFulfilled={(id) =>
              void setCommitmentStatus({ id, status: 'fulfilled' }).then(
                refresh,
              )
            }
            onCancel={(id) =>
              void setCommitmentStatus({ id, status: 'cancelled' }).then(
                refresh,
              )
            }
          />
          <CommitmentColumn
            title={t('theyPromised')}
            hint={t('theyPromisedHint')}
            rows={visible.theyPromised}
            onEdit={openEditor}
            onFulfilled={(id) =>
              void setCommitmentStatus({ id, status: 'fulfilled' }).then(
                refresh,
              )
            }
            onCancel={(id) =>
              void setCommitmentStatus({ id, status: 'cancelled' }).then(
                refresh,
              )
            }
          />
        </div>
      )}

      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <SheetContent
          side={locale === 'ar' ? 'left' : 'right'}
          closeLabel={t('close')}
          className="w-full sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle>
              {editing === 'new'
                ? t('createCommitment')
                : t('editCommitment')}
            </SheetTitle>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
            onSubmit={form.handleSubmit(onSave)}
          >
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t('notATask')}
            </p>
            <div className="space-y-1">
              <Label htmlFor="commit-desc">{t('fields.description')}</Label>
              <Textarea id="commit-desc" {...form.register('description')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="commit-direction">{t('fields.direction')}</Label>
              <select
                id="commit-direction"
                className={SELECT_CLASS}
                {...form.register('direction')}
              >
                {COMMITMENT_DIRECTIONS.map((item) => (
                  <option key={item} value={item}>
                    {t(`directions.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="commit-person">{t('fields.person')}</Label>
              <select
                id="commit-person"
                className={SELECT_CLASS}
                {...form.register('contactId')}
              >
                <option value="">{t('none')}</option>
                {(lookupsQuery.data?.contacts ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="commit-project">{t('fields.project')}</Label>
              <select
                id="commit-project"
                className={SELECT_CLASS}
                {...form.register('projectId')}
              >
                <option value="">{t('none')}</option>
                {(lookupsQuery.data?.projects ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="commit-due">{t('fields.dueDate')}</Label>
                <Input
                  id="commit-due"
                  type="date"
                  {...form.register('dueDate')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="commit-follow">{t('fields.followUp')}</Label>
                <Input
                  id="commit-follow"
                  type="date"
                  {...form.register('followUpAt')}
                />
              </div>
            </div>
            <SheetFooter className="px-0">
              {editing && editing !== 'new' ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    void archiveCommitment(editing.id).then(() => {
                      setEditing(null);
                      return refresh();
                    })
                  }
                >
                  {t('archive')}
                </Button>
              ) : null}
              <Button type="submit" disabled={pending}>
                {t('save')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
