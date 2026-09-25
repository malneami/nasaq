import 'server-only';

import { randomUUID } from 'crypto';
import { requireUserId } from '@/lib/auth/session';
import { createCalendarEvent } from '@/lib/db/queries/calendar';
import {
  createAiRecommendation,
  createAuditLog,
  getAiRecommendation,
  updateAiRecommendation,
} from '@/lib/db/queries/system';
import { isProtected } from '@/lib/capacity/service';
import { confirmTodayOutcomes } from '@/lib/today/actions';
import { toFocusItem } from '@/lib/today/focus';
import { changeProjectState } from '@/lib/projects/actions';
import { AI_ACTION_TO_STATE } from '@/lib/projects/stages';
import { quickAddTask } from '@/lib/tasks/actions';
import { saveCommitment, saveWaitingItem } from '@/lib/people/actions';
import { createProject } from '@/lib/db/queries/projects';
import type { CosProposal, DecisionDisposition } from '@/lib/chief-of-staff/types';
import type { AiAction, ProjectState } from '@/lib/db/schema';

async function loadProposal(
  userId: string,
  proposal: CosProposal,
): Promise<CosProposal | null> {
  if (!proposal.id) return proposal;
  const row = await getAiRecommendation(userId, proposal.id);
  if (!row || row.status !== 'pending') return null;
  return {
    id: row.id,
    kind: row.kind as CosProposal['kind'],
    title: String((row.payload as { title?: string }).title ?? row.kind),
    rationale: String((row.payload as { rationale?: string }).rationale ?? ''),
    confidence: row.confidence != null ? Number(row.confidence) : 0.5,
    entityType: (row.payload as { entityType?: string }).entityType,
    entityId: row.subjectId,
    handoffOnly: Boolean((row.payload as { handoffOnly?: boolean }).handoffOnly),
    payload: row.payload as Record<string, unknown>,
  };
}

export async function acceptCosProposal(
  proposal: CosProposal,
  options?: { confirmOverLimit?: boolean },
): Promise<{
  error?: string;
  needsConfirm?: boolean;
  handoff?: { kind: string; draft?: string; message?: string };
  href?: string;
  activeCount?: number;
  activeLimit?: number;
}> {
  try {
    const userId = await requireUserId();
    const loaded = await loadProposal(userId, proposal);
    if (!loaded) {
      return { error: 'notFound' };
    }

    // Prohibited: money movement / send — handoff only
    if (loaded.kind === 'handoff_finance' || loaded.kind === 'follow_up_draft' || loaded.kind === 'handoff_message') {
      if (loaded.id) {
        await updateAiRecommendation(userId, loaded.id, { status: 'accepted' });
      }
      await createAuditLog(userId, {
        actor: 'user',
        action: 'accept_ai_proposal',
        entityType: 'ai_recommendation',
        entityId: loaded.id ?? undefined,
        after: {
          kind: loaded.kind,
          handoffOnly: true,
          originatedFrom: 'chief_of_staff',
        },
      });
      return {
        handoff: {
          kind: loaded.kind,
          draft: String(loaded.payload.draft ?? ''),
          message:
            loaded.kind === 'handoff_finance'
              ? 'Finance actions are read-only here. Open Finance to review.'
              : 'Message draft ready — copy and send yourself. Nasaq never sends.',
        },
      };
    }

    switch (loaded.kind) {
      case 'top3': {
        const items = Array.isArray(loaded.payload.items)
          ? (loaded.payload.items as Record<string, unknown>[])
          : [];
        const focus = items.map((item, index) =>
          toFocusItem({
            id: `cos-${index}-${String(item.taskId ?? index)}`,
            title: String(item.text ?? ''),
            taskId: typeof item.taskId === 'string' ? item.taskId : undefined,
            projectId:
              typeof item.projectId === 'string' ? item.projectId : null,
            projectName:
              typeof item.projectName === 'string' ? item.projectName : null,
            estimatedMinutes:
              typeof item.estimatedMinutes === 'number'
                ? item.estimatedMinutes
                : null,
            status: 'focus',
          }),
        );
        const result = await confirmTodayOutcomes({ items: focus });
        if (result.error) return { error: result.error };
        break;
      }

      case 'time_block': {
        const startsAt = new Date(String(loaded.payload.startsAt));
        const endsAt = new Date(String(loaded.payload.endsAt));
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
          return { error: 'invalid' };
        }
        if (await isProtected(userId, startsAt, endsAt)) {
          return { error: 'protectedTime' };
        }
        const created = await createCalendarEvent(userId, {
          title: String(loaded.payload.title ?? 'Focus'),
          startsAt,
          endsAt,
          eventType: 'deep_work',
          isProtected: false,
          projectId:
            typeof loaded.payload.projectId === 'string'
              ? loaded.payload.projectId
              : null,
          allDay: false,
        });
        await createAuditLog(userId, {
          actor: 'user',
          action: 'accept_ai_proposal',
          entityType: 'calendar_event',
          entityId: created.id,
          after: { originatedFrom: 'chief_of_staff', kind: 'time_block' },
        });
        break;
      }

      case 'project_state': {
        const action = String(loaded.payload.action) as AiAction;
        const state = AI_ACTION_TO_STATE[action] as ProjectState | undefined;
        const projectId = String(loaded.payload.projectId ?? '');
        if (!state || !projectId) return { error: 'invalid' };
        const result = await changeProjectState({
          projectId,
          state,
          confirmOverLimit: options?.confirmOverLimit,
        });
        if (result.needsConfirm) {
          return {
            needsConfirm: true,
            activeCount: result.activeCount,
            activeLimit: result.activeLimit,
          };
        }
        if (result.error) return { error: result.error };
        break;
      }

      case 'task_create': {
        const result = await quickAddTask({
          title: String(loaded.payload.title ?? ''),
          projectId:
            typeof loaded.payload.projectId === 'string'
              ? loaded.payload.projectId
              : '',
          estimatedMinutes:
            typeof loaded.payload.estimatedMinutes === 'number'
              ? String(loaded.payload.estimatedMinutes)
              : '',
        });
        if (result.error) return { error: result.error };
        break;
      }

      case 'commitment_create': {
        const result = await saveCommitment({
          values: {
            description: String(loaded.payload.description ?? ''),
            direction:
              loaded.payload.direction === 'they_promised'
                ? 'they_promised'
                : 'i_promised',
            contactId:
              typeof loaded.payload.contactId === 'string'
                ? loaded.payload.contactId
                : '',
            dueDate:
              typeof loaded.payload.dueDate === 'string'
                ? loaded.payload.dueDate
                : '',
          },
        });
        if (result.error) return { error: result.error };
        break;
      }

      case 'waiting_create': {
        const result = await saveWaitingItem({
          values: {
            item: String(loaded.payload.item ?? ''),
            contactId:
              typeof loaded.payload.contactId === 'string'
                ? loaded.payload.contactId
                : '',
            expectedAt:
              typeof loaded.payload.expectedAt === 'string'
                ? loaded.payload.expectedAt
                : '',
          },
        });
        if (result.error) return { error: result.error };
        break;
      }

      case 'decision_disposition': {
        const disposition = String(
          loaded.payload.disposition,
        ) as DecisionDisposition;
        const demand = String(loaded.payload.demand ?? loaded.title);
        const followOn = (loaded.payload.followOn ?? {}) as Record<
          string,
          unknown
        >;
        const routed = await acceptDecisionDisposition(userId, {
          disposition,
          demand,
          followOn,
        });
        if (routed.error) return routed;
        break;
      }

      default:
        return { error: 'unsupported' };
    }

    if (loaded.id) {
      await updateAiRecommendation(userId, loaded.id, { status: 'accepted' });
    }
    await createAuditLog(userId, {
      actor: 'user',
      action: 'accept_ai_proposal',
      entityType: 'ai_recommendation',
      entityId: loaded.id ?? undefined,
      after: {
        kind: loaded.kind,
        originatedFrom: 'chief_of_staff',
      },
    });
    return {};
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return { error: 'unauthenticated' };
    }
    return { error: 'failed' };
  }
}

