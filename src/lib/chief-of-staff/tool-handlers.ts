import 'server-only';

import { isInvestmentAdviceQuestion } from '@/lib/finance/intelligence/cfo';
import {
  getMonthlyFinanceSummary,
  getSubscriptions,
} from '@/lib/finance/intelligence/service';
import { proposeTopOutcomes } from '@/lib/today/propose';
import { findFreeSlots } from '@/lib/chief-of-staff/free-slots';
import type { CosProposal, CosSnapshot } from '@/lib/chief-of-staff/types';
import { listProjects } from '@/lib/db/queries/projects';
import { listTasks } from '@/lib/db/queries/tasks';

export type ToolHandlerResult = {
  content: unknown;
  proposals?: CosProposal[];
};

function clampConfidence(value: unknown, threshold: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(0.6, threshold);
  return Math.max(0, Math.min(1, n));
}

export async function executeCosTool(input: {
  userId: string;
  name: string;
  args: Record<string, unknown>;
  snapshot: CosSnapshot;
}): Promise<ToolHandlerResult> {
  const { userId, name, args, snapshot } = input;

  switch (name) {
    case 'read_snapshot':
      return { content: snapshot };

    case 'read_focus_candidates': {
      const minutes =
        typeof args.minutes === 'number'
          ? args.minutes
          : Math.round(snapshot.capacity.productiveHours * 60) || 120;
      const items = await proposeTopOutcomes(userId, {
        limit: 3,
        minutes: Math.max(30, minutes),
      });
      return {
        content: {
          candidates: items.map((i) => ({
            text: i.text,
            taskId: i.taskId,
            projectId: i.projectId,
            projectName: i.projectName,
            estimatedMinutes: i.estimatedMinutes,
          })),
        },
      };
    }

    case 'read_free_slots': {
      const minutes =
        typeof args.minutes === 'number' ? args.minutes : 60;
      const dateYmd =
        typeof args.dateYmd === 'string' ? args.dateYmd : snapshot.dateYmd;
      const slots = await findFreeSlots(userId, { dateYmd, minutes });
      return { content: { slots, productiveHours: snapshot.capacity.productiveHours } };
    }

    case 'read_project_load': {
      const [projects, tasks] = await Promise.all([
        listProjects(userId),
        listTasks(userId),
      ]);
      const openByProject = new Map<string, number>();
      for (const t of tasks) {
        if (!t.projectId) continue;
        if (t.status === 'completed' || t.status === 'cancelled') continue;
        openByProject.set(t.projectId, (openByProject.get(t.projectId) ?? 0) + 1);
      }
      const ranked = projects
        .map((p) => ({
          id: p.id,
          name: p.name,
          state: p.state,
          stage: p.stage,
          timeInvestedMinutes: p.timeInvestedMinutes,
          openTasks: openByProject.get(p.id) ?? 0,
          nextAction: p.nextAction,
        }))
        .sort(
          (a, b) =>
            b.timeInvestedMinutes + b.openTasks * 30 -
            (a.timeInvestedMinutes + a.openTasks * 30),
        )
        .slice(0, 10);
      return { content: { projects: ranked } };
    }

    case 'read_relationships':
      return {
        content: {
          overdueCommitments: snapshot.overdueCommitments,
          dueFollowUps: snapshot.dueFollowUps,
          overdueWaiting: snapshot.overdueWaiting,
        },
      };

    case 'read_finance_summary': {
      const question =
        typeof args.question === 'string' ? args.question : '';
      if (isInvestmentAdviceQuestion(question)) {
        return {
          content: {
            declined: true,
            message:
              snapshot.locale === 'ar'
                ? 'أصف إنفاقك المسجّل فقط ولا أقدّم نصائح استثمار أو تداول.'
                : 'I describe your recorded spending only and cannot advise on investments or trading.',
          },
        };
      }
      const [summary, subscriptions] = await Promise.all([
        getMonthlyFinanceSummary(userId),
        getSubscriptions(userId),
      ]);
      return {
        content: {
          declined: false,
          monthYmd: summary.monthYmd,
          incomeMinor: summary.incomeMinor,
          expensesMinor: summary.expensesMinor,
          netMinor: summary.netCashFlowMinor,
          savingsRatePct: summary.savingsRatePct,
          topCategories: summary.byCategory.slice(0, 6),
          byScope: summary.byScope,
          subscriptions: subscriptions.slice(0, 8).map((s) => ({
            merchant: s.merchant,
            monthlyCostMinor: s.monthlyCostMinor,
            cadenceDays: s.cadenceDays,
          })),
          currency: summary.currency,
        },
      };
    }

    case 'propose_top3': {
      const items = Array.isArray(args.items) ? args.items : [];
      const confidence = clampConfidence(args.confidence, snapshot.confidenceThreshold);
      const proposal: CosProposal = {
        kind: 'top3',
        title:
          snapshot.locale === 'ar' ? 'اقتراح أهم 3 نتائج اليوم' : "Today's Top 3 proposal",
        rationale: String(args.rationale ?? ''),
        confidence,
        payload: {
          items: items.slice(0, 3).map((raw) => {
            const row = raw as Record<string, unknown>;
            return {
              text: String(row.text ?? ''),
              taskId: typeof row.taskId === 'string' ? row.taskId : undefined,
              projectId:
                typeof row.projectId === 'string' ? row.projectId : undefined,
              projectName:
                typeof row.projectName === 'string' ? row.projectName : undefined,
              estimatedMinutes:
                typeof row.estimatedMinutes === 'number'
                  ? row.estimatedMinutes
                  : null,
            };
          }),
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_time_block': {
      const startsAt = String(args.startsAt ?? '');
      const endsAt = String(args.endsAt ?? '');
      const confidence = clampConfidence(args.confidence, snapshot.confidenceThreshold);
      const proposal: CosProposal = {
        kind: 'time_block',
        title: String(args.title ?? 'Focus block'),
        rationale: String(args.rationale ?? ''),
        confidence,
        entityType: 'calendar_event',
        payload: {
          title: String(args.title ?? 'Focus block'),
          startsAt,
          endsAt,
          taskId: typeof args.taskId === 'string' ? args.taskId : null,
          projectId: typeof args.projectId === 'string' ? args.projectId : null,
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_project_state': {
      const proposal: CosProposal = {
        kind: 'project_state',
        title: `Project → ${String(args.action)}`,
        rationale: String(args.rationale ?? ''),
        confidence: clampConfidence(args.confidence, snapshot.confidenceThreshold),
        entityType: 'project',
        entityId: typeof args.projectId === 'string' ? args.projectId : null,
        payload: {
          projectId: args.projectId,
          action: args.action,
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_task_create': {
      const proposal: CosProposal = {
        kind: 'task_create',
        title: String(args.title ?? 'New task'),
        rationale: String(args.rationale ?? ''),
        confidence: clampConfidence(args.confidence, snapshot.confidenceThreshold),
        entityType: 'task',
        payload: {
          title: args.title,
          projectId: args.projectId ?? null,
          estimatedMinutes: args.estimatedMinutes ?? null,
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_follow_up_draft': {
      const proposal: CosProposal = {
        kind: 'follow_up_draft',
        title:
          snapshot.locale === 'ar'
            ? `مسودة متابعة: ${String(args.contactName)}`
            : `Follow-up draft: ${String(args.contactName)}`,
        rationale: String(args.rationale ?? ''),
        confidence: clampConfidence(args.confidence, snapshot.confidenceThreshold),
        entityType: 'contact',
        entityId: typeof args.contactId === 'string' ? args.contactId : null,
        handoffOnly: true,
        payload: {
          contactId: args.contactId,
          contactName: args.contactName,
          draft: args.draft,
          channel: args.channel ?? 'message',
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_commitment_create': {
      const proposal: CosProposal = {
        kind: 'commitment_create',
        title: String(args.description ?? 'Commitment'),
        rationale: String(args.rationale ?? ''),
        confidence: clampConfidence(args.confidence, snapshot.confidenceThreshold),
        entityType: 'commitment',
        payload: {
          description: args.description,
          direction: args.direction,
          contactId: args.contactId ?? null,
          dueDate: args.dueDate ?? null,
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_waiting_create': {
      const proposal: CosProposal = {
        kind: 'waiting_create',
        title: String(args.item ?? 'Waiting'),
        rationale: String(args.rationale ?? ''),
        confidence: clampConfidence(args.confidence, snapshot.confidenceThreshold),
        entityType: 'waiting_item',
        payload: {
          item: args.item,
          contactId: args.contactId ?? null,
          expectedAt: args.expectedAt ?? null,
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    case 'propose_decision': {
      const confidence = clampConfidence(args.confidence, snapshot.confidenceThreshold);
      if (
        typeof args.clarifyingQuestion === 'string' &&
        args.clarifyingQuestion.trim() &&
        confidence < snapshot.confidenceThreshold
      ) {
        return {
          content: {
            needsClarification: true,
            clarifyingQuestion: args.clarifyingQuestion,
          },
        };
      }
      const proposal: CosProposal = {
        kind: 'decision_disposition',
        title: `Decision: ${String(args.disposition)}`,
        rationale: String(args.rationale ?? ''),
        confidence,
        payload: {
          disposition: args.disposition,
          demand: args.demand,
          followOn: args.followOn ?? {},
        },
      };
      return { content: { proposed: true }, proposals: [proposal] };
    }

    default:
      return { content: { error: `Unknown tool: ${name}` } };
  }
}
