import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/inbox/types';
import { createAiRecommendation, createAuditLog } from '@/lib/db/queries/system';
import { assembleCosSnapshot } from '@/lib/chief-of-staff/snapshot';
import { executeCosTool } from '@/lib/chief-of-staff/tool-handlers';
import { COS_TOOLS } from '@/lib/chief-of-staff/tools';
import {
  COS_MAX_TOOL_ROUNDS,
  COS_TIMEOUT_MS,
  type CosChatMessage,
  type CosProposal,
} from '@/lib/chief-of-staff/types';

function systemPrompt(locale: 'en' | 'ar', threshold: number): string {
  return [
    'You are Nasaq — the user\'s single Chief of Staff.',
    'You organize and suggest. The user decides. Never claim you changed anything.',
    'Speak as ONE coherent assistant. Never mention internal agents or tools by name.',
    locale === 'ar' ? 'Answer in Arabic.' : 'Answer in English.',
    `Confidence threshold is ${threshold}. If unsure, ask one clarifying question instead of proposing.`,
    'Use READ tools for facts. Use PROPOSE tools to create actionable cards — they never mutate data.',
    'Never move money or send messages. Follow-up drafts and finance answers are descriptive/handoff only.',
    'For investment/trading advice: decline and redirect to describing recorded spending.',
    'When capacity is tight or strategic fit is low, prefer Drop or Incubate in decision proposals.',
    'Ground answers in tool results. Do not invent projects, people, or money figures.',
  ].join(' ');
}

function fallbackAnswer(locale: 'en' | 'ar', snapshot: Awaited<ReturnType<typeof assembleCosSnapshot>>): string {
  const parts: string[] = [];
  if (locale === 'ar') {
    parts.push(
      `اليوم لديك نحو ${snapshot.capacity.productiveHours} ساعة إنتاجية.`,
    );
    if (snapshot.activeProjects[0]) {
      parts.push(`المشروع النشط الأبرز: ${snapshot.activeProjects[0].name}.`);
    }
    if (snapshot.overdueCommitments.length) {
      parts.push(`التزامات متأخرة: ${snapshot.overdueCommitments.length}.`);
    }
    parts.push('أنا أنظّم وأقترح. أنت تقرر.');
  } else {
    parts.push(
      `You have about ${snapshot.capacity.productiveHours}h of productive capacity today.`,
    );
    if (snapshot.activeProjects[0]) {
      parts.push(`Lead active project: ${snapshot.activeProjects[0].name}.`);
    }
    if (snapshot.overdueCommitments.length) {
      parts.push(`${snapshot.overdueCommitments.length} overdue commitment(s).`);
    }
    parts.push('I organize and suggest. You decide.');
  }
  return parts.join(' ');
}

export async function runChiefOfStaff(input: {
  userId: string;
  message: string;
  history?: CosChatMessage[];
  locale?: 'en' | 'ar';
  mode?: 'chat' | 'decision';
  demand?: string;
}): Promise<{
  reply: string;
  proposals: CosProposal[];
  clarifyingQuestion: string | null;
}> {
  const locale = input.locale ?? 'en';
  const snapshot = await assembleCosSnapshot(input.userId, locale);
  const sessionSubjectId = randomUUID();
  const proposals: CosProposal[] = [];
  let clarifyingQuestion: string | null = null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    return {
      reply: fallbackAnswer(locale, snapshot),
      proposals: [],
      clarifyingQuestion: null,
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

  const historyMsgs: Anthropic.MessageParam[] = (input.history ?? [])
    .slice(-6)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const userContent =
    input.mode === 'decision'
      ? [
          'Run the Decision Engine on this demand.',
          'Ask at most one clarifying question if confidence would be below threshold.',
          'Otherwise call propose_decision with one disposition.',
          `Demand: ${input.demand ?? input.message}`,
          `User note: ${input.message}`,
        ].join('\n')
      : input.message;

  const messages: Anthropic.MessageParam[] = [
    ...historyMsgs,
    {
      role: 'user',
      content: [
        userContent,
        '',
        'Compact snapshot (also available via read_snapshot):',
        JSON.stringify({
          dateYmd: snapshot.dateYmd,
          timeZone: snapshot.timeZone,
          capacity: snapshot.capacity,
          activeProjects: snapshot.activeProjects.slice(0, 6),
          overdueCommitments: snapshot.overdueCommitments.slice(0, 5),
          dueFollowUps: snapshot.dueFollowUps.slice(0, 5),
          overdueWaiting: snapshot.overdueWaiting.slice(0, 5),
          finance: snapshot.finance
            ? {
                expensesMinor: snapshot.finance.expensesMinor,
                incomeMinor: snapshot.finance.incomeMinor,
                topCategories: snapshot.finance.topCategories,
                currency: snapshot.finance.currency,
              }
            : null,
        }),
      ].join('\n'),
    },
  ];

  let reply = '';

  for (let round = 0; round < COS_MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 1200,
        temperature: 0,
        system: systemPrompt(locale, snapshot.confidenceThreshold),
        tools: COS_TOOLS,
        messages,
      },
      { timeout: COS_TIMEOUT_MS },
    );

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const texts = response.content.filter((b) => b.type === 'text');
    if (texts.length) {
      reply = texts.map((t) => (t.type === 'text' ? t.text : '')).join('\n').trim();
    }

    if (response.stop_reason === 'end_turn' || toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      if (block.type !== 'tool_use') continue;
      const args =
        block.input && typeof block.input === 'object'
          ? (block.input as Record<string, unknown>)
          : {};
      const result = await executeCosTool({
        userId: input.userId,
        name: block.name,
        args,
        snapshot,
      });
      if (result.proposals?.length) {
        for (const p of result.proposals) {
          if (p.confidence < snapshot.confidenceThreshold && p.kind !== 'follow_up_draft') {
            // Low confidence → convert to clarifying if present in content
            const content = result.content as { clarifyingQuestion?: string };
            if (content?.clarifyingQuestion) {
              clarifyingQuestion = content.clarifyingQuestion;
              continue;
            }
          }
          proposals.push(p);
        }
      }
      const contentObj = result.content as {
        needsClarification?: boolean;
        clarifyingQuestion?: string;
      };
      if (contentObj?.needsClarification && contentObj.clarifyingQuestion) {
        clarifyingQuestion = contentObj.clarifyingQuestion;
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result.content).slice(0, 12_000),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (!reply) {
    reply = clarifyingQuestion
      ? clarifyingQuestion
      : fallbackAnswer(locale, snapshot);
  }

  // Persist recommendations for every proposal
  const persisted: CosProposal[] = [];
  for (const proposal of proposals) {
    const row = await createAiRecommendation(input.userId, {
      subjectType: 'chief_of_staff',
      subjectId: proposal.entityId ?? sessionSubjectId,
      kind: proposal.kind,
      payload: {
        ...proposal.payload,
        title: proposal.title,
        rationale: proposal.rationale,
        handoffOnly: proposal.handoffOnly ?? false,
        entityType: proposal.entityType,
      },
      confidence: String(proposal.confidence),
      status: 'pending',
    });
    persisted.push({ ...proposal, id: row.id });
  }

  await createAuditLog(input.userId, {
    actor: 'ai',
    action: 'chief_of_staff_reply',
    entityType: 'chief_of_staff',
    entityId: sessionSubjectId,
    after: {
      proposalCount: persisted.length,
      clarifying: Boolean(clarifyingQuestion),
      mode: input.mode ?? 'chat',
    },
  });

  return {
    reply,
    proposals: persisted,
    clarifyingQuestion,
  };
}