async function acceptDecisionDisposition(
  userId: string,
  input: {
    disposition: DecisionDisposition;
    demand: string;
    followOn: Record<string, unknown>;
  },
): Promise<{ error?: string; href?: string }> {
  switch (input.disposition) {
    case 'do_now': {
      const title =
        typeof input.followOn.taskTitle === 'string'
          ? input.followOn.taskTitle
          : input.demand.slice(0, 200);
      const result = await quickAddTask({
        title,
        estimatedMinutes:
          typeof input.followOn.minutes === 'number'
            ? String(input.followOn.minutes)
            : '30',
      });
      return result.error ? { error: result.error } : { href: '/projects?tab=tasks' };
    }
    case 'schedule': {
      // Create a next task; time-block is a separate proposal if needed
      const result = await quickAddTask({
        title:
          typeof input.followOn.taskTitle === 'string'
            ? input.followOn.taskTitle
            : input.demand.slice(0, 200),
        estimatedMinutes:
          typeof input.followOn.minutes === 'number'
            ? String(input.followOn.minutes)
            : '60',
      });
      return result.error ? { error: result.error } : { href: '/today' };
    }
    case 'delegate': {
      const result = await saveCommitment({
        values: {
          description: input.demand.slice(0, 500),
          direction: 'they_promised',
        },
      });
      return result.error ? { error: result.error } : { href: '/people?tab=commitments' };
    }
    case 'waiting': {
      const result = await saveWaitingItem({
        values: { item: input.demand.slice(0, 500) },
      });
      return result.error ? { error: result.error } : { href: '/people?tab=waiting' };
    }
    case 'incubate': {
      const project = await createProject(userId, {
        name: (typeof input.followOn.projectName === 'string'
          ? input.followOn.projectName
          : input.demand
        ).slice(0, 120),
        state: 'incubator',
        stage: 'idea',
      });
      await createAuditLog(userId, {
        actor: 'user',
        action: 'accept_ai_proposal',
        entityType: 'project',
        entityId: project.id,
        after: { disposition: 'incubate', originatedFrom: 'decision_engine' },
      });
      return { href: `/projects/${project.id}` };
    }
    case 'drop': {
      await createAiRecommendation(userId, {
        subjectType: 'decision_engine',
        subjectId: randomUUID(),
        kind: 'drop',
        payload: {
          demand: input.demand,
          reason: 'User accepted Drop — soft discard',
        },
        confidence: '1',
        status: 'accepted',
      });
      await createAuditLog(userId, {
        actor: 'user',
        action: 'drop_demand',
        entityType: 'decision_engine',
        after: { demand: input.demand, originatedFrom: 'decision_engine' },
      });
      return {};
    }
    default:
      return { error: 'unsupported' };
  }
}

export async function dismissCosProposal(
  recommendationId: string,
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await updateAiRecommendation(userId, recommendationId, {
      status: 'dismissed',
    });
    await createAuditLog(userId, {
      actor: 'user',
      action: 'dismiss_ai_proposal',
      entityType: 'ai_recommendation',
      entityId: recommendationId,
      after: { originatedFrom: 'chief_of_staff' },
    });
    return {};
  } catch {
    return { error: 'failed' };
  }
}
