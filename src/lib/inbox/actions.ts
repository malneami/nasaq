'use server';

import { requireUserId } from '@/lib/auth/session';
import { createAuditLog } from '@/lib/db/queries/system';
import {
  createInboxItem,
  getInboxItem,
  listInboxItems,
  updateInboxItem,
} from '@/lib/db/queries/inbox';
import { convertInboxItem, majorToMinorAmount } from '@/lib/inbox/convert';
import { toInboxItemDto } from '@/lib/inbox/payload';
import {
  INBOX_TYPES,
  extractedFieldsSchema,
  type ExtractedFields,
  type InboxAiPayload,
  type InboxItemDto,
} from '@/lib/inbox/types';
import type { InboxInputKind, InboxType } from '@/lib/db/schema';
import { DEFAULT_CURRENCY } from '@/lib/constants';

function asError(error: unknown): string {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return 'unauthenticated';
  }
  if (error instanceof Error && error.message === 'AMOUNT_REQUIRED') {
    return 'amountRequired';
  }
  if (error instanceof Error && error.message === 'NO_CASH_ACCOUNT') {
    return 'noCashAccount';
  }
  if (error instanceof Error && error.message === 'TYPE_REQUIRED') {
    return 'typeRequired';
  }
  return 'failed';
}

export async function listInbox(): Promise<InboxItemDto[]> {
  const userId = await requireUserId();
  const rows = await listInboxItems(userId);
  return rows.map(toInboxItemDto);
}

export async function captureInboxItem(input: {
  rawText: string;
  inputKind: InboxInputKind;
}): Promise<{ item?: InboxItemDto; error?: string }> {
  try {
    const userId = await requireUserId();
    const rawText = input.rawText.trim();
    if (!rawText) {
      return { error: 'empty' };
    }

    const row = await createInboxItem(userId, {
      rawText,
      inputKind: input.inputKind,
      status: 'unprocessed',
      aiPayload: { classificationStatus: 'pending' },
    });

    return { item: toInboxItemDto(row) };
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function discardInboxItems(
  ids: string[],
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await Promise.all(
      ids.map((id) =>
        updateInboxItem(userId, id, {
          status: 'discarded',
        }),
      ),
    );
    return {};
  } catch (error) {
    return { error: asError(error) };
  }
}

export async function acceptInboxItem(input: {
  itemId: string;
  type: InboxType;
  title: string;
  extracted: ExtractedFields;
  ideaDisposition?: 'project' | 'note';
}): Promise<{ item?: InboxItemDto; href?: string; error?: string }> {
  try {
    const userId = await requireUserId();
    const row = await getInboxItem(userId, input.itemId);
    if (!row || row.status !== 'unprocessed') {
      return { error: 'notFound' };
    }

    if (!INBOX_TYPES.includes(input.type as (typeof INBOX_TYPES)[number])) {
      return { error: 'typeRequired' };
    }

    const extracted = extractedFieldsSchema.parse(input.extracted ?? {});
    const conversion = await convertInboxItem({
      userId,
      type: input.type,
      title: input.title.trim() || row.rawText.slice(0, 80),
      rawText: row.rawText,
      extracted,
      ideaDisposition: input.ideaDisposition,
    });

    const payload: InboxAiPayload = {
      ...parseInboxPayloadSafe(row.aiPayload),
      title: input.title.trim(),
      extracted,
      needs_confirmation: false,
      classificationStatus: 'suggested',
      ideaDisposition: input.ideaDisposition,
      convertedEntityType: conversion.entityType,
      convertedEntityId: conversion.entityId,
      convertedHref: conversion.href,
    };

    const updated = await updateInboxItem(userId, row.id, {
      status: 'processed',
      aiType: input.type,
      aiPayload: payload,
    });

    await createAuditLog(userId, {
      actor: 'user',
      action: 'convert',
      entityType: 'inbox_item',
      entityId: row.id,
      after: {
        convertedEntityType: conversion.entityType,
        convertedEntityId: conversion.entityId ?? null,
      },
    });

    return {
      item: updated ? toInboxItemDto(updated) : undefined,
      href: conversion.href,
    };
  } catch (error) {
    return { error: asError(error) };
  }
}

function parseInboxPayloadSafe(value: unknown): InboxAiPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as InboxAiPayload;
}

export async function captureManualTransaction(input: {
  amountMajor: number;
  date: string;
  merchant: string;
  type: 'expense' | 'income';
}): Promise<{ item?: InboxItemDto; href?: string; error?: string }> {
  try {
    const userId = await requireUserId();
    if (!Number.isFinite(input.amountMajor) || input.amountMajor <= 0) {
      return { error: 'amountRequired' };
    }

    const amountMinor = majorToMinorAmount(input.amountMajor, DEFAULT_CURRENCY);
    const title =
      input.type === 'income'
        ? `Income: ${input.merchant || 'Cash'}`
        : `Expense: ${input.merchant || 'Cash'}`;
    const rawText = [
      title,
      `${input.amountMajor} ${DEFAULT_CURRENCY}`,
      input.date,
    ]
      .filter(Boolean)
      .join(' — ');

    const extracted: ExtractedFields = {
      amount_minor: amountMinor,
      currency: DEFAULT_CURRENCY,
      merchant: input.merchant.trim() || undefined,
      due_date_iso: input.date,
    };

    const created = await createInboxItem(userId, {
      rawText,
      inputKind: 'manual_txn',
      aiType: input.type,
      aiConfidence: '1.000',
      status: 'unprocessed',
      aiPayload: {
        title,
        extracted,
        needs_confirmation: false,
        classificationStatus: 'suggested',
      },
    });

    return acceptInboxItem({
      itemId: created.id,
      type: input.type,
      title,
      extracted,
    });
  } catch (error) {
    return { error: asError(error) };
  }
}
