import type Anthropic from '@anthropic-ai/sdk';

/**
 * READ tools return data. PROPOSE tools return structured proposals — never mutate.
 */
export const COS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_snapshot',
    description:
      'Return the compact system snapshot already assembled for this turn (capacity, projects, relationships, finance aggregates).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'read_focus_candidates',
    description:
      'Propose Top 3 focus candidates from next actions and deadlines (deterministic). Does not confirm them.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        minutes: { type: 'number', description: 'Available minutes window' },
      },
    },
  },
  {
    name: 'read_free_slots',
    description:
      'Find free NON-protected time slots for a duration today. Never returns protected/family blocks.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['minutes'],
      properties: {
        minutes: { type: 'number' },
        dateYmd: { type: 'string' },
      },
    },
  },
  {
    name: 'read_project_load',
    description:
      'Return projects ranked by time invested and open task load.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'read_relationships',
    description:
      'Return overdue commitments, due follow-ups, and overdue waiting items.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'read_finance_summary',
    description:
      'Return month finance aggregates (descriptive only). Declines investment advice.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_top3',
    description:
      'Create a Top 3 proposal card. Does NOT confirm — user must Accept.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'rationale', 'confidence'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['text'],
            properties: {
              text: { type: 'string' },
              taskId: { type: 'string' },
              projectId: { type: 'string' },
              projectName: { type: 'string' },
              estimatedMinutes: { type: 'number' },
            },
          },
        },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_time_block',
    description:
      'Propose blocking free NON-protected time for work. Does not write the calendar.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'startsAt', 'endsAt', 'rationale', 'confidence'],
      properties: {
        title: { type: 'string' },
        startsAt: { type: 'string' },
        endsAt: { type: 'string' },
        taskId: { type: 'string' },
        projectId: { type: 'string' },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_project_state',
    description:
      'Propose a project state change (activate/maintain/incubate/reassess/stop). Does not mutate.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['projectId', 'action', 'rationale', 'confidence'],
      properties: {
        projectId: { type: 'string' },
        action: {
          type: 'string',
          enum: ['activate', 'maintain', 'incubate', 'reassess', 'stop'],
        },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_task_create',
    description: 'Propose creating a task. Does not create it until Accept.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'rationale', 'confidence'],
      properties: {
        title: { type: 'string' },
        projectId: { type: 'string' },
        estimatedMinutes: { type: 'number' },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_follow_up_draft',
    description:
      'Draft a follow-up MESSAGE text (never send). Handoff only.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['contactId', 'contactName', 'draft', 'rationale', 'confidence'],
      properties: {
        contactId: { type: 'string' },
        contactName: { type: 'string' },
        draft: { type: 'string' },
        channel: { type: 'string', enum: ['message', 'email', 'whatsapp'] },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_commitment_create',
    description: 'Propose creating a commitment (they_promised or i_promised).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['description', 'direction', 'rationale', 'confidence'],
      properties: {
        description: { type: 'string' },
        direction: { type: 'string', enum: ['i_promised', 'they_promised'] },
        contactId: { type: 'string' },
        dueDate: { type: 'string' },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_waiting_create',
    description: 'Propose creating a waiting item.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['item', 'rationale', 'confidence'],
      properties: {
        item: { type: 'string' },
        contactId: { type: 'string' },
        expectedAt: { type: 'string' },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  },
  {
    name: 'propose_decision',
    description:
      'Recommend a Decision Engine disposition for a demand. Bias toward Drop/Incubate when low fit or over capacity.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['disposition', 'demand', 'rationale', 'confidence'],
      properties: {
        disposition: {
          type: 'string',
          enum: ['do_now', 'schedule', 'delegate', 'waiting', 'incubate', 'drop'],
        },
        demand: { type: 'string' },
        clarifyingQuestion: { type: 'string' },
        rationale: { type: 'string' },
        confidence: { type: 'number' },
        followOn: {
          type: 'object',
          properties: {
            taskTitle: { type: 'string' },
            projectName: { type: 'string' },
            contactName: { type: 'string' },
            draftMessage: { type: 'string' },
            minutes: { type: 'number' },
          },
        },
      },
    },
  },
];
