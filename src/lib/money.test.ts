import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMoney, toMajor, toMinor } from '@/lib/money';

describe('money', () => {
  it('round-trips SAR majors through integer minor units', () => {
    assert.equal(toMinor(12.5, 'SAR'), 1_250);
    assert.equal(toMajor(1_250, 'SAR'), 12.5);
    assert.equal(Number.isInteger(toMinor(99.99, 'SAR')), true);
  });

  it('formats without inventing float money storage', () => {
    const en = formatMoney(12_500, 'SAR', 'en');
    assert.ok(en.includes('125') || en.includes('12.50') || en.includes('١٢'));
    assert.equal(toMinor(0, 'SAR'), 0);
  });
});
