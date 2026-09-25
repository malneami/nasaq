'use server';

import { requireUserId } from '@/lib/auth/session';
import { DEFAULT_CURRENCY } from '@/lib/constants';
import { createAuditLog, listAiRecommendationsForSubject, listAuditLogsForEntity, updateAiRecommendation } from '@/lib/db/queries/system';
import { listContacts } from '@/lib/db/queries/contacts';
import { listGoals } from '@/lib/db/queries/goals';
import { listLifeAreas } from '@/lib/db/queries/life-areas';
import { getVentureFinance } from '@/lib/finance/intelligence/service';
import { getProfile, updateProfile } from '@/lib/db/queries/profiles';
import {
  addProjectContact,
  countProjectsByState,
  createMilestone,
  createProject,
  createProjectScore,
  deleteProject,
  getProject,
  listGoalsForProject,
  listLatestProjectScores,
  listMilestones,
  listProjectCommitments,
  listProjectContacts,
  listProjectLifeAreaIds,
  listProjectMeetings,
  listProjectWaitingItems,
  listProjects,
  listProjectScores,
  removeProjectContact,
  setProjectGoals,
  setProjectLifeAreas,
  updateProject,
} from '@/lib/db/queries/projects';
import {
  createProjectNote,
  deleteProjectNote,
  listProjectNotes,
  updateProjectNote,
} from '@/lib/db/queries/project-notes';
import { createTask, getTask, listTasks, listTasksWithSubtasks, updateTask } from '@/lib/db/queries/tasks';
import { createCommitment, createWaitingItem } from '@/lib/db/queries/commitments';
import {
  defaultPreferences,
  type AiAction,
  type ProjectLink,
  type ProjectStage,
  type ProjectState,
  type RiskLevel,
} from '@/lib/db/schema';
import { toMinor } from '@/lib/money';
import {
  computePriorityScore,
  type ScoreFactors,
} from '@/lib/projects/score';
import { resolveProjectStages } from '@/lib/projects/stages';
import {
  createProjectSchema,
  milestoneSchema,
  projectContactSchema,
  projectIdentitySchema,
  projectProgressSchema,
  projectResourcesSchema,
  projectRiskSchema,
  projectScoreSchema,
  projectStageSchema,
  projectStateSchema,
  projectLinkSchema,
  quickCommitmentSchema,
  quickTaskSchema,
  quickWaitingSchema,
  type ProjectIdentityInput,
  type ProjectProgressInput,
  type ProjectResourcesInput,
  type ProjectRiskInput,
  type ProjectScoreInput,
} from '@/lib/validations/project';

export type ProjectCardDto = {
  id: string;
  name: string;
  state: ProjectState;
  stage: ProjectStage;
  progress: number;
  riskLevel: RiskLevel;
  nextAction: string | null;
  targetDate: string | null;
  updatedAt: string;
  daysSinceUpdated: number;
  currentMilestoneTitle: string | null;
  score: number | null;
  lifeAreaIds: string[];
};

export type ProjectWorkspaceDto = {
  project: {
    id: string;
    name: string;
    description: string | null;
    strategicObjective: string | null;
    desiredOutcome: string | null;
    owner: string | null;
    state: ProjectState;
    stage: ProjectStage;
    progress: number;
    currentMilestoneId: string | null;
    nextMilestoneId: string | null;
    targetDate: string | null;
    nextAction: string | null;
    riskLevel: RiskLevel;
    blockers: string | null;
    dependencies: string | null;
    timeInvestedMinutes: number;
    moneyInvested: number;
    estimatedFutureCost: number;
    currency: string;
    links: ProjectLink[];
  };
  lifeAreaIds: string[];
  goalIds: string[];
  linkedGoals: { id: string; title: string; status: string }[];
  milestones: {
    id: string;
    title: string;
    targetDate: string | null;
    isDone: boolean;
  }[];
  tasks: { id: string; title: string; status: string; parentTaskId: string | null; sortOrder: number }[];
  meetings: { id: string; title: string; startsAt: string }[];
  commitments: {
    id: string;
    description: string;
    direction: string;
    status: string;
  }[];
  waitingItems: { id: string; item: string; status: string }[];
  contacts: { contactId: string; name: string; role: string }[];
  score: (ScoreFactors & { computedScore: number; computedAt: string }) | null;
  computedFinance: {
    investedMinor: number;
    revenueMinor: number;
    netMinor: number;
    timeInvestedMinutes: number;
    currency: string;
  } | null;
};

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function toIsoDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  return new Date(`${day}T00:00:00.000Z`);
}

