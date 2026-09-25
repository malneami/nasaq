/**
 * Safe merge for daily_briefs.content — never clobber finance/morning/shutdown keys.
 */
export function mergeBriefContent(
  prior: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    prior && typeof prior === 'object' && !Array.isArray(prior)
      ? { ...(prior as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}
