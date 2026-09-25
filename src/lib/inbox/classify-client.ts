import type { InboxItemDto } from '@/lib/inbox/types';

let classifyChain: Promise<void> = Promise.resolve();

export async function classifyInboxItem(
  itemId: string,
  force = false,
): Promise<InboxItemDto | null> {
  const response = await fetch('/api/inbox/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, force }),
  });
  const data = (await response.json()) as {
    item?: InboxItemDto | null;
    error?: string;
  };
  return data.item ?? null;
}

export function enqueueClassify(
  itemId: string,
  force = false,
  onDone?: (item: InboxItemDto | null) => void,
) {
  classifyChain = classifyChain
    .then(async () => {
      const item = await classifyInboxItem(itemId, force);
      onDone?.(item);
    })
    .catch(() => {
      onDone?.(null);
    });
}
