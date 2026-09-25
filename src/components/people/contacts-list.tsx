'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RELATIONSHIP_CATEGORY_TONES,
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
import { Link } from '@/lib/i18n/navigation';
import type { AppLocale } from '@/lib/i18n/routing';
import {
  archiveContact,
  listContactCards,
  listPeopleLookups,
  saveContact,
  type ContactCardDto,
} from '@/lib/people/actions';
import {
  RELATIONSHIP_CATEGORIES,
  contactFormSchema,
  type ContactFormInput,
} from '@/lib/validations/people';
import { cn } from '@/lib/utils';

const CONTACTS_KEY = ['contact-cards'] as const;
const LOOKUPS_KEY = ['people-lookups'] as const;

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30';

function emptyValues(): ContactFormInput {
  return {
    name: '',
    organization: '',
    role: '',
    email: '',
    phone: '',
    category: 'personal',
    notes: '',
    tags: '',
    nextFollowUpAt: '',
  };
}

function toFormValues(contact: ContactCardDto): ContactFormInput {
  return {
    name: contact.name,
    organization: contact.organization ?? '',
    role: contact.role ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    category: contact.category,
    notes: contact.notes ?? '',
    tags: contact.tags.join(', '),
    nextFollowUpAt: contact.nextFollowUpAt ?? '',
  };
}

