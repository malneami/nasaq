import { z } from 'zod';

export const INBOX_TYPES = [
  'task',
  'idea',
  'project',
  'note',
  'person',
  'follow_up',
  'commitment',
  'expense',
  'income',
  'event',
] as const;

export type InboxType = (typeof INBOX_TYPES)[number];
export type InboxInputKind = 'text' | 'voice' | 'link' | 'note' | 'manual_txn';
export type InboxStatus = 'unprocessed' | 'processed' | 'discarded';

export const extractedFieldsSchema = z.object({
  person_name: z.string().min(1).optional(),
  project_hint: z.string().min(1).optional(),
  due_date_iso: z.string().min(1).optional(),
  amount_minor: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  merchant: z.string().min(1).optional(),
  category_hint: z.string().min(1).optional(),
  direction: z.enum(['i_promised', 'they_promised']).optional(),
  event_start_iso: z.string().min(1).optional(),
  event_end_iso: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

export const classifyToolInputSchema = z.object({
  type: z.enum(INBOX_TYPES),
  confidence: z.number().min(0).max(1),
  title: z.string().min(1).max(200),
  extracted: extractedFieldsSchema.default({}),
  needs_confirmation: z.boolean(),
  clarifying_question: z.string().min(1).optional(),
});

export type ExtractedFields = z.infer<typeof extractedFieldsSchema>;
export type ClassifyToolInput = z.infer<typeof classifyToolInputSchema>;

export type ClassificationStatus =
  'pending' | 'suggested' | 'needs_confirmation' | 'failed';

export type InboxAiPayload = {
  title?: string;
  extracted?: ExtractedFields;
  needs_confirmation?: boolean;
  clarifying_question?: string;
  classificationStatus?: ClassificationStatus;
  classifyError?: string;
  ideaDisposition?: 'project' | 'note';
  convertedEntityType?: InboxType | 'note';
  convertedEntityId?: string;
  convertedHref?: string;
};

export type InboxItemDto = {
  id: string;
  rawText: string;
  inputKind: InboxInputKind;
  aiType: InboxType | null;
  aiConfidence: number | null;
  status: InboxStatus;
  createdAt: string;
  payload: InboxAiPayload;
};

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
export const CLASSIFY_TIMEOUT_MS = 20_000;
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
