'use server';

import { requireUserId } from '@/lib/auth/session';
import {
  archiveLifeArea,
  createLifeArea,
  listLifeAreaLinkedGoals,
  listLifeAreaLinkedProjects,
  listLifeAreas,
  listLifeAreasWithCounts,
  reorderLifeAreas,
  updateLifeArea,
} from '@/lib/db/queries/life-areas';
import { lifeAreaFormSchema } from '@/lib/validations/goal';

export type LifeAreaDto = {
  id: string;
  name: string;
  sortOrder: number;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  archivedAt: string | null;
  activeGoalCount: number;
  activeProjectCount: number;
};

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  return 'failed';
}

function toDto(
  area: Awaited<ReturnType<typeof listLifeAreasWithCounts>>[number],
): LifeAreaDto {
  return {
    id: area.id,
    name: area.name,
    sortOrder: area.sortOrder,
    icon: area.icon,
    color: area.color,
    isDefault: area.isDefault,
    archivedAt: area.archivedAt?.toISOString() ?? null,
    activeGoalCount: area.activeGoalCount,
    activeProjectCount: area.activeProjectCount,
  };
}

export async function listLifeAreaRows(includeArchived = true): Promise<{
  areas?: LifeAreaDto[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const areas = await listLifeAreasWithCounts(userId, { includeArchived });
    return { areas: areas.map(toDto) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function listPickerLifeAreas(): Promise<{
  areas?: LifeAreaDto[];
  error?: string;
}> {
  return listLifeAreaRows(false);
}

export async function createLifeAreaRow(input: {
  name: string;
  icon: string;
  color: string;
}): Promise<{ area?: LifeAreaDto; error?: string }> {
  try {
    const parsed = lifeAreaFormSchema.safeParse(input);
    if (!parsed.success) {
      return { error: 'invalid' };
    }
    const userId = await requireUserId();
    const existing = await listLifeAreas(userId, { includeArchived: true });
    const sortOrder =
      existing.reduce((max, area) => Math.max(max, area.sortOrder), 0) + 1;
    const row = await createLifeArea(userId, {
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color,
      sortOrder,
      isDefault: false,
    });
    return {
      area: {
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
        icon: row.icon,
        color: row.color,
        isDefault: row.isDefault,
        archivedAt: null,
        activeGoalCount: 0,
        activeProjectCount: 0,
      },
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function updateLifeAreaRow(
  id: string,
  input: { name: string; icon: string; color: string },
): Promise<{ error?: string }> {
  try {
    const parsed = lifeAreaFormSchema.safeParse(input);
    if (!parsed.success) {
      return { error: 'invalid' };
    }
    const userId = await requireUserId();
    await updateLifeArea(userId, id, parsed.data);
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function archiveLifeAreaRow(id: string): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await archiveLifeArea(userId, id);
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function reorderLifeAreaRows(
  orderedIds: string[],
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await reorderLifeAreas(userId, orderedIds);
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function getLifeAreaDetail(id: string): Promise<{
  area?: LifeAreaDto;
  goals?: { id: string; title: string; status: string; progress: number }[];
  projects?: { id: string; name: string; state: string }[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const areas = await listLifeAreasWithCounts(userId, { includeArchived: true });
    const area = areas.find((item) => item.id === id);
    if (!area) {
      return { error: 'notFound' };
    }
    const [goals, projects] = await Promise.all([
      listLifeAreaLinkedGoals(userId, id),
      listLifeAreaLinkedProjects(userId, id),
    ]);
    return { area: toDto(area), goals, projects };
  } catch (error) {
    return { error: asError(error) };
  }
}
