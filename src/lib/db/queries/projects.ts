import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  calendarEvents,
  commitments,
  goalProjects,
  goals,
  milestones,
  projectContacts,
  projectFinances,
  projectLifeAreas,
  projectScores,
  projects,
  waitingItems,
  transactions,
  type InsertMilestone,
  type InsertProject,
  type InsertProjectContact,
  type InsertProjectFinance,
  type InsertProjectScore,
  type ProjectState,
} from '@/lib/db/schema';
import { assertUserId, notDeleted } from './helpers';

export async function listProjects(
  userId: string,
  filters?: { state?: ProjectState },
) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.userId, id),
        notDeleted(projects.deletedAt),
        filters?.state ? eq(projects.state, filters.state) : undefined,
      ),
    )
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(userId: string, projectId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.userId, id),
        eq(projects.id, projectId),
        notDeleted(projects.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createProject(
  userId: string,
  values: Omit<InsertProject, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(projects)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function updateProject(
  userId: string,
  projectId: string,
  values: Partial<Omit<InsertProject, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(projects)
    .set(values)
    .where(and(eq(projects.userId, id), eq(projects.id, projectId)))
    .returning();
  return row ?? null;
}

export async function deleteProject(userId: string, projectId: string) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(and(eq(projects.userId, id), eq(projects.id, projectId)))
    .returning();
  return row ?? null;
}

export async function listMilestones(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(milestones)
    .where(and(eq(milestones.userId, id), eq(milestones.projectId, projectId)))
    .orderBy(milestones.sortOrder);
}

export async function createMilestone(
  userId: string,
  values: Omit<InsertMilestone, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(milestones)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function createProjectScore(
  userId: string,
  values: Omit<InsertProjectScore, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(projectScores)
    .values({ ...values, userId: id })
    .returning();
  return row;
}

export async function listProjectScores(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projectScores)
    .where(
      and(eq(projectScores.userId, id), eq(projectScores.projectId, projectId)),
    )
    .orderBy(desc(projectScores.computedAt));
}

export async function upsertProjectFinance(
  userId: string,
  values: Omit<InsertProjectFinance, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(projectFinances)
    .values({ ...values, userId: id })
    .onConflictDoUpdate({
      target: projectFinances.projectId,
      set: {
        moneyInvested: values.moneyInvested,
        revenue: values.revenue,
        timeInvestedMinutes: values.timeInvestedMinutes,
        currency: values.currency,
      },
    })
    .returning();
  return row;
}

export async function listProjectFinancesForUser(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projectFinances)
    .where(eq(projectFinances.userId, id));
}

export async function recomputeProjectFinances(
  userId: string,
  projectId: string,
) {
  const id = assertUserId(userId);
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, id), eq(projects.id, projectId)))
    .limit(1);

  if (!project) {
    return null;
  }

  const [sums] = await db
    .select({
      invested: sql<number>`coalesce(sum(case when ${transactions.type} in ('expense', 'fee') then ${transactions.amount} else 0 end), 0)`,
      revenue: sql<number>`coalesce(sum(case when ${transactions.type} in ('income') then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, id),
        eq(transactions.projectId, projectId),
        notDeleted(transactions.deletedAt),
      ),
    );

  return upsertProjectFinance(id, {
    projectId,
    moneyInvested: Number(sums?.invested ?? 0),
    revenue: Number(sums?.revenue ?? 0),
    timeInvestedMinutes: project.timeInvestedMinutes,
    currency: project.currency,
  });
}

export async function countProjectsByState(
  userId: string,
  state: ProjectState,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)` })
    .from(projects)
    .where(
      and(
        eq(projects.userId, id),
        eq(projects.state, state),
        notDeleted(projects.deletedAt),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function listLatestProjectScores(userId: string, projectIds: string[]) {
  if (projectIds.length === 0) {
    return [];
  }
  const id = assertUserId(userId);
  const rows = await getDb()
    .select()
    .from(projectScores)
    .where(
      and(
        eq(projectScores.userId, id),
        inArray(projectScores.projectId, projectIds),
      ),
    )
    .orderBy(desc(projectScores.computedAt));

  const seen = new Set<string>();
  const latest = [];
  for (const row of rows) {
    if (seen.has(row.projectId)) {
      continue;
    }
    seen.add(row.projectId);
    latest.push(row);
  }
  return latest;
}

export async function listProjectLifeAreaIds(userId: string, projectIds: string[]) {
  if (projectIds.length === 0) {
    return [];
  }
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projectLifeAreas)
    .where(
      and(
        eq(projectLifeAreas.userId, id),
        inArray(projectLifeAreas.projectId, projectIds),
      ),
    );
}

export async function setProjectLifeAreas(
  userId: string,
  projectId: string,
  lifeAreaIds: string[],
) {
  const id = assertUserId(userId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(projectLifeAreas)
      .where(
        and(
          eq(projectLifeAreas.userId, id),
          eq(projectLifeAreas.projectId, projectId),
        ),
      );
    if (lifeAreaIds.length === 0) {
      return;
    }
    await tx.insert(projectLifeAreas).values(
      lifeAreaIds.map((lifeAreaId) => ({
        userId: id,
        projectId,
        lifeAreaId,
      })),
    );
  });
}