function daysSince(value: Date): number {
  const ms = Date.now() - value.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function parseLinks(value: unknown): ProjectLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const parsed = projectLinkSchema.safeParse(item);
    return parsed.success
      ? [{ url: parsed.data.url, label: parsed.data.label || undefined }]
      : [];
  });
}

async function writeAudit(
  userId: string,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
  actor: 'user' | 'ai' | 'system' = 'user',
) {
  await createAuditLog(userId, {
    actor,
    action,
    entityType: 'project',
    entityId,
    after,
  });
}

async function activeLimitFor(userId: string) {
  const profile = await getProfile(userId);
  return (
    profile?.preferences?.active_project_limit ??
    defaultPreferences.active_project_limit
  );
}

export async function getPortfolioMeta(): Promise<{
  activeCount?: number;
  activeLimit?: number;
  stages?: ProjectStage[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const [activeCount, profile] = await Promise.all([
      countProjectsByState(userId, 'active'),
      getProfile(userId),
    ]);
    return {
      activeCount,
      activeLimit:
        profile?.preferences?.active_project_limit ??
        defaultPreferences.active_project_limit,
      stages: resolveProjectStages(profile?.preferences),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listProjectCards(): Promise<{
  projects?: ProjectCardDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listProjects(userId);
    const ids = rows.map((row) => row.id);
    const [areaLinks, scores] = await Promise.all([
      listProjectLifeAreaIds(userId, ids),
      listLatestProjectScores(userId, ids),
    ]);
    const areasByProject = new Map<string, string[]>();
    for (const link of areaLinks) {
      const current = areasByProject.get(link.projectId) ?? [];
      current.push(link.lifeAreaId);
      areasByProject.set(link.projectId, current);
    }
    const scoreByProject = new Map(
      scores.map((row) => [row.projectId, row.computedScore]),
    );
    const milestoneTitles = new Map<string, string>();
    await Promise.all(
      rows.map(async (row) => {
        if (!row.currentMilestoneId) {
          return;
        }
        const milestones = await listMilestones(userId, row.id);
        const current = milestones.find((item) => item.id === row.currentMilestoneId);
        if (current) {
          milestoneTitles.set(row.id, current.title);
        }
      }),
    );

    return {
      projects: rows.map((row) => ({
        id: row.id,
        name: row.name,
        state: row.state,
        stage: row.stage,
        progress: row.progress,
        riskLevel: row.riskLevel,
        nextAction: row.nextAction,
        targetDate: toIsoDate(row.targetDate),
        updatedAt: row.updatedAt.toISOString(),
        daysSinceUpdated: daysSince(row.updatedAt),
        currentMilestoneTitle: milestoneTitles.get(row.id) ?? null,
        score: scoreByProject.get(row.id) ?? null,
        lifeAreaIds: areasByProject.get(row.id) ?? [],
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function createProjectRow(input: {
  name: string;
  lifeAreaIds?: string[];
}): Promise<{ projectId?: string; error?: string }> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const created = await createProject(userId, {
      name: parsed.data.name,
      state: 'incubator',
      stage: 'idea',
    });
    if (parsed.data.lifeAreaIds && parsed.data.lifeAreaIds.length > 0) {
      const areas = await listLifeAreas(userId, { includeArchived: true });
      const allowed = new Set(areas.map((area) => area.id));
      await setProjectLifeAreas(
        userId,
        created.id,
        parsed.data.lifeAreaIds.filter((id) => allowed.has(id)),
      );
    }
    await writeAudit(userId, 'create', created.id, { name: created.name });
    return { projectId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function changeProjectState(input: {
  projectId: string;
  state: ProjectState;
  confirmOverLimit?: boolean;
}): Promise<{
  error?: string;
  needsConfirm?: boolean;
  activeCount?: number;
  activeLimit?: number;
}> {
  const parsed = projectStateSchema.safeParse(input.state);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, input.projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    if (existing.state === parsed.data) {
      return {};
    }
    if (parsed.data === 'active') {
      if (!existing.desiredOutcome?.trim()) {
        return { error: 'desiredOutcomeRequired' };
      }
      if (!existing.nextAction?.trim()) {
        return { error: 'nextActionRequired' };
      }
    }

    const limit = await activeLimitFor(userId);
    const activeCount = await countProjectsByState(userId, 'active');
    const activating =
      parsed.data === 'active' && existing.state !== 'active';
    if (activating && activeCount >= limit && !input.confirmOverLimit) {
      return { needsConfirm: true, activeCount, activeLimit: limit };
    }

    await updateProject(userId, existing.id, {
      state: parsed.data,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'state_change', existing.id, {
      from: existing.state,
      to: parsed.data,
      overLimit: Boolean(activating && activeCount >= limit),
      confirmOverLimit: Boolean(input.confirmOverLimit),
      activeCount: activating ? activeCount + 1 : activeCount,
      activeLimit: limit,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function changeProjectStage(input: {
  projectId: string;
  stage: ProjectStage;
}): Promise<{ error?: string }> {
  const parsed = projectStageSchema.safeParse(input.stage);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, input.projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateProject(userId, existing.id, {
      stage: parsed.data,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'stage_change', existing.id, {
      from: existing.stage,
      to: parsed.data,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveProjectIdentity(
  projectId: string,
  values: ProjectIdentityInput,
): Promise<{ error?: string }> {
  const parsed = projectIdentitySchema.safeParse(values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    if (existing.state === 'active' && !parsed.data.desiredOutcome?.trim()) {
      return { error: 'desiredOutcomeRequired' };
    }
    await updateProject(userId, projectId, {
      name: parsed.data.name,
      description: parsed.data.description || null,
      strategicObjective: parsed.data.strategicObjective || null,
      desiredOutcome: parsed.data.desiredOutcome || null,
      owner: parsed.data.owner || null,
      updatedAt: new Date(),
    });
    const areas = await listLifeAreas(userId, { includeArchived: true });
    const allowedAreas = new Set(areas.map((area) => area.id));
    await setProjectLifeAreas(
      userId,
      projectId,
      parsed.data.lifeAreaIds.filter((id) => allowedAreas.has(id)),
    );
    const goals = await listGoals(userId);
    const allowedGoals = new Set(goals.map((goal) => goal.id));
    await setProjectGoals(
      userId,
      projectId,
      parsed.data.goalIds.filter((id) => allowedGoals.has(id)),
    );
    await writeAudit(userId, 'update', projectId, { section: 'identity' });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveProjectProgress(
  projectId: string,
  values: ProjectProgressInput,
): Promise<{ error?: string }> {
  const parsed = projectProgressSchema.safeParse(values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    if (existing.state === 'active' && !parsed.data.nextAction?.trim()) {
      return { error: 'nextActionRequired' };
    }
    const milestones = await listMilestones(userId, projectId);
    const allowed = new Set(milestones.map((item) => item.id));
    const currentMilestoneId = parsed.data.currentMilestoneId
      ? allowed.has(parsed.data.currentMilestoneId)
        ? parsed.data.currentMilestoneId
        : null
      : null;
    const nextMilestoneId = parsed.data.nextMilestoneId
      ? allowed.has(parsed.data.nextMilestoneId)
        ? parsed.data.nextMilestoneId
        : null
      : null;
    await updateProject(userId, projectId, {
      progress: parsed.data.progress,
      currentMilestoneId,
      nextMilestoneId,
      targetDate: parseDate(parsed.data.targetDate),
      nextAction: parsed.data.nextAction || null,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'update', projectId, { section: 'progress' });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveProjectRisk(
  projectId: string,
  values: ProjectRiskInput,
): Promise<{ error?: string }> {
  const parsed = projectRiskSchema.safeParse(values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateProject(userId, projectId, {
      blockers: parsed.data.blockers || null,
      dependencies: parsed.data.dependencies || null,
      riskLevel: parsed.data.riskLevel,
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'update', projectId, { section: 'risk' });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveProjectResources(
  projectId: string,
  values: ProjectResourcesInput,
): Promise<{ error?: string }> {
  const parsed = projectResourcesSchema.safeParse(values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const currency = existing.currency || DEFAULT_CURRENCY;
    // Manual overrides remain editable; computed figures surface from transactions.
    await updateProject(userId, projectId, {
      timeInvestedMinutes: parsed.data.timeInvestedMinutes,
      moneyInvested: toMinor(parsed.data.moneyInvestedMajor, currency),
      estimatedFutureCost: toMinor(
        parsed.data.estimatedFutureCostMajor,
        currency,
      ),
      updatedAt: new Date(),
    });
    await writeAudit(userId, 'update', projectId, { section: 'resources' });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveProjectScore(
  projectId: string,
  values: ProjectScoreInput,
): Promise<{ score?: number; error?: string }> {
  const parsed = projectScoreSchema.safeParse(values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const factors = parsed.data as ScoreFactors;
    const result = computePriorityScore(factors);
    const row = await createProjectScore(userId, {
      projectId,
      ...factors,
      computedScore: result.score,
      computedAt: new Date(),
    });
    await writeAudit(userId, 'score', projectId, {
      computedScore: result.score,
      factors,
    });
    return { score: row.computedScore };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function addProjectMilestone(
  projectId: string,
  input: { title: string; targetDate?: string },
): Promise<{ error?: string }> {
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const current = await listMilestones(userId, projectId);
    await createMilestone(userId, {
      projectId,
      title: parsed.data.title,
      targetDate: parseDate(parsed.data.targetDate),
      sortOrder: current.length + 1,
    });
    await writeAudit(userId, 'milestone_create', projectId, {
      title: parsed.data.title,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function addProjectTask(
  projectId: string,
  input: { title: string },
): Promise<{ error?: string }> {
  const parsed = quickTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const task = await createTask(userId, {
      title: parsed.data.title,
      projectId,
      status: 'next',
    });
    await createAuditLog(userId, {
      actor: 'user',
      action: 'create',
      entityType: 'task',
      entityId: task.id,
      after: { title: parsed.data.title, projectId, status: 'next' },
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function addProjectCommitment(
  projectId: string,
  input: { description: string; direction: 'i_promised' | 'they_promised' },
): Promise<{ error?: string }> {
  const parsed = quickCommitmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await createCommitment(userId, {
      projectId,
      description: parsed.data.description,
      direction: parsed.data.direction,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function addProjectWaitingItem(
  projectId: string,
  input: { item: string },
): Promise<{ error?: string }> {
  const parsed = quickWaitingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await createWaitingItem(userId, {
      projectId,
      item: parsed.data.item,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function addProjectLink(
  projectId: string,
  input: { url: string; label?: string },
): Promise<{ error?: string }> {
  const parsed = projectLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const links = [
      ...parseLinks(existing.links),
      {
        url: parsed.data.url,
        label: parsed.data.label || undefined,
      },
    ];
    await updateProject(userId, projectId, { links, updatedAt: new Date() });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function removeProjectLink(
  projectId: string,
  url: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const links = parseLinks(existing.links).filter((item) => item.url !== url);
    await updateProject(userId, projectId, { links, updatedAt: new Date() });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function addProjectPerson(
  projectId: string,
  input: { contactId: string; role: string },
): Promise<{ error?: string }> {
  const parsed = projectContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await addProjectContact(userId, {
      projectId,
      contactId: parsed.data.contactId,
      role: parsed.data.role,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function removeProjectPerson(
  projectId: string,
  contactId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await removeProjectContact(userId, projectId, contactId);
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveProjectRow(
  projectId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteProject(userId, projectId);
    await writeAudit(userId, 'delete', projectId, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveProjectStageOrder(
  stages: ProjectStage[],
): Promise<{ error?: string }> {
  const parsed = projectStageSchema.array().min(1).safeParse(stages);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const profile = await getProfile(userId);
    if (!profile) {
      return { error: 'notFound' };
    }
    await updateProfile(userId, {
      preferences: {
        ...defaultPreferences,
        ...profile.preferences,
        project_stages: resolveProjectStages({
          ...profile.preferences,
          project_stages: parsed.data,
        }),
      },
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function getProjectWorkspace(projectId: string): Promise<{
  workspace?: ProjectWorkspaceDto;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const project = await getProject(userId, projectId);
    if (!project) {
      return { error: 'notFound' };
    }
    const [
      areaLinks,
      linkedGoals,
      milestones,
      tasks,
      meetings,
      commitments,
      waitingItems,
      people,
      contacts,
      scores,
    ] = await Promise.all([
      listProjectLifeAreaIds(userId, [project.id]),
      listGoalsForProject(userId, project.id),
      listMilestones(userId, project.id),
      listTasksWithSubtasks(userId, project.id),
      listProjectMeetings(userId, project.id),
      listProjectCommitments(userId, project.id),
      listProjectWaitingItems(userId, project.id),
      listProjectContacts(userId, project.id),
      listContacts(userId),
      listProjectScores(userId, project.id),
    ]);
    const contactName = new Map(contacts.map((row) => [row.id, row.name]));
    const latest = scores[0];
    const ventures = await getVentureFinance(userId);
    const ventureRow = ventures.find((row) => row.projectId === project.id);
    return {
      workspace: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          strategicObjective: project.strategicObjective,
          desiredOutcome: project.desiredOutcome,
          owner: project.owner,
          state: project.state,
          stage: project.stage,
          progress: project.progress,
          currentMilestoneId: project.currentMilestoneId,
          nextMilestoneId: project.nextMilestoneId,
          targetDate: toIsoDate(project.targetDate),
          nextAction: project.nextAction,
          riskLevel: project.riskLevel,
          blockers: project.blockers,
          dependencies: project.dependencies,
          timeInvestedMinutes: ventureRow?.timeInvestedMinutes ?? project.timeInvestedMinutes,
          moneyInvested: ventureRow?.investedMinor ?? project.moneyInvested,
          estimatedFutureCost: project.estimatedFutureCost,
          currency: ventureRow?.currency ?? project.currency,
          links: parseLinks(project.links),
        },
        lifeAreaIds: areaLinks.map((link) => link.lifeAreaId),
        goalIds: linkedGoals.map((goal) => goal.id),
        linkedGoals,
        milestones: milestones.map((item) => ({
          id: item.id,
          title: item.title,
          targetDate: toIsoDate(item.targetDate),
          isDone: item.isDone,
        })),
        tasks: tasks.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          parentTaskId: item.parentTaskId,
          sortOrder: item.sortOrder,
        })),
        meetings: meetings.map((item) => ({
          id: item.id,
          title: item.title,
          startsAt: item.startsAt.toISOString(),
        })),
        commitments: commitments.map((item) => ({
          id: item.id,
          description: item.description,
          direction: item.direction,
          status: item.status,
        })),
        waitingItems: waitingItems.map((item) => ({
          id: item.id,
          item: item.item,
          status: item.status,
        })),
        contacts: people.map((item) => ({
          contactId: item.contactId,
          name: contactName.get(item.contactId) ?? item.contactId,
          role: item.role,
        })),
        score: latest
          ? {
              strategicFit: latest.strategicFit,
              expectedImpact: latest.expectedImpact,
              revenuePotential: latest.revenuePotential,
              networkValue: latest.networkValue,
              personalInterest: latest.personalInterest,
              timeRequirement: latest.timeRequirement,
              financialCost: latest.financialCost,
              complexity: latest.complexity,
              urgency: latest.urgency,
              computedScore: latest.computedScore,
              computedAt: latest.computedAt.toISOString(),
            }
          : null,
        computedFinance: ventureRow
          ? {
              investedMinor: ventureRow.investedMinor,
              revenueMinor: ventureRow.revenueMinor,
              netMinor: ventureRow.netMinor,
              timeInvestedMinutes: ventureRow.timeInvestedMinutes,
              currency: ventureRow.currency,
            }
          : null,
      },
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listProjectGoalOptions(): Promise<{
  goals?: { id: string; title: string }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listGoals(userId);
    return { goals: rows.map((row) => ({ id: row.id, title: row.title })) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listProjectContactOptions(): Promise<{
  contacts?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listContacts(userId);
    return { contacts: rows.map((row) => ({ id: row.id, name: row.name })) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listProjectRecommendations(projectId: string): Promise<{
  recommendations?: {
    id: string;
    recommendation: AiAction;
    rationale: string;
    confidence: number;
    status: string;
    createdAt: string;
  }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listAiRecommendationsForSubject(
      userId,
      'project',
      projectId,
    );
    return {
      recommendations: rows.map((row) => {
        const payload = row.payload ?? {};
        return {
          id: row.id,
          recommendation: (payload.recommendation as AiAction) ?? 'reassess',
          rationale: String(payload.rationale ?? ''),
          confidence: Number(row.confidence ?? payload.confidence ?? 0),
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function dismissProjectRecommendation(
  recommendationId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await updateAiRecommendation(userId, recommendationId, {
      status: 'dismissed',
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function markRecommendationAccepted(
  recommendationId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await updateAiRecommendation(userId, recommendationId, {
      status: 'accepted',
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

// ---------------------------------------------------------------------------
// Batch actions
// ---------------------------------------------------------------------------

export async function batchChangeProjectState(input: {
  projectIds: string[];
  state: ProjectState;
}): Promise<{ error?: string; skipped?: string[] }> {
  try {
    const userId = await requireUserId();
    const skipped: string[] = [];
    for (const projectId of input.projectIds) {
      const result = await changeProjectState({
        projectId,
        state: input.state,
        confirmOverLimit: true,
      });
      if (result.error) {
        skipped.push(projectId);
      }
    }
    return { skipped };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function batchArchiveProjects(input: {
  projectIds: string[];
}): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    for (const projectId of input.projectIds) {
      await deleteProject(userId, projectId);
      await writeAudit(userId, 'delete', projectId, { deleted: true, batch: true });
    }
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export async function createSubtask(
  projectId: string,
  input: { parentTaskId: string; title: string },
): Promise<{ error?: string }> {
  const parsed = quickTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const subtasks = await listTasksWithSubtasks(userId, projectId);
    const existingSubtasks = subtasks.filter(
      (t) => t.parentTaskId === input.parentTaskId,
    );
    await createTask(userId, {
      title: parsed.data.title,
      projectId,
      parentTaskId: input.parentTaskId,
      status: 'next',
      sortOrder: existingSubtasks.length,
    });
    await writeAudit(userId, 'subtask_create', projectId, {
      title: parsed.data.title,
      parentTaskId: input.parentTaskId,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function toggleSubtaskStatus(
  projectId: string,
  input: { taskId: string },
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const task = await getTask(userId, input.taskId);
    if (!task) {
      return { error: 'notFound' };
    }
    const isCompleted = task.status === 'completed';
    await updateTask(userId, input.taskId, {
      status: isCompleted ? 'next' : 'completed',
      completedAt: isCompleted ? null : new Date(),
    });
    await writeAudit(userId, 'subtask_toggle', projectId, {
      taskId: input.taskId,
      from: task.status,
      to: isCompleted ? 'next' : 'completed',
    });

    // Recalculate project progress from subtask completion ratios
    await recalcProjectProgress(userId, projectId);
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

async function recalcProjectProgress(userId: string, projectId: string) {
  const allTasks = await listTasksWithSubtasks(userId, projectId);
  const parentTasks = allTasks.filter((t) => !t.parentTaskId);
  if (parentTasks.length === 0) {
    return;
  }
  const subtasksByParent = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (!t.parentTaskId) {
      continue;
    }
    const arr = subtasksByParent.get(t.parentTaskId) ?? [];
    arr.push(t);
    subtasksByParent.set(t.parentTaskId, arr);
  }

  let totalCompletion = 0;
  let count = 0;
  for (const parent of parentTasks) {
    const subs = subtasksByParent.get(parent.id);
    if (subs && subs.length > 0) {
      const completed = subs.filter((s) => s.status === 'completed').length;
      totalCompletion += completed / subs.length;
    } else {
      totalCompletion += parent.status === 'completed' ? 1 : 0;
    }
    count++;
  }

  if (count > 0) {
    const progress = Math.round((totalCompletion / count) * 100);
    await updateProject(userId, projectId, { progress });
  }
}

// ---------------------------------------------------------------------------
// Project notes
// ---------------------------------------------------------------------------

export async function listProjectNotesAction(projectId: string): Promise<{
  notes?: { id: string; title: string; body: string; updatedAt: string }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listProjectNotes(userId, projectId);
    return {
      notes: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function createProjectNoteAction(
  projectId: string,
  input: { title: string; body: string },
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await createProjectNote(userId, {
      projectId,
      title: input.title.trim() || 'Untitled',
      body: input.body,
    });
    await writeAudit(userId, 'note_create', projectId, { title: input.title });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function updateProjectNoteAction(
  projectId: string,
  input: { noteId: string; title: string; body: string },
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await updateProjectNote(userId, input.noteId, {
      title: input.title.trim() || 'Untitled',
      body: input.body,
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function deleteProjectNoteAction(
  projectId: string,
  noteId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getProject(userId, projectId);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteProjectNote(userId, noteId);
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

// ---------------------------------------------------------------------------
// Project activity log
// ---------------------------------------------------------------------------

export async function listProjectActivity(projectId: string): Promise<{
  activity?: {
    id: string;
    actor: string;
    action: string;
    after: Record<string, unknown> | null;
    createdAt: string;
  }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const rows = await listAuditLogsForEntity(userId, 'project', projectId, 50);
    return {
      activity: rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        after: row.after,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}
