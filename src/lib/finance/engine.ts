import 'server-only';

import { DEFAULT_CURRENCY } from '@/lib/constants';
import { defaultPreferences } from '@/lib/db/schema';
import {
  bumpMerchantRuleHit,
  createTransaction,
  findHeuristicDuplicate,
  findTransactionByExternalId,
  getAccount,
  getMerchantRule,
  listAccounts,
  listTransactionCategories,
} from '@/lib/db/queries/finance';
import { getProfile } from '@/lib/db/queries/profiles';
import { createAuditLog } from '@/lib/db/queries/system';
import { getAdapter } from '@/lib/finance/adapters';
import { classifyTransactionAi } from '@/lib/finance/classify';
import { normalizeMerchant } from '@/lib/finance/merchant';
import type {
  IngestAdapterName,
  IngestResultRow,
  IngestSummary,
  NormalizedTxn,
} from '@/lib/finance/types';

function emptySummary(): IngestSummary {
  return {
    imported: 0,
    duplicates: 0,
    needsReview: 0,
    failed: 0,
    rows: [],
  };
}

async function resolveAccountId(
  userId: string,
  accountRef: string | null | undefined,
): Promise<string | null> {
  const accounts = await listAccounts(userId);
  if (accountRef) {
    const byId = accounts.find((row) => row.id === accountRef);
    if (byId) {
      return byId.id;
    }
    const byName = accounts.find(
      (row) => row.name.toLowerCase() === accountRef.toLowerCase(),
    );
    if (byName) {
      return byName.id;
    }
  }
  return (
    accounts.find((row) => row.name === 'Cash')?.id ??
    accounts.find((row) => row.accountType === 'cash')?.id ??
    accounts[0]?.id ??
    null
  );
}

async function classifyNormalized(
  userId: string,
  txn: NormalizedTxn,
  categories: { id: string; name: string }[],
  threshold: number,
): Promise<{
  categoryId: string | null;
  scope: NormalizedTxn['scope'];
  confidence: number;
  needsReview: boolean;
  classifySource: 'rule' | 'ai' | 'none' | 'explicit';
}> {
  if (txn.categoryId) {
    return {
      categoryId: txn.categoryId,
      scope: txn.scope ?? 'personal',
      confidence: txn.confidence ?? 1,
      needsReview: Boolean(txn.needsReview),
      classifySource: 'explicit',
    };
  }

  const key = normalizeMerchant(txn.merchant);
  if (key) {
    const rule = await getMerchantRule(userId, key);
    if (rule) {
      await bumpMerchantRuleHit(userId, rule.id);
      return {
        categoryId: rule.categoryId,
        scope: rule.scope ?? txn.scope ?? 'personal',
        confidence: 1,
        needsReview: false,
        classifySource: 'rule',
      };
    }
  }

  if (txn.needsReview && txn.parseError) {
    return {
      categoryId: null,
      scope: txn.scope ?? 'personal',
      confidence: txn.confidence ?? 0.2,
      needsReview: true,
      classifySource: 'none',
    };
  }

  try {
    const suggestion = await classifyTransactionAi({
      merchant: txn.merchant,
      amountMinor: txn.amountMinor,
      currency: txn.currency,
      type: txn.type,
      categories,
    });
    const below = suggestion.confidence < threshold;
    return {
      categoryId: below ? null : suggestion.categoryId,
      scope: suggestion.scope,
      confidence: suggestion.confidence,
      needsReview: below || !suggestion.categoryId,
      classifySource: suggestion.source,
    };
  } catch {
    return {
      categoryId: null,
      scope: txn.scope ?? 'personal',
      confidence: 0,
      needsReview: true,
      classifySource: 'none',
    };
  }
}

/**
 * Transaction engine: adapters never write — only this pipeline persists.
 */