export async function listGoalsForProject(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select({
      id: goals.id,
      title: goals.title,
      status: goals.status,
    })
    .from(goalProjects)
    .innerJoin(goals, eq(goals.id, goalProjects.goalId))
    .where(
      and(
        eq(goalProjects.userId, id),
        eq(goalProjects.projectId, projectId),
        notDeleted(goals.deletedAt),
      ),
    );
}

export async function setProjectGoals(
  userId: string,
  projectId: string,
  goalIds: string[],
) {
  const id = assertUserId(userId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(goalProjects)
      .where(
        and(eq(goalProjects.userId, id), eq(goalProjects.projectId, projectId)),
      );
    if (goalIds.length === 0) {
      return;
    }
    await tx.insert(goalProjects).values(
      goalIds.map((goalId) => ({
        userId: id,
        goalId,
        projectId,
      })),
    );
  });
}

export async function updateMilestone(
  userId: string,
  milestoneId: string,
  values: Partial<Omit<InsertMilestone, 'userId'>>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .update(milestones)
    .set(values)
    .where(and(eq(milestones.userId, id), eq(milestones.id, milestoneId)))
    .returning();
  return row ?? null;
}

export async function listProjectContacts(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projectContacts)
    .where(
      and(
        eq(projectContacts.userId, id),
        eq(projectContacts.projectId, projectId),
      ),
    );
}

export async function listContactProjects(userId: string, contactId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select({
      projectId: projectContacts.projectId,
      contactId: projectContacts.contactId,
      role: projectContacts.role,
      projectName: projects.name,
      projectState: projects.state,
    })
    .from(projectContacts)
    .innerJoin(projects, eq(projects.id, projectContacts.projectId))
    .where(
      and(
        eq(projectContacts.userId, id),
        eq(projectContacts.contactId, contactId),
        notDeleted(projects.deletedAt),
      ),
    );
}

export async function listAllProjectContactLinks(userId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(projectContacts)
    .where(eq(projectContacts.userId, id));
}

export async function addProjectContact(
  userId: string,
  values: Omit<InsertProjectContact, 'userId'>,
) {
  const id = assertUserId(userId);
  const [row] = await getDb()
    .insert(projectContacts)
    .values({ ...values, userId: id })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function removeProjectContact(
  userId: string,
  projectId: string,
  contactId: string,
) {
  const id = assertUserId(userId);
  await getDb()
    .delete(projectContacts)
    .where(
      and(
        eq(projectContacts.userId, id),
        eq(projectContacts.projectId, projectId),
        eq(projectContacts.contactId, contactId),
      ),
    );
}

export async function listProjectMeetings(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, id),
        eq(calendarEvents.projectId, projectId),
        eq(calendarEvents.eventType, 'meeting'),
      ),
    )
    .orderBy(desc(calendarEvents.startsAt));
}

export async function listProjectCommitments(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.userId, id),
        eq(commitments.projectId, projectId),
        notDeleted(commitments.deletedAt),
      ),
    )
    .orderBy(desc(commitments.updatedAt));
}

export async function listProjectWaitingItems(userId: string, projectId: string) {
  const id = assertUserId(userId);
  return getDb()
    .select()
    .from(waitingItems)
    .where(
      and(
        eq(waitingItems.userId, id),
        eq(waitingItems.projectId, projectId),
        notDeleted(waitingItems.deletedAt),
      ),
    )
    .orderBy(desc(waitingItems.updatedAt));
}
