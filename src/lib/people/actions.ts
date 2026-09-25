'use server';

import { requireUserId } from '@/lib/auth/session';
import {
  createCommitment,
  createWaitingItem,
  deleteCommitment,
  deleteWaitingItem,
  getCommitment,
  getWaitingItem,
  listCommitments,
  listCommitmentsForContact,
  listWaitingForContact,
  listWaitingItems,
  updateCommitment,
  updateWaitingItem,
} from '@/lib/db/queries/commitments';
import {
  createContact,
  deleteContact,
  getContact,
  listContacts,
  listInteractions,
  logInteraction,
  updateContact,
} from '@/lib/db/queries/contacts';
import { createAuditLog } from '@/lib/db/queries/system';
import {
  addProjectContact,
  listAllProjectContactLinks,
  listContactProjects,
  listProjects,
  removeProjectContact,
} from '@/lib/db/queries/projects';
import type {
  CommitmentDirection,
  CommitmentStatus,
  RelationshipCategory,
  WaitingStatus,
} from '@/lib/db/schema';
import {
  addDaysYmd,
  daysUntil,
  daysWaiting,
  isCommitmentOverdue,
  isFollowUpDue,
  isWaitingOverdue,
  toYmd,
} from '@/lib/people/overdue';
import { ymdInTimeZone } from '@/lib/time/zoned';
import { DEFAULT_TIMEZONE } from '@/lib/constants';
import { getProfile } from '@/lib/db/queries/profiles';
import {
  commitmentFormSchema,
  contactFormSchema,
  interactionFormSchema,
  projectContactSchema,
  waitingFormSchema,
  type CommitmentFormInput,
  type ContactFormInput,
  type InteractionFormInput,
  type WaitingFormInput,
} from '@/lib/validations/people';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function parseDate(value: string | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  return new Date(`${day}T00:00:00.000Z`);
}

