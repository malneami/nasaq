import type { SelectInboxItem } from '@/lib/db/schema';
import {
  extractedFieldsSchema,
  type InboxAiPayload,
  type InboxItemDto,
} from '@/lib/inbox/types';

export function parseInboxPayload(value: unknown): InboxAiPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as InboxAiPayload;
}

export function parseExtracted(value: unknown) {
  const parsed = extractedFieldsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function toInboxItemDto(row: SelectInboxItem): InboxItemDto {
  const confidence =
    row.aiConfidence === null || row.aiConfidence === undefined
      ? null
      : Number(row.aiConfidence);

  return {
    id: row.id,
    rawText: row.rawText,
    inputKind: row.inputKind,
    aiType: row.aiType,
    aiConfidence: Number.isFinite(confidence) ? confidence : null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    payload: parseInboxPayload(row.aiPayload),
  };
}

export function entityHref(
  entityType: InboxItemDto['payload']['convertedEntityType'],
): string {
  switch (entityType) {
    case 'project':
    case 'idea':
      return '/projects';
    case 'task':
    case 'follow_up':
      return '/projects?tab=tasks';
    case 'person':
      return '/people';
    case 'commitment':
      return '/people?tab=commitments';
    case 'expense':
    case 'income':
      return '/finance';
    case 'event':
      return '/calendar';
    default:
      return '/inbox';
  }
}
