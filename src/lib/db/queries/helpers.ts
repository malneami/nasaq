import { isNull, type Column } from 'drizzle-orm';

export function notDeleted(column: Column) {
  return isNull(column);
}

export function assertUserId(userId: string): string {
  if (!userId) {
    throw new Error('userId is required');
  }
  return userId;
}