function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return [
    ...new Set(
      raw
        .split(/[,،]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
}

async function writeAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown>,
) {
  await createAuditLog(userId, {
    actor: 'user',
    action,
    entityType,
    entityId,
    after,
  });
}

async function userToday(userId: string): Promise<string> {
  const profile = await getProfile(userId);
  return ymdInTimeZone(new Date(), profile?.timezone || DEFAULT_TIMEZONE);
}

export type ContactCardDto = {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  category: RelationshipCategory;
  lastInteractionAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  tags: string[];
  projectIds: string[];
  followUpDue: boolean;
  followUpOverdue: boolean;
  staleDays: number | null;
};

export type InteractionDto = {
  id: string;
  occurredAt: string;
  channel: string | null;
  summary: string | null;
};

export type CommitmentCardDto = {
  id: string;
  description: string;
  direction: CommitmentDirection;
  contactId: string | null;
  personName: string | null;
  projectId: string | null;
  projectName: string | null;
  createdDate: string | null;
  dueDate: string | null;
  followUpAt: string | null;
  status: CommitmentStatus;
  displayStatus: CommitmentStatus;
  overdue: boolean;
  daysUntil: number | null;
};

export type WaitingCardDto = {
  id: string;
  item: string;
  contactId: string | null;
  personName: string | null;
  org: string | null;
  projectId: string | null;
  projectName: string | null;
  requestedAt: string | null;
  expectedAt: string | null;
  followUpAt: string | null;
  status: WaitingStatus;
  displayStatus: WaitingStatus;
  overdue: boolean;
  daysWaiting: number;
};

export type ContactDetailDto = ContactCardDto & {
  projects: { projectId: string; name: string; role: string; state: string }[];
  interactions: InteractionDto[];
  commitments: CommitmentCardDto[];
  waitingItems: WaitingCardDto[];
};

function emptyOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listContactCards(): Promise<{
  contacts?: ContactCardDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const today = await userToday(userId);
    const [rows, links] = await Promise.all([
      listContacts(userId),
      listAllProjectContactLinks(userId),
    ]);
    const projectIdsByContact = new Map<string, string[]>();
    for (const link of links) {
      const current = projectIdsByContact.get(link.contactId) ?? [];
      current.push(link.projectId);
      projectIdsByContact.set(link.contactId, current);
    }
    return {
      contacts: rows.map((row) => {
        const due = toYmd(row.nextFollowUpAt);
        const last = toYmd(row.lastInteractionAt);
        const followUpDue = isFollowUpDue({
          nextFollowUpAt: row.nextFollowUpAt,
          todayYmd: today,
        });
        return {
          id: row.id,
          name: row.name,
          organization: row.organization,
          role: row.role,
          email: row.email,
          phone: row.phone,
          category: row.category,
          lastInteractionAt: row.lastInteractionAt?.toISOString() ?? null,
          nextFollowUpAt: due,
          notes: row.notes,
          tags: row.tags ?? [],
          projectIds: projectIdsByContact.get(row.id) ?? [],
          followUpDue,
          followUpOverdue: Boolean(due && due < today),
          staleDays: last ? daysWaiting(last, today) : null,
        };
      }),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function getContactDetail(contactId: string): Promise<{
  contact?: ContactDetailDto;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const today = await userToday(userId);
    const row = await getContact(userId, contactId);
    if (!row) {
      return { error: 'notFound' };
    }
    const [projects, interactions, commitments, waiting, allProjects] =
      await Promise.all([
        listContactProjects(userId, contactId),
        listInteractions(userId, contactId),
        listCommitmentsForContact(userId, contactId),
        listWaitingForContact(userId, contactId),
        listProjects(userId),
      ]);
    const projectName = new Map(allProjects.map((p) => [p.id, p.name]));
    const due = toYmd(row.nextFollowUpAt);
    const last = toYmd(row.lastInteractionAt);
    const followUpDue = isFollowUpDue({
      nextFollowUpAt: row.nextFollowUpAt,
      todayYmd: today,
    });

    const mapCommitment = (
      item: Awaited<ReturnType<typeof listCommitments>>[number],
    ): CommitmentCardDto => {
      const overdue = isCommitmentOverdue({
        status: item.status,
        dueDate: item.dueDate,
        todayYmd: today,
      });
      const dueDate = toYmd(item.dueDate);
      return {
        id: item.id,
        description: item.description,
        direction: item.direction,
        contactId: item.contactId,
        personName: row.name,
        projectId: item.projectId,
        projectName: item.projectId
          ? (projectName.get(item.projectId) ?? null)
          : null,
        createdDate: toYmd(item.createdDate),
        dueDate,
        followUpAt: toYmd(item.followUpAt),
        status: item.status,
        displayStatus:
          overdue && item.status === 'open' ? 'overdue' : item.status,
        overdue,
        daysUntil: daysUntil(dueDate, today),
      };
    };

    const mapWaiting = (
      item: Awaited<ReturnType<typeof listWaitingItems>>[number],
    ): WaitingCardDto => {
      const overdue = isWaitingOverdue({
        status: item.status,
        expectedAt: item.expectedAt,
        followUpAt: item.followUpAt,
        todayYmd: today,
      });
      return {
        id: item.id,
        item: item.item,
        contactId: item.contactId,
        personName: row.name,
        org: item.org,
        projectId: item.projectId,
        projectName: item.projectId
          ? (projectName.get(item.projectId) ?? null)
          : null,
        requestedAt: toYmd(item.requestedAt),
        expectedAt: toYmd(item.expectedAt),
        followUpAt: toYmd(item.followUpAt),
        status: item.status,
        displayStatus:
          overdue && item.status === 'waiting' ? 'overdue' : item.status,
        overdue,
        daysWaiting: daysWaiting(item.requestedAt, today),
      };
    };

    return {
      contact: {
        id: row.id,
        name: row.name,
        organization: row.organization,
        role: row.role,
        email: row.email,
        phone: row.phone,
        category: row.category,
        lastInteractionAt: row.lastInteractionAt?.toISOString() ?? null,
        nextFollowUpAt: due,
        notes: row.notes,
        tags: row.tags ?? [],
        projectIds: projects.map((p) => p.projectId),
        followUpDue,
        followUpOverdue: Boolean(due && due < today),
        staleDays: last ? daysWaiting(last, today) : null,
        projects: projects.map((p) => ({
          projectId: p.projectId,
          name: p.projectName,
          role: p.role,
          state: p.projectState,
        })),
        interactions: interactions.map((item) => ({
          id: item.id,
          occurredAt: item.occurredAt.toISOString(),
          channel: item.channel,
          summary: item.summary,
        })),
        commitments: commitments.map(mapCommitment),
        waitingItems: waiting.map(mapWaiting),
      },
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveContact(input: {
  id?: string;
  values: ContactFormInput;
}): Promise<{ contactId?: string; error?: string }> {
  const parsed = contactFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const values = parsed.data;
    const fields = {
      name: values.name,
      organization: emptyOptional(values.organization),
      role: emptyOptional(values.role),
      email: emptyOptional(values.email),
      phone: emptyOptional(values.phone),
      category: values.category,
      notes: emptyOptional(values.notes),
      tags: parseTags(values.tags),
      nextFollowUpAt: parseDate(values.nextFollowUpAt),
      updatedAt: new Date(),
    };
    if (input.id) {
      const existing = await getContact(userId, input.id);
      if (!existing) {
        return { error: 'notFound' };
      }
      await updateContact(userId, input.id, fields);
      await writeAudit(userId, 'update', 'contact', input.id, {
        name: fields.name,
        category: fields.category,
      });
      return { contactId: input.id };
    }
    const created = await createContact(userId, fields);
    await writeAudit(userId, 'create', 'contact', created.id, {
      name: fields.name,
    });
    return { contactId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveContact(
  contactId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getContact(userId, contactId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteContact(userId, contactId);
    await writeAudit(userId, 'delete', 'contact', contactId, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function logContactInteraction(input: {
  contactId: string;
  values: InteractionFormInput;
  clearFollowUp?: boolean;
  nextFollowUpAt?: string;
}): Promise<{ error?: string }> {
  const parsed = interactionFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getContact(userId, input.contactId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const occurredAt = parseDate(parsed.data.occurredAt) ?? new Date();
    const interaction = await logInteraction(userId, {
      contactId: input.contactId,
      channel: parsed.data.channel ?? null,
      summary: parsed.data.summary,
      occurredAt,
    });
    const patch: {
      nextFollowUpAt?: Date | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (input.clearFollowUp) {
      patch.nextFollowUpAt = null;
    } else if (input.nextFollowUpAt !== undefined) {
      patch.nextFollowUpAt = parseDate(input.nextFollowUpAt);
    }
    if (input.clearFollowUp || input.nextFollowUpAt !== undefined) {
      await updateContact(userId, input.contactId, patch);
    }
    await writeAudit(userId, 'create', 'interaction', interaction.id, {
      contactId: input.contactId,
      summary: parsed.data.summary,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function setContactFollowUp(input: {
  contactId: string;
  nextFollowUpAt: string | null;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getContact(userId, input.contactId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateContact(userId, input.contactId, {
      nextFollowUpAt: input.nextFollowUpAt
        ? parseDate(input.nextFollowUpAt)
        : null,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'update', 'contact', input.contactId, {
      nextFollowUpAt: input.nextFollowUpAt,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function snoozeContactFollowUp(input: {
  contactId: string;
  days?: number;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const today = await userToday(userId);
    const next = addDaysYmd(today, input.days ?? 7);
    return setContactFollowUp({
      contactId: input.contactId,
      nextFollowUpAt: next,
    });
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function markContactedToday(input: {
  contactId: string;
  summary?: string;
  nextFollowUpAt?: string | null;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const today = await userToday(userId);
    const reschedule = Boolean(input.nextFollowUpAt);
    return logContactInteraction({
      contactId: input.contactId,
      values: {
        channel: 'other',
        summary: input.summary?.trim() || 'Contacted today',
        occurredAt: today,
      },
      clearFollowUp: !reschedule,
      nextFollowUpAt: reschedule ? input.nextFollowUpAt! : undefined,
    });
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function linkContactProject(input: {
  contactId: string;
  projectId: string;
  role?: string;
}): Promise<{ error?: string }> {
  const parsed = projectContactSchema.safeParse({
    projectId: input.projectId,
    role: input.role ?? 'stakeholder',
  });
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const [contact, project] = await Promise.all([
      getContact(userId, input.contactId),
      listProjects(userId).then((rows) =>
        rows.find((row) => row.id === input.projectId),
      ),
    ]);
    if (!contact || !project) {
      return { error: 'notFound' };
    }
    await addProjectContact(userId, {
      projectId: parsed.data.projectId,
      contactId: input.contactId,
      role: parsed.data.role,
    });
    await writeAudit(userId, 'link', 'project_contact', input.contactId, {
      projectId: parsed.data.projectId,
      role: parsed.data.role,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function unlinkContactProject(input: {
  contactId: string;
  projectId: string;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await removeProjectContact(userId, input.projectId, input.contactId);
    await writeAudit(userId, 'unlink', 'project_contact', input.contactId, {
      projectId: input.projectId,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listCommitmentCards(): Promise<{
  commitments?: CommitmentCardDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const today = await userToday(userId);
    const [rows, contacts, projects] = await Promise.all([
      listCommitments(userId),
      listContacts(userId),
      listProjects(userId),
    ]);
    const contactName = new Map(contacts.map((row) => [row.id, row.name]));
    const projectName = new Map(projects.map((row) => [row.id, row.name]));
    return {
      commitments: rows.map((item) => {
        const overdue = isCommitmentOverdue({
          status: item.status,
          dueDate: item.dueDate,
          todayYmd: today,
        });
        const dueDate = toYmd(item.dueDate);
        return {
          id: item.id,
          description: item.description,
          direction: item.direction,
          contactId: item.contactId,
          personName: item.contactId
            ? (contactName.get(item.contactId) ?? null)
            : null,
          projectId: item.projectId,
          projectName: item.projectId
            ? (projectName.get(item.projectId) ?? null)
            : null,
          createdDate: toYmd(item.createdDate),
          dueDate,
          followUpAt: toYmd(item.followUpAt),
          status: item.status,
          displayStatus:
            overdue && item.status === 'open' ? 'overdue' : item.status,
          overdue,
          daysUntil: daysUntil(dueDate, today),
        };
      }),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveCommitment(input: {
  id?: string;
  values: CommitmentFormInput;
}): Promise<{ commitmentId?: string; error?: string }> {
  const parsed = commitmentFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const values = parsed.data;
    const fields = {
      description: values.description,
      direction: values.direction,
      contactId: values.contactId || null,
      projectId: values.projectId || null,
      dueDate: parseDate(values.dueDate),
      followUpAt: parseDate(values.followUpAt),
      status: values.status ?? 'open',
      updatedAt: new Date(),
    };
    if (input.id) {
      const existing = await getCommitment(userId, input.id);
      if (!existing) {
        return { error: 'notFound' };
      }
      await updateCommitment(userId, input.id, fields);
      await writeAudit(userId, 'update', 'commitment', input.id, {
        status: fields.status,
        direction: fields.direction,
      });
      return { commitmentId: input.id };
    }
    const created = await createCommitment(userId, {
      ...fields,
      createdDate: new Date(),
    });
    await writeAudit(userId, 'create', 'commitment', created.id, {
      description: fields.description,
      direction: fields.direction,
    });
    return { commitmentId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function setCommitmentStatus(input: {
  id: string;
  status: CommitmentStatus;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getCommitment(userId, input.id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateCommitment(userId, input.id, {
      status: input.status,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'status_change', 'commitment', input.id, {
      from: existing.status,
      to: input.status,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveCommitment(
  id: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getCommitment(userId, id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteCommitment(userId, id);
    await writeAudit(userId, 'delete', 'commitment', id, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listWaitingCards(): Promise<{
  waiting?: WaitingCardDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const today = await userToday(userId);
    const [rows, contacts, projects] = await Promise.all([
      listWaitingItems(userId),
      listContacts(userId),
      listProjects(userId),
    ]);
    const contactName = new Map(contacts.map((row) => [row.id, row.name]));
    const projectName = new Map(projects.map((row) => [row.id, row.name]));
    const cards = rows.map((item) => {
      const overdue = isWaitingOverdue({
        status: item.status,
        expectedAt: item.expectedAt,
        followUpAt: item.followUpAt,
        todayYmd: today,
      });
      return {
        id: item.id,
        item: item.item,
        contactId: item.contactId,
        personName: item.contactId
          ? (contactName.get(item.contactId) ?? null)
          : null,
        org: item.org,
        projectId: item.projectId,
        projectName: item.projectId
          ? (projectName.get(item.projectId) ?? null)
          : null,
        requestedAt: toYmd(item.requestedAt),
        expectedAt: toYmd(item.expectedAt),
        followUpAt: toYmd(item.followUpAt),
        status: item.status,
        displayStatus:
          overdue && item.status === 'waiting' ? 'overdue' : item.status,
        overdue,
        daysWaiting: daysWaiting(item.requestedAt, today),
      };
    });
    cards.sort((a, b) => {
      if (a.overdue !== b.overdue) {
        return a.overdue ? -1 : 1;
      }
      if (b.daysWaiting !== a.daysWaiting) {
        return b.daysWaiting - a.daysWaiting;
      }
      return (a.expectedAt ?? '9999').localeCompare(b.expectedAt ?? '9999');
    });
    return { waiting: cards };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveWaitingItem(input: {
  id?: string;
  values: WaitingFormInput;
}): Promise<{ waitingId?: string; error?: string }> {
  const parsed = waitingFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const values = parsed.data;
    const fields = {
      item: values.item,
      contactId: values.contactId || null,
      org: emptyOptional(values.org),
      projectId: values.projectId || null,
      expectedAt: parseDate(values.expectedAt),
      followUpAt: parseDate(values.followUpAt),
      status: values.status ?? 'waiting',
      updatedAt: new Date(),
    };
    if (input.id) {
      const existing = await getWaitingItem(userId, input.id);
      if (!existing) {
        return { error: 'notFound' };
      }
      await updateWaitingItem(userId, input.id, fields);
      await writeAudit(userId, 'update', 'waiting_item', input.id, {
        status: fields.status,
      });
      return { waitingId: input.id };
    }
    const created = await createWaitingItem(userId, {
      ...fields,
      requestedAt: new Date(),
    });
    await writeAudit(userId, 'create', 'waiting_item', created.id, {
      item: fields.item,
    });
    return { waitingId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function setWaitingStatus(input: {
  id: string;
  status: WaitingStatus;
  logInteraction?: boolean;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getWaitingItem(userId, input.id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateWaitingItem(userId, input.id, {
      status: input.status,
      updatedAt: new Date(),
    });
    if (
      input.logInteraction &&
      input.status === 'received' &&
      existing.contactId
    ) {
      await logInteraction(userId, {
        contactId: existing.contactId,
        channel: 'other',
        summary: `Received: ${existing.item}`,
        occurredAt: new Date(),
      });
    }
    await writeAudit(userId, 'status_change', 'waiting_item', input.id, {
      from: existing.status,
      to: input.status,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function bumpWaitingFollowUp(input: {
  id: string;
  days?: number;
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getWaitingItem(userId, input.id);
    if (!existing) {
      return { error: 'notFound' };
    }
    const today = await userToday(userId);
    const next = addDaysYmd(today, input.days ?? 7);
    await updateWaitingItem(userId, input.id, {
      followUpAt: parseDate(next),
      status: existing.status === 'overdue' ? 'waiting' : existing.status,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'update', 'waiting_item', input.id, {
      followUpAt: next,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveWaitingItem(
  id: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getWaitingItem(userId, id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteWaitingItem(userId, id);
    await writeAudit(userId, 'delete', 'waiting_item', id, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listPeopleLookups(): Promise<{
  contacts?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const [contacts, projects] = await Promise.all([
      listContacts(userId),
      listProjects(userId),
    ]);
    return {
      contacts: contacts.map((row) => ({ id: row.id, name: row.name })),
      projects: projects.map((row) => ({ id: row.id, name: row.name })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

