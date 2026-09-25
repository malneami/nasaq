/**
 * Merchant string normalization — trim bank noise, collapse whitespace,
 * strip trailing city/branch codes commonly appended by Saudi banks.
 */

const NOISE = [
  /\s+SA$/i,
  /\s+KSA$/i,
  /\s+RIYADH$/i,
  /\s+JEDDAH$/i,
  /\s+DAMMAM$/i,
  /\s+#\d+$/,
  /\s+\*\d{4}$/,
  /^POS\s+/i,
  /^PURCHASE\s+/i,
  /^شراء\s+/i,
  /^عملية\s+/i,
];

export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) {
    return '';
  }
  let value = raw.trim().replace(/\s+/g, ' ');
  for (const pattern of NOISE) {
    value = value.replace(pattern, '').trim();
  }
  return value.toUpperCase();
}

export function merchantsMatch(a: string | null, b: string | null): boolean {
  const left = normalizeMerchant(a);
  const right = normalizeMerchant(b);
  if (!left || !right) {
    return false;
  }
  return left === right;
}
