import { DEFAULT_TIMEZONE } from '@/lib/constants';
import {
  listCommitments,
  listWaitingItems,
} from '@/lib/db/queries/commitments';
import { listContacts } from '@/lib/db/queries/contacts';
import { getProfile } from '@/lib/db/queries/profiles';
import { listProjects } from '@/lib/db/queries/projects';
import type {
  CommitmentDirection,
  CommitmentStatus,
  RelationshipCategory,
  WaitingStatus,
} from '@/lib/db/schema';
import {
  daysUntil,
  daysWaiting,
  isCommitmentOverdue,
  isFollowUpDue,
  isWaitingOverdue,
  toYmd,
} from '@/lib/people/overdue';
import { ymdInTimeZone } from '@/lib/time/zoned';

export type DueFollowUpDto = {
  id: string;
  contactId: string;
  personName: string;
  category: RelationshipCategory;
  owed: string;
  dueYmd: string;
  overdue: boolean;
  lastContactYmd: string | null;
  staleDays: number | null;
  href: string;
};

export type OverdueCommitmentDto = {
  id: string;
  description: string;
  direction: CommitmentDirection;
  status: CommitmentStatus;
  contactId: string | null;
  personName: string | null;
  projectId: string | null;
  projectName: string | null;
  dueYmd: string | null;
  overdue: boolean;
  daysUntil: number | null;
  href: string;
};

export type OverdueWaitingDto = {
  id: string;
  item: string;
  status: WaitingStatus;
  contactId: string | null;
  personName: string | null;
  org: string | null;
  projectId: string | null;
  projectName: string | null;
  expectedYmd: string | null;
  followUpYmd: string | null;
  dueYmd: string | null;
  overdue: boolean;
  daysWaiting: number;
  href: string;
};

async function todayForUser(userId: string): Promise<{
  todayYmd: string;
  timeZone: string;
}> {
  const profile = await getProfile(userId);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  return { todayYmd: ymdInTimeZone(new Date(), timeZone), timeZone };
}

export async function getDueFollowups(
  userId: string,
  todayYmd?: string,
): Promise<DueFollowUpDto[]> {
  const today = todayYmd ?? (await todayForUser(userId)).todayYmd;
  const contacts = await listContacts(userId);
  const items: DueFollowUpDto[] = [];

  for (const contact of contacts) {
    if (!isFollowUpDue({ nextFollowUpAt: contact.nextFollowUpAt, todayYmd: today })) {
      continue;
    }
    const dueYmd = toYmd(contact.nextFollowUpAt)!;
    const last = toYmd(contact.lastInteractionAt);
    items.push({
      id: contact.id,
      contactId: contact.id,
      personName: contact.name,
      category: contact.category,
      owed: contact.notes?.trim() || contact.organization || contact.name,
      dueYmd,
      overdue: dueYmd < today,
      lastContactYmd: last,
      staleDays: last ? daysWaiting(last, today) : null,
      href: `/people/${contact.id}`,
    });
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    return a.dueYmd.localeCompare(b.dueYmd);
  });
  return items;
}

export async function getOverdueCommitments(
  userId: string,
  todayYmd?: string,
): Promise<OverdueCommitmentDto[]> {
  const today = todayYmd ?? (await todayForUser(userId)).todayYmd;
  const [rows, contacts, projects] = await Promise.all([
    listCommitments(userId),
    listContacts(userId),
    listProjects(userId),
  ]);
  const contactName = new Map(contacts.map((row) => [row.id, row.name]));
  const projectName = new Map(projects.map((row) => [row.id, row.name]));

  const items: OverdueCommitmentDto[] = [];
  for (const row of rows) {
    if (row.status === 'fulfilled' || row.status === 'cancelled') {
      continue;
    }
    const overdue = isCommitmentOverdue({
      status: row.status,
      dueDate: row.dueDate,
      todayYmd: today,
    });
    if (!overdue && row.status !== 'open') {
      continue;
    }
    if (!overdue) {
      continue;
    }
    const dueYmd = toYmd(row.dueDate);
    items.push({
      id: row.id,
      description: row.description,
      direction: row.direction,
      status: overdue && row.status === 'open' ? 'overdue' : row.status,
      contactId: row.contactId,
      personName: row.contactId ? (contactName.get(row.contactId) ?? null) : null,
      projectId: row.projectId,
      projectName: row.projectId ? (projectName.get(row.projectId) ?? null) : null,
      dueYmd,
      overdue: true,
      daysUntil: daysUntil(dueYmd, today),
      href: '/people?tab=commitments',
    });
  }

  items.sort((a, b) =>
    (a.dueYmd ?? '9999-12-31').localeCompare(b.dueYmd ?? '9999-12-31'),
  );
  return items;
}

export async function getOverdueWaiting(
  userId: string,
  todayYmd?: string,
): Promise<OverdueWaitingDto[]> {
  const today = todayYmd ?? (await todayForUser(userId)).todayYmd;
  const [rows, contacts, projects] = await Promise.all([
    listWaitingItems(userId),
    listContacts(userId),
    listProjects(userId),
  ]);
  const contactName = new Map(contacts.map((row) => [row.id, row.name]));
  const projectName = new Map(projects.map((row) => [row.id, row.name]));

  const items: OverdueWaitingDto[] = [];
  for (const row of rows) {
    const overdue = isWaitingOverdue({
      status: row.status,
      expectedAt: row.expectedAt,
      followUpAt: row.followUpAt,
      todayYmd: today,
    });
    if (!overdue) {
      continue;
    }
    const expectedYmd = toYmd(row.expectedAt);
    const followUpYmd = toYmd(row.followUpAt);
    const dueYmd = expectedYmd ?? followUpYmd;
    items.push({
      id: row.id,
      item: row.item,
      status: row.status === 'waiting' ? 'overdue' : row.status,
      contactId: row.contactId,
      personName: row.contactId ? (contactName.get(row.contactId) ?? null) : null,
      org: row.org,
      projectId: row.projectId,
      projectName: row.projectId ? (projectName.get(row.projectId) ?? null) : null,
      expectedYmd,
      followUpYmd,
      dueYmd,
      overdue: true,
      daysWaiting: daysWaiting(row.requestedAt, today),
      href: '/people?tab=waiting',
    });
  }

  items.sort((a, b) => {
    if (b.daysWaiting !== a.daysWaiting) {
      return b.daysWaiting - a.daysWaiting;
    }
    return (a.dueYmd ?? '9999-12-31').localeCompare(b.dueYmd ?? '9999-12-31');
  });
  return items;
}
