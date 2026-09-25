'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusPill, WAITING_STATUS_TONES } from '@/components/status-pill';
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
import type { AppLocale } from '@/lib/i18n/routing';
import {
  archiveWaitingItem,
  bumpWaitingFollowUp,
  listPeopleLookups,
  listWaitingCards,
  saveWaitingItem,
  setWaitingStatus,
  type WaitingCardDto,
} from '@/lib/people/actions';
import {
  waitingFormSchema,
  type WaitingFormInput,
} from '@/lib/validations/people';

const WAITING_KEY = ['waiting-cards'] as const;
const LOOKUPS_KEY = ['people-lookups'] as const;
const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

function emptyValues(defaults?: Partial<WaitingFormInput>): WaitingFormInput {
  return {
    item: '',
    contactId: '',
    org: '',
    projectId: '',
    expectedAt: '',
    followUpAt: '',
    status: 'waiting',
    ...defaults,
  };
}

function toFormValues(row: WaitingCardDto): WaitingFormInput {
  return {
    item: row.item,
    contactId: row.contactId ?? '',
    org: row.org ?? '',
    projectId: row.projectId ?? '',
    expectedAt: row.expectedAt ?? '',
    followUpAt: row.followUpAt ?? '',
    status: row.status,
  };
}

export function WaitingBoard({
  defaultContactId,
}: {
  defaultContactId?: string;
}) {
  const t = useTranslations('people');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<WaitingCardDto | 'new' | null>(null);
  const [pending, setPending] = useState(false);

  const waitingQuery = useQuery({
    queryKey: WAITING_KEY,
    queryFn: async () => {
      const result = await listWaitingCards();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.waiting ?? [];
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

  const form = useForm<WaitingFormInput>({
    resolver: zodResolver(waitingFormSchema),
    defaultValues: emptyValues({ contactId: defaultContactId ?? '' }),
  });

  function openEditor(row: WaitingCardDto | 'new') {
    setEditing(row);
    form.reset(
      row === 'new'
        ? emptyValues({ contactId: defaultContactId ?? '' })
        : toFormValues(row),
    );
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: WAITING_KEY });
  }

  async function onSave(values: WaitingFormInput) {
    setPending(true);
    try {
      const result = await saveWaitingItem({
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

  const rows = (waitingQuery.data ?? []).filter((row) =>
    defaultContactId ? row.contactId === defaultContactId : true,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('waitingTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('waitingHint')}</p>
        </div>
        <Button type="button" onClick={() => openEditor('new')}>
          {t('createWaiting')}
        </Button>
      </div>

      {waitingQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : waitingQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyWaiting')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/40 text-start text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('waitingCols.item')}</th>
                <th className="px-3 py-2 font-medium">{t('waitingCols.who')}</th>
                <th className="px-3 py-2 font-medium">{t('waitingCols.project')}</th>
                <th className="px-3 py-2 font-medium">{t('waitingCols.days')}</th>
                <th className="px-3 py-2 font-medium">{t('waitingCols.due')}</th>
                <th className="px-3 py-2 font-medium">{t('waitingCols.status')}</th>
                <th className="px-3 py-2 font-medium">{t('waitingCols.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-2 font-medium">{row.item}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.personName ?? row.org ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.projectName ?? '—'}
                  </td>
                  <td className="px-3 py-2">{row.daysWaiting}</td>
                  <td className="px-3 py-2">
                    {row.expectedAt ?? row.followUpAt ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill
                      label={t(`waitingStatuses.${row.displayStatus}`)}
                      tone={WAITING_STATUS_TONES[row.displayStatus]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          void setWaitingStatus({
                            id: row.id,
                            status: 'received',
                            logInteraction: true,
                          }).then(refresh)
                        }
                      >
                        {t('markReceived')}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          void bumpWaitingFollowUp({ id: row.id }).then(refresh)
                        }
                      >
                        {t('bumpFollowUp')}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => openEditor(row)}
                      >
                        {t('edit')}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          void setWaitingStatus({
                            id: row.id,
                            status: 'cancelled',
                          }).then(refresh)
                        }
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {editing === 'new' ? t('createWaiting') : t('editWaiting')}
            </SheetTitle>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
            onSubmit={form.handleSubmit(onSave)}
          >
            <div className="space-y-1">
              <Label htmlFor="waiting-item">{t('fields.waitingItem')}</Label>
              <Input id="waiting-item" {...form.register('item')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="waiting-contact">{t('fields.person')}</Label>
              <select
                id="waiting-contact"
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
              <Label htmlFor="waiting-org">{t('fields.org')}</Label>
              <Input id="waiting-org" {...form.register('org')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="waiting-project">{t('fields.project')}</Label>
              <select
                id="waiting-project"
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
                <Label htmlFor="waiting-expected">{t('fields.expected')}</Label>
                <Input
                  id="waiting-expected"
                  type="date"
                  {...form.register('expectedAt')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="waiting-follow">{t('fields.followUp')}</Label>
                <Input
                  id="waiting-follow"
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
                    void archiveWaitingItem(editing.id).then(() => {
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
