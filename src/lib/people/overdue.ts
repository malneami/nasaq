/**
 * Deterministic overdue / due helpers for relationships.
 * No AI — pure date math against a YYYY-MM-DD "today" in the user zone.
 */

export function toYmd(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/** Open commitment is overdue when due_date < today. */
export function isCommitmentOverdue(input: {
  status: string;
  dueDate: Date | string | null | undefined;
  todayYmd: string;
}): boolean {
  if (input.status === 'fulfilled' || input.status === 'cancelled') {
    return false;
  }
  if (input.status === 'overdue') {
    return true;
  }
  const due = toYmd(input.dueDate);
  return Boolean(due && due < input.todayYmd && input.status === 'open');
}

/**
 * Waiting item is overdue when expected_at (or follow_up_at) < today
 * and status is still waiting (or already marked overdue).
 */
export function isWaitingOverdue(input: {
  status: string;
  expectedAt: Date | string | null | undefined;
  followUpAt: Date | string | null | undefined;
  todayYmd: string;
}): boolean {
  if (input.status === 'received' || input.status === 'cancelled') {
    return false;
  }
  if (input.status === 'overdue') {
    return true;
  }
  if (input.status !== 'waiting') {
    return false;
  }
  const due = toYmd(input.expectedAt) ?? toYmd(input.followUpAt);
  return Boolean(due && due < input.todayYmd);
}

/** Contact needs follow-up when next_follow_up_at <= today. */
export function isFollowUpDue(input: {
  nextFollowUpAt: Date | string | null | undefined;
  todayYmd: string;
}): boolean {
  const due = toYmd(input.nextFollowUpAt);
  return Boolean(due && due <= input.todayYmd);
}

export function daysWaiting(
  requestedAt: Date | string | null | undefined,
  todayYmd: string,
): number {
  const requested = toYmd(requestedAt);
  if (!requested) {
    return 0;
  }
  const from = Date.parse(`${requested}T00:00:00.000Z`);
  const to = Date.parse(`${todayYmd}T00:00:00.000Z`);
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export function daysUntil(
  dueYmd: string | null | undefined,
  todayYmd: string,
): number | null {
  if (!dueYmd) {
    return null;
  }
  const from = Date.parse(`${todayYmd}T00:00:00.000Z`);
  const to = Date.parse(`${dueYmd}T00:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

export function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
