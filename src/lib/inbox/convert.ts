import { DEFAULT_CURRENCY } from '@/lib/constants';
import { createCalendarEvent } from '@/lib/db/queries/calendar';
import { createCommitment } from '@/lib/db/queries/commitments';
import {
  createContact,
  listContacts,
  updateContact,
} from '@/lib/db/queries/contacts';
import {
  listAccounts,
  listTransactionCategories,
} from '@/lib/db/queries/finance';
import { createProject, listProjects } from '@/lib/db/queries/projects';
import { createTask } from '@/lib/db/queries/tasks';
import { ingest } from '@/lib/finance/engine';
import { toMinor } from '@/lib/money';
import { entityHref } from '@/lib/inbox/payload';
import type {
  ExtractedFields,
  InboxAiPayload,
  InboxType,
} from '@/lib/inbox/types';

export type ConversionResult = {
  entityType: InboxAiPayload['convertedEntityType'];
  entityId?: string;
  href: string;
};

function parseDay(iso: string | undefined): Date | undefined {
  if (!iso) {
    return undefined;
  }
  const day = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) {
    return undefined;
  }
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
}

function parseInstant(iso: string | undefined): Date | undefined {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function matchProjectId(userId: string, hint?: string) {
  if (!hint) {
    return undefined;
  }
  const projects = await listProjects(userId);
  const needle = normalizeName(hint);
  return projects.find((project) => {
    const name = normalizeName(project.name);
    return name === needle || name.includes(needle) || needle.includes(name);
  })?.id;
}

async function matchContact(userId: string, name?: string) {
  if (!name) {
    return null;
  }
  const contacts = await listContacts(userId);
  const needle = normalizeName(name);
  return (
    contacts.find((contact) => {
      const value = normalizeName(contact.name);
      return (
        value === needle || value.includes(needle) || needle.includes(value)
      );
    }) ?? null
  );
}

async function defaultCashAccount(userId: string) {
  const accounts = await listAccounts(userId);
  return (
    accounts.find((account) => account.name === 'Cash') ??
    accounts.find((account) => account.accountType === 'cash') ??
    accounts[0] ??
    null
  );
}

async function matchCategoryId(userId: string, hint?: string) {
  const categories = await listTransactionCategories(userId);
  if (hint) {
    const needle = normalizeName(hint);
    const match = categories.find(
      (category) => normalizeName(category.name) === needle,
    );
    if (match) {
      return match.id;
    }
  }
  return categories.find((category) => category.name === 'Other')?.id;
}

export async function convertInboxItem(options: {
  userId: string;
  type: InboxType;
  title: string;
  rawText: string;
  extracted: ExtractedFields;
  ideaDisposition?: 'project' | 'note';
}): Promise<ConversionResult> {
  const { userId, type, title, rawText, extracted, ideaDisposition } = options;
  const notes = extracted.notes ?? rawText;
  const dueDate = parseDay(extracted.due_date_iso);
  const projectId = await matchProjectId(userId, extracted.project_hint);

  if (type === 'idea' && ideaDisposition === 'note') {
    return { entityType: 'note', href: entityHref('note') };
  }

  if (type === 'note') {
    return { entityType: 'note', href: entityHref('note') };
  }

  if (type === 'task' || type === 'follow_up') {
    const contact = await matchContact(userId, extracted.person_name);
    if (type === 'follow_up' && contact && dueDate) {
      await updateContact(userId, contact.id, {
        nextFollowUpAt: dueDate,
      });
    }

    const task = await createTask(userId, {
      title,
      description: notes,
      projectId,
      status: 'next',
      type: type === 'follow_up' ? 'call' : 'quick_task',
      dueDate,
      context: extracted.person_name,
    });

    return {
      entityType: type,
      entityId: task.id,
      href: entityHref(type),
    };
  }

  if (type === 'person') {
    const contact = await createContact(userId, {
      name: extracted.person_name || title,
      notes,
    });
    return {
      entityType: 'person',
      entityId: contact.id,
      href: entityHref('person'),
    };
  }

  if (type === 'commitment') {
    const contact = await matchContact(userId, extracted.person_name);
    const commitment = await createCommitment(userId, {
      direction: extracted.direction ?? 'i_promised',
      description: title,
      contactId: contact?.id,
      projectId,
      dueDate,
    });
    return {
      entityType: 'commitment',
      entityId: commitment.id,
      href: entityHref('commitment'),
    };
  }

  if (type === 'expense' || type === 'income') {
    const account = await defaultCashAccount(userId);
    if (!account) {
      throw new Error('NO_CASH_ACCOUNT');
    }
    if (extracted.amount_minor === undefined) {
      throw new Error('AMOUNT_REQUIRED');
    }
    const categoryId = await matchCategoryId(userId, extracted.category_hint);
    const occurredOn = dueDate ?? new Date();
    const summary = await ingest(userId, 'manual', {
      amountMinor: extracted.amount_minor,
      date: occurredOn.toISOString().slice(0, 10),
      merchant: extracted.merchant,
      type,
      currency: extracted.currency ?? account.currency ?? DEFAULT_CURRENCY,
      accountId: account.id,
      notes,
      categoryId: categoryId ?? undefined,
    });
    const txnId = summary.rows.find((row) => row.transactionId)?.transactionId;
    if (!txnId) {
      throw new Error('INGEST_FAILED');
    }
    return {
      entityType: type,
      entityId: txnId,
      href: entityHref(type),
    };
  }

  if (type === 'event') {
    const startsAt =
      parseInstant(extracted.event_start_iso) ?? dueDate ?? new Date();
    const endsAt =
      parseInstant(extracted.event_end_iso) ??
      new Date(startsAt.getTime() + 60 * 60 * 1000);
    const contact = await matchContact(userId, extracted.person_name);
    const event = await createCalendarEvent(userId, {
      title,
      startsAt,
      endsAt,
      notes,
      projectId,
      contactId: contact?.id,
    });
    return {
      entityType: 'event',
      entityId: event.id,
      href: entityHref('event'),
    };
  }

  if (type === 'project' || type === 'idea') {
    const project = await createProject(userId, {
      name: title,
      desiredOutcome:
        extracted.notes ?? 'Captured from inbox — outcome to be defined.',
      description: rawText,
      state: type === 'idea' ? 'someday' : 'incubator',
      stage: 'idea',
    });
    return {
      entityType: type,
      entityId: project.id,
      href: `/projects/${project.id}`,
    };
  }

  throw new Error('UNSUPPORTED_TYPE');
}

export function majorToMinorAmount(major: number, currency = DEFAULT_CURRENCY) {
  return toMinor(major, currency);
}