export async function ingestNormalized(
  userId: string,
  items: NormalizedTxn[],
): Promise<IngestSummary> {
  const summary = emptySummary();
  if (items.length === 0) {
    return summary;
  }

  const [profile, categories] = await Promise.all([
    getProfile(userId),
    listTransactionCategories(userId),
  ]);
  const threshold =
    profile?.preferences?.confidence_threshold ??
    defaultPreferences.confidence_threshold;

  for (const txn of items) {
    const row: IngestResultRow = {
      status: 'failed',
      merchant: txn.merchant,
      amountMinor: txn.amountMinor,
      externalId: txn.externalId,
    };

    try {
      if (txn.amountMinor <= 0 && txn.parseError) {
        row.status = 'needs_review';
        row.reason = txn.parseError;
        summary.needsReview += 1;
        summary.rows.push(row);
        // Still persist a review shell so nothing is silently dropped.
      }

      const accountId = await resolveAccountId(userId, txn.accountRef);
      if (!accountId) {
        row.status = 'failed';
        row.reason = 'no_account';
        summary.failed += 1;
        summary.rows.push(row);
        continue;
      }

      if (txn.externalId) {
        const existing = await findTransactionByExternalId(
          userId,
          txn.externalId,
        );
        if (existing) {
          row.status = 'duplicate';
          row.transactionId = existing.id;
          row.reason = 'external_id';
          summary.duplicates += 1;
          summary.rows.push(row);
          continue;
        }
      }

      const occurredOn = new Date(`${txn.occurredOn}T00:00:00.000Z`);
      const heuristic = await findHeuristicDuplicate(userId, {
        accountId,
        occurredOn,
        amount: txn.amountMinor,
        merchant: txn.merchant,
      });
      if (heuristic && !txn.parseError) {
        row.status = 'duplicate';
        row.transactionId = heuristic.id;
        row.reason = 'heuristic';
        summary.duplicates += 1;
        summary.rows.push(row);
        continue;
      }

      const classified = await classifyNormalized(
        userId,
        txn,
        categories.map((c) => ({ id: c.id, name: c.name })),
        threshold,
      );

      const account = await getAccount(userId, accountId);
      const created = await createTransaction(userId, {
        accountId,
        occurredOn,
        occurredAt: txn.occurredAt ? new Date(txn.occurredAt) : null,
        amount: txn.amountMinor,
        currency: txn.currency || account?.currency || DEFAULT_CURRENCY,
        type: txn.type,
        merchant: txn.merchant,
        categoryId: classified.categoryId,
        scope: classified.scope ?? 'personal',
        projectId: txn.projectId ?? null,
        notes: txn.notes ?? null,
        source: txn.source,
        confidence: String(classified.confidence),
        sourceRef: txn.sourceRef ?? null,
        externalId: txn.externalId ?? null,
        cardLabel: txn.cardLabel ?? null,
        needsReview: classified.needsReview || Boolean(txn.needsReview),
      });

      await createAuditLog(userId, {
        actor: classified.classifySource === 'ai' ? 'ai' : 'user',
        action: 'ingest',
        entityType: 'transaction',
        entityId: created.id,
        after: {
          source: txn.source,
          amount: txn.amountMinor,
          merchant: txn.merchant,
          classifySource: classified.classifySource,
          needsReview: created.needsReview,
        },
      });

      if (created.needsReview) {
        row.status = 'needs_review';
        summary.needsReview += 1;
      } else {
        row.status = 'imported';
        summary.imported += 1;
      }
      row.transactionId = created.id;
      summary.rows.push(row);
    } catch (error) {
      row.status = 'failed';
      row.reason = error instanceof Error ? error.message : 'failed';
      summary.failed += 1;
      summary.rows.push(row);
    }
  }

  return summary;
}

export async function ingest(
  userId: string,
  adapterName: IngestAdapterName,
  rawInput: unknown,
): Promise<IngestSummary> {
  const adapter = getAdapter(adapterName);
  const normalized = adapter.parse(rawInput as never);
  return ingestNormalized(userId, normalized);
}
