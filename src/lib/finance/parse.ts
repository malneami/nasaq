/**
 * Money / date parsing helpers for CSV and SMS adapters.
 * Arabic-Indic digits supported. Amounts return integer minor units.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN = '۰۱۲۳۴۵۶۷۸۹';

export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (char) => {
    const ar = ARABIC_INDIC.indexOf(char);
    if (ar >= 0) {
      return String(ar);
    }
    const fa = EASTERN.indexOf(char);
    return fa >= 0 ? String(fa) : char;
  });
}

/** Parse a human amount string into minor units (halalas). Never floats in storage. */
export function parseAmountToMinor(
  raw: string,
  currencyDigits = 2,
): number | null {
  const cleaned = toWesternDigits(raw)
    .replace(/[^\d.,\-]/g, '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '.') {
    return null;
  }
  const negative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/^-/, '');
  const parts = unsigned.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').padEnd(currencyDigits, '0').slice(0, currencyDigits);
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) {
    return null;
  }
  const minor =
    Number.parseInt(whole, 10) * 10 ** currencyDigits +
    (frac ? Number.parseInt(frac, 10) : 0);
  if (!Number.isFinite(minor)) {
    return null;
  }
  return negative ? -minor : minor;
}

export function parseFlexibleDate(raw: string): string | null {
  const value = toWesternDigits(raw).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(value);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  const mdy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(value);
  if (mdy) {
    // Ambiguous — prefer DMY for Saudi banks; if month > 12 swap.
    const a = Number(mdy[1]);
    const b = Number(mdy[2]);
    if (a > 12 && b <= 12) {
      return `${mdy[3]}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }
  return null;
}
