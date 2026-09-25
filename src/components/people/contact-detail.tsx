'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CommitmentsBoard } from '@/components/people/commitments-board';
import { WaitingBoard } from '@/components/people/waiting-board';
import {
  RELATIONSHIP_CATEGORY_TONES,
  StatusPill,
} from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/lib/i18n/navigation';
import type { AppLocale } from '@/lib/i18n/routing';
import {
  getContactDetail,
  linkContactProject,
  listPeopleLookups,
  logContactInteraction,
  markContactedToday,
  setContactFollowUp,
  snoozeContactFollowUp,
  unlinkContactProject,
} from '@/lib/people/actions';
import {
  INTERACTION_CHANNELS,
  interactionFormSchema,
  type InteractionFormInput,
} from '@/lib/validations/people';
import { cn } from '@/lib/utils';

const DETAIL_KEY = (id: string) => ['contact-detail', id] as const;
const LOOKUPS_KEY = ['people-lookups'] as const;
const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

export function ContactDetailView({ contactId }: { contactId: string }) {
  const t = useTranslations('people');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState('stakeholder');
  const [nextFollow, setNextFollow] = useState('');

  const detailQuery = useQuery({
    queryKey: DETAIL_KEY(contactId),
    queryFn: async () => {
      const result = await getContactDetail(contactId);
      if (result.error || !result.contact) {
        throw new Error(result.error ?? 'notFound');
      }
      return result.contact;
    },
  });

  const lookupsQuery = useQuery({
    queryKey: LOOKUPS_KEY,
    queryFn: async () => {
      const result = await listPeopleLookups();
      return result.projects ?? [];
    },
  });

  const form = useForm<InteractionFormInput>({
    resolver: zodResolver(interactionFormSchema),
    defaultValues: { channel: 'call', summary: '', occurredAt: '' },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: DETAIL_KEY(contactId) });
    await queryClient.invalidateQueries({ queryKey: ['contact-cards'] });
  }

  const contact = detailQuery.data;

  async function onLog(values: InteractionFormInput) {
    setPending(true);
    try {
      const result = await logContactInteraction({
        contactId,
        values,
      });
      if (result.error) {
        toast.error(t('saveFailed'));
        return;
      }
      form.reset({ channel: 'call', summary: '', occurredAt: '' });
      toast.success(t('interactionLogged'));
      await refresh();
    } finally {
      setPending(false);
    }
  }

  if (detailQuery.isError) {
    return <p className="text-sm text-destructive">{t('notFound')}</p>;
  }
  if (!contact) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  const linkedIds = new Set(contact.projects.map((row) => row.projectId));
  const availableProjects = (lookupsQuery.data ?? []).filter(
    (row) => !linkedIds.has(row.id),
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/people"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t('back')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {contact.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[contact.role, contact.organization]
                .filter(Boolean)
                .join(' · ') || t('noOrg')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill
                label={t(`categories.${contact.category}`)}
                tone={RELATIONSHIP_CATEGORY_TONES[contact.category]}
              />
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {contact.email ? (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${contact.email}`}>{t('email')}</a>
              </Button>
            ) : null}
            {contact.phone ? (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${contact.phone}`}>{t('phone')}</a>
              </Button>
            ) : null}
          </div>
        </div>
        {contact.notes ? (
          <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm">
            {contact.notes}
          </p>
        ) : null}
      </div>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t('followUpSection')}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              contact.followUpOverdue
                ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
                : contact.followUpDue
                  ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {contact.nextFollowUpAt
              ? t('followUpOn', { date: contact.nextFollowUpAt })
              : t('noFollowUp')}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              void markContactedToday({ contactId }).then(() => {
                toast.success(t('markedContacted'));
                return refresh();
              })
            }
          >
            {t('markContacted')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              void snoozeContactFollowUp({ contactId }).then(refresh)
            }
          >
            {t('snoozeWeek')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              void setContactFollowUp({
                contactId,
                nextFollowUpAt: null,
              }).then(refresh)
            }
          >
            {t('clearFollowUp')}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="next-follow">{t('fields.nextFollowUp')}</Label>
            <Input
              id="next-follow"
              type="date"
              value={nextFollow}
              onChange={(event) => setNextFollow(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!nextFollow || pending}
            onClick={() =>
              void setContactFollowUp({
                contactId,
                nextFollowUpAt: nextFollow,
              }).then(() => {
                setNextFollow('');
                return refresh();
              })
            }
          >
            {t('setFollowUp')}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t('relatedProjects')}
        </h2>
        <ul className="space-y-1">
          {contact.projects.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t('noProjects')}</li>
          ) : (
            contact.projects.map((project) => (
              <li
                key={project.projectId}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <Link
                    href={`/projects/${project.projectId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{project.role}</p>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    void unlinkContactProject({
                      contactId,
                      projectId: project.projectId,
                    }).then(refresh)
                  }
                >
                  {t('remove')}
                </Button>
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1 space-y-1">
            <Label htmlFor="link-project">{t('fields.project')}</Label>
            <select
              id="link-project"
              className={SELECT_CLASS}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">{t('none')}</option>
              {availableProjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-role">{t('fields.projectRole')}</Label>
            <Input
              id="link-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!projectId || pending}
            onClick={() =>
              void linkContactProject({
                contactId,
                projectId,
                role,
              }).then(() => {
                setProjectId('');
                return refresh();
              })
            }
          >
            {t('linkProject')}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t('interactions')}
        </h2>
        <form
          className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[8rem_1fr_auto]"
          onSubmit={form.handleSubmit(onLog)}
        >
          <select className={SELECT_CLASS} {...form.register('channel')}>
            {INTERACTION_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {t(`channels.${channel}`)}
              </option>
            ))}
          </select>
          <Input
            placeholder={t('interactionPlaceholder')}
            {...form.register('summary')}
          />
          <Button type="submit" disabled={pending}>
            {t('logInteraction')}
          </Button>
        </form>
        <ol className="space-y-2">
          {contact.interactions.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              {t('noInteractions')}
            </li>
          ) : (
            contact.interactions.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <p className="font-medium">{item.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.occurredAt).toLocaleString(
                    locale === 'ar' ? 'ar-SA' : 'en-GB',
                  )}
                  {item.channel
                    ? ` · ${t(`channels.${item.channel}` as 'channels.call')}`
                    : ''}
                </p>
              </li>
            ))
          )}
        </ol>
      </section>

      <CommitmentsBoard defaultContactId={contactId} />
      <WaitingBoard defaultContactId={contactId} />
    </div>
  );
}
