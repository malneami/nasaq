'use server';

import { requireUserId } from '@/lib/auth/session';
import { createWaitingItem } from '@/lib/db/queries/commitments';
import { listProjects } from '@/lib/db/queries/projects';
import {
  createTask,
  deleteTask,
  getTask,
  setTaskLifeAreas,
  updateTask,
} from '@/lib/db/queries/tasks';
import { createAuditLog } from '@/lib/db/queries/system';
import type { TaskStatus } from '@/lib/db/schema';
import { TASK_STATUS_TRANSITIONS } from '@/lib/tasks/constants';
import {
  getNextActions,
  listKnownLifeAreaIds,
  listTaskCardsForUser,
  selectTasks,
  type NextActionGroup,
  type TaskCardDto,
} from '@/lib/tasks/service';
import type { RankTasksResult } from '@/lib/tasks/select';
import {
  quickTaskAddSchema,
  selectTasksInputSchema,
  taskFormSchema,
  waitingFromTaskSchema,
  type QuickTaskAddInput,
  type SelectTasksInput,
  type TaskFormInput,
  type WaitingFromTaskInput,
} from '@/lib/validations/task';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
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

function parseMinutes(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24 * 60) {
    return null;
  }
  return parsed;
}

async function writeAudit(
  userId: string,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
) {
  await createAuditLog(userId, {
    actor: 'user',
    action,
    entityType: 'task',
    entityId,
    after,
  });
}

function completedAtForStatus(
  nextStatus: TaskStatus,
  existingCompletedAt: Date | null | undefined,
): Date | null {
  if (nextStatus === 'completed') {
    return existingCompletedAt ?? new Date();
  }
  return null;
}

export async function listTaskCards(): Promise<{
  tasks?: TaskCardDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { tasks: await listTaskCardsForUser(userId) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listNextActions(): Promise<{
  groups?: NextActionGroup[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    return { groups: await getNextActions(userId) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function runSelectTasks(
  input: SelectTasksInput,
): Promise<{ result?: RankTasksResult; error?: string }> {
  const parsed = selectTasksInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    return {
      result: await selectTasks(userId, {
        minutes: parsed.data.minutes,
        energy: parsed.data.energy,
        context: parsed.data.context,
      }),
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function saveTask(input: {
  id?: string;
  values: TaskFormInput;
}): Promise<{ taskId?: string; error?: string }> {
  const parsed = taskFormSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }

  try {
    const userId = await requireUserId();
    const values = parsed.data;
    const existing = input.id ? await getTask(userId, input.id) : null;
    if (input.id && !existing) {
      return { error: 'notFound' };
    }

    const projects = await listProjects(userId);
    const allowedProjects = new Set(projects.map((project) => project.id));
    const projectId =
      values.projectId && allowedProjects.has(values.projectId)
        ? values.projectId
        : null;

    const allowedAreas = await listKnownLifeAreaIds(userId);
    const lifeAreaIds = projectId
      ? []
      : values.lifeAreaIds.filter((id) => allowedAreas.has(id));

    const nextStatus = values.status;
    const fields = {
      title: values.title,
      description: values.description || null,
      projectId,
      owner: values.owner || null,
      priority: values.priority,
      status: nextStatus,
      type: values.type,
      dueDate: parseDate(values.dueDate),
      estimatedMinutes: parseMinutes(values.estimatedMinutes),
      energy: values.energy,
      context: values.context || null,
      completedAt: completedAtForStatus(nextStatus, existing?.completedAt),
    };

    let taskId = input.id;
    if (taskId) {
      await updateTask(userId, taskId, fields);
      await writeAudit(userId, 'update', taskId, {
        status: nextStatus,
        projectId,
        completedAt: fields.completedAt?.toISOString() ?? null,
      });
    } else {
      const created = await createTask(userId, fields);
      taskId = created.id;
      await writeAudit(userId, 'create', taskId, { title: values.title });
    }

    await setTaskLifeAreas(userId, taskId, lifeAreaIds);
    return { taskId };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function quickAddTask(
  input: QuickTaskAddInput,
): Promise<{ taskId?: string; error?: string }> {
  const parsed = quickTaskAddSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const projects = await listProjects(userId);
    const allowedProjects = new Set(projects.map((project) => project.id));
    const projectId =
      parsed.data.projectId && allowedProjects.has(parsed.data.projectId)
        ? parsed.data.projectId
        : null;

    const created = await createTask(userId, {
      title: parsed.data.title,
      projectId,
      status: 'next',
      energy: parsed.data.energy ?? 'medium',
      type: parsed.data.type ?? 'quick_task',
      estimatedMinutes: parseMinutes(parsed.data.estimatedMinutes),
    });
    await writeAudit(userId, 'create', created.id, {
      title: parsed.data.title,
      status: 'next',
      quick: true,
    });
    return { taskId: created.id };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function changeTaskStatus(input: {
  id: string;
  status: TaskStatus;
}): Promise<{ error?: string; waitingOffered?: boolean }> {
  try {
    const userId = await requireUserId();
    const existing = await getTask(userId, input.id);
    if (!existing) {
      return { error: 'notFound' };
    }
    const allowed = TASK_STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(input.status)) {
      return { error: 'invalidTransition' };
    }
    await updateTask(userId, input.id, {
      status: input.status,
      completedAt: completedAtForStatus(input.status, existing.completedAt),
    });
    await writeAudit(userId, 'status_change', input.id, {
      from: existing.status,
      to: input.status,
      completedAt:
        completedAtForStatus(input.status, existing.completedAt)?.toISOString() ??
        null,
    });
    return { waitingOffered: input.status === 'waiting' };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function spawnWaitingFromTask(input: {
  taskId: string;
  values: WaitingFromTaskInput;
}): Promise<{ error?: string }> {
  const parsed = waitingFromTaskSchema.safeParse(input.values);
  if (!parsed.success) {
    return { error: 'invalid' };
  }
  try {
    const userId = await requireUserId();
    const existing = await getTask(userId, input.taskId);
    if (!existing) {
      return { error: 'notFound' };
    }
    const waiting = await createWaitingItem(userId, {
      item: parsed.data.item,
      org: parsed.data.org || null,
      projectId: existing.projectId,
    });
    if (existing.status !== 'waiting') {
      const allowed = TASK_STATUS_TRANSITIONS[existing.status];
      if (allowed.includes('waiting')) {
        await updateTask(userId, existing.id, {
          status: 'waiting',
          completedAt: null,
        });
        await writeAudit(userId, 'status_change', existing.id, {
          from: existing.status,
          to: 'waiting',
          waitingItemId: waiting.id,
        });
      }
    }
    await createAuditLog(userId, {
      actor: 'user',
      action: 'create',
      entityType: 'waiting_item',
      entityId: waiting.id,
      after: { fromTaskId: existing.id },
    });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveTask(id: string): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    const existing = await getTask(userId, id);
    if (!existing) {
      return { error: 'notFound' };
    }
    await deleteTask(userId, id);
    await writeAudit(userId, 'delete', id, { deleted: true });
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}
