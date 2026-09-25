import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { listLifeAreas } from '@/lib/db/queries/life-areas';
import {
  listLatestProjectScores,
  listProjectLifeAreaIds,
  listProjects,
} from '@/lib/db/queries/projects';
import { listTaskLifeAreaIds, listTasks } from '@/lib/db/queries/tasks';
import type {
  EnergyLevel,
  SelectTask,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@/lib/db/schema';
import { CANDIDATE_TASK_STATUSES } from '@/lib/tasks/constants';
import {
  rankTasks,
  type RankTasksResult,
  type SelectCandidate,
} from '@/lib/tasks/select';

export type TaskCardDto = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  projectScore: number | null;
  lifeAreaIds: string[];
  owner: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  dueDate: string | null;
  estimatedMinutes: number | null;
  energy: EnergyLevel;
  context: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NextActionGroup = {
  projectId: string | null;
  projectName: string | null;
  tasks: TaskCardDto[];
};

export type SelectTasksOptions = {
  minutes: number;
  energy?: EnergyLevel;
  context?: string;
  now?: Date;
};

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function toTaskCard(
  row: SelectTask,
  extras: {
    projectName: string | null;
    projectScore: number | null;
    lifeAreaIds: string[];
  },
): TaskCardDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.projectId,
    projectName: extras.projectName,
    projectScore: extras.projectScore,
    lifeAreaIds: extras.lifeAreaIds,
    owner: row.owner,
    priority: row.priority,
    status: row.status,
    type: row.type,
    dueDate: toIsoDate(row.dueDate),
    estimatedMinutes: row.estimatedMinutes,
    energy: row.energy,
    context: row.context,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function hydrateTasks(
  userId: string,
  rows: SelectTask[],
): Promise<TaskCardDto[]> {
  const projectIds = [
    ...new Set(
      rows
        .map((row) => row.projectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const standaloneIds = rows
    .filter((row) => !row.projectId)
    .map((row) => row.id);

  const [projects, scores, projectAreas, taskAreas] = await Promise.all([
    listProjects(userId),
    listLatestProjectScores(userId, projectIds),
    listProjectLifeAreaIds(userId, projectIds),
    listTaskLifeAreaIds(userId, standaloneIds),
  ]);

  const projectNameById = new Map(projects.map((row) => [row.id, row.name]));
  const scoreByProject = new Map(
    scores.map((row) => [row.projectId, row.computedScore]),
  );
  const areasByProject = new Map<string, string[]>();
  for (const link of projectAreas) {
    const current = areasByProject.get(link.projectId) ?? [];
    current.push(link.lifeAreaId);
    areasByProject.set(link.projectId, current);
  }
  const areasByTask = new Map<string, string[]>();
  for (const link of taskAreas) {
    const current = areasByTask.get(link.taskId) ?? [];
    current.push(link.lifeAreaId);
    areasByTask.set(link.taskId, current);
  }

  return rows.map((row) =>
    toTaskCard(row, {
      projectName: row.projectId
        ? (projectNameById.get(row.projectId) ?? null)
        : null,
      projectScore: row.projectId
        ? (scoreByProject.get(row.projectId) ?? null)
        : null,
      lifeAreaIds: row.projectId
        ? (areasByProject.get(row.projectId) ?? [])
        : (areasByTask.get(row.id) ?? []),
    }),
  );
}

export async function listTaskCardsForUser(
  userId: string,
  filters?: { status?: TaskStatus; projectId?: string },
): Promise<TaskCardDto[]> {
  const rows = await listTasks(userId, filters);
  return hydrateTasks(userId, rows);
}

export async function getNextActions(
  userId: string,
): Promise<NextActionGroup[]> {
  const cards = await listTaskCardsForUser(userId, { status: 'next' });
  const groups = new Map<string, NextActionGroup>();
  const order: string[] = [];

  for (const task of cards) {
    const key = task.projectId ?? '__standalone__';
    let group = groups.get(key);
    if (!group) {
      group = {
        projectId: task.projectId,
        projectName: task.projectName,
        tasks: [],
      };
      groups.set(key, group);
      order.push(key);
    }
    group.tasks.push(task);
  }

  return order.map((key) => groups.get(key)!);
}

function toCandidate(card: TaskCardDto): SelectCandidate {
  return {
    id: card.id,
    title: card.title,
    status: card.status,
    priority: card.priority,
    energy: card.energy,
    type: card.type,
    context: card.context,
    dueDate: card.dueDate,
    estimatedMinutes: card.estimatedMinutes,
    projectId: card.projectId,
    projectName: card.projectName,
    projectScore: card.projectScore,
    hasUnmetDependency: card.status === 'waiting',
  };
}

export async function selectTasks(
  userId: string,
  options: SelectTasksOptions,
): Promise<RankTasksResult> {
  const now = options.now ?? new Date();
  const cards = await hydrateTasks(
    userId,
    await listTasks(userId, { statuses: [...CANDIDATE_TASK_STATUSES] }),
  );

  let calendarEvents: { startsAt: string; endsAt: string }[] | undefined;
  try {
    const events = await listCalendarEvents(userId);
    calendarEvents = events.map((event) => ({
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    }));
    if (calendarEvents.length === 0) {
      calendarEvents = undefined;
    }
  } catch {
    calendarEvents = undefined;
  }

  return rankTasks(cards.map(toCandidate), {
    now,
    availableMinutes: options.minutes,
    energy: options.energy,
    context: options.context,
    calendarEvents,
  });
}

export async function listKnownLifeAreaIds(userId: string) {
  const areas = await listLifeAreas(userId, { includeArchived: true });
  return new Set(areas.map((area) => area.id));
}