export function ContactsList() {
  const t = useTranslations('people');
  const locale = useLocale() as AppLocale;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [tag, setTag] = useState<string>('all');
  const [projectId, setProjectId] = useState<string>('all');
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [sort, setSort] = useState<'name' | 'last' | 'followUp'>('name');
  const [editing, setEditing] = useState<ContactCardDto | 'new' | null>(null);
  const [pending, setPending] = useState(false);

  const contactsQuery = useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: async () => {
      const result = await listContactCards();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.contacts ?? [];
    },
  });

  const lookupsQuery = useQuery({
    queryKey: LOOKUPS_KEY,
    queryFn: async () => {
      const result = await listPeopleLookups();
      return {
        projects: result.projects ?? [],
      };
    },
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const contact of contactsQuery.data ?? []) {
      for (const item of contact.tags) {
        set.add(item);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contactsQuery.data]);

  const filtered = useMemo(() => {
    const rows = [...(contactsQuery.data ?? [])];
    const q = search.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (category !== 'all' && row.category !== category) {
        return false;
      }
      if (tag !== 'all' && !row.tags.includes(tag)) {
        return false;
      }
      if (projectId !== 'all' && !row.projectIds.includes(projectId)) {
        return false;
      }
      if (needsFollowUp && !row.followUpDue) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        row.name.toLowerCase().includes(q) ||
        (row.organization?.toLowerCase().includes(q) ?? false) ||
        (row.role?.toLowerCase().includes(q) ?? false) ||
        (row.email?.toLowerCase().includes(q) ?? false)
      );
    });
    next.sort((a, b) => {
      if (sort === 'last') {
        return (b.lastInteractionAt ?? '').localeCompare(
          a.lastInteractionAt ?? '',
        );
      }
      if (sort === 'followUp') {
        if (a.followUpOverdue !== b.followUpOverdue) {
          return a.followUpOverdue ? -1 : 1;
        }
        if (a.followUpDue !== b.followUpDue) {
          return a.followUpDue ? -1 : 1;
        }
        return (a.nextFollowUpAt ?? '9999').localeCompare(
          b.nextFollowUpAt ?? '9999',
        );
      }
      return a.name.localeCompare(b.name);
    });
    return next;
  }, [
    contactsQuery.data,
    search,
    category,
    tag,
    projectId,
    needsFollowUp,
    sort,
  ]);

  const form = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: emptyValues(),
  });

  function openEditor(contact: ContactCardDto | 'new') {
    setEditing(contact);
    form.reset(contact === 'new' ? emptyValues() : toFormValues(contact));
  }

  async function onSave(values: ContactFormInput) {
    setPending(true);
    try {
      const result = await saveContact({
        id: editing && editing !== 'new' ? editing.id : undefined,
        values,
      });
      if (result.error) {
        toast.error(t('saveFailed'));
        return;
      }
      toast.success(t('saved'));
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    } finally {
      setPending(false);
    }
  }

  async function onArchive() {
    if (!editing || editing === 'new') {
      return;
    }
    setPending(true);
    try {
      const result = await archiveContact(editing.id);
      if (result.error) {
        toast.error(t('saveFailed'));
        return;
      }
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="people-search">{t('search')}</Label>
          <Input
            id="people-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <select
          className={SELECT_CLASS}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label={t('filterCategory')}
        >
          <option value="all">{t('allCategories')}</option>
          {RELATIONSHIP_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {t(`categories.${item}`)}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          aria-label={t('filterTag')}
        >
          <option value="all">{t('allTags')}</option>
          {allTags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          aria-label={t('filterProject')}
        >
          <option value="all">{t('allProjects')}</option>
          {(lookupsQuery.data?.projects ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS}
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as 'name' | 'last' | 'followUp')
          }
          aria-label={t('sort')}
        >
          <option value="name">{t('sortName')}</option>
          <option value="last">{t('sortLast')}</option>
          <option value="followUp">{t('sortFollowUp')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={needsFollowUp}
            onChange={(event) => setNeedsFollowUp(event.target.checked)}
          />
          {t('needsFollowUp')}
        </label>
        <Button type="button" onClick={() => openEditor('new')}>
          {t('createContact')}
        </Button>
      </div>

      {contactsQuery.isError ? (
        <p className="text-sm text-destructive">{t('loadFailed')}</p>
      ) : contactsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyContacts')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/people/${contact.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-medium">{contact.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[contact.role, contact.organization]
                      .filter(Boolean)
                      .join(' · ') || t('noOrg')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={t(`categories.${contact.category}`)}
                    tone={RELATIONSHIP_CATEGORY_TONES[contact.category]}
                  />
                  <span className="text-xs text-muted-foreground">
                    {contact.staleDays != null
                      ? t('daysAgo', { count: contact.staleDays })
                      : t('noContactYet')}
                  </span>
                  {contact.nextFollowUpAt ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        contact.followUpOverdue
                          ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
                          : contact.followUpDue
                            ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t('followUpOn', { date: contact.nextFollowUpAt })}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={(event) => {
                      event.preventDefault();
                      openEditor(contact);
                    }}
                  >
                    {t('edit')}
                  </Button>
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
              {editing === 'new' ? t('createContact') : t('editContact')}
            </SheetTitle>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
            onSubmit={form.handleSubmit(onSave)}
          >
            <div className="space-y-1">
              <Label htmlFor="contact-name">{t('fields.name')}</Label>
              <Input id="contact-name" {...form.register('name')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="contact-role">{t('fields.role')}</Label>
                <Input id="contact-role" {...form.register('role')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-org">{t('fields.organization')}</Label>
                <Input id="contact-org" {...form.register('organization')} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="contact-email">{t('fields.email')}</Label>
                <Input id="contact-email" type="email" {...form.register('email')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-phone">{t('fields.phone')}</Label>
                <Input id="contact-phone" {...form.register('phone')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-category">{t('fields.category')}</Label>
              <select
                id="contact-category"
                className={SELECT_CLASS}
                {...form.register('category')}
              >
                {RELATIONSHIP_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(`categories.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-follow">{t('fields.nextFollowUp')}</Label>
              <Input
                id="contact-follow"
                type="date"
                {...form.register('nextFollowUpAt')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-tags">{t('fields.tags')}</Label>
              <Input
                id="contact-tags"
                placeholder={t('tagsHint')}
                {...form.register('tags')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact-notes">{t('fields.notes')}</Label>
              <Textarea id="contact-notes" {...form.register('notes')} />
            </div>
            <SheetFooter className="px-0">
              {editing && editing !== 'new' ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => void onArchive()}
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
