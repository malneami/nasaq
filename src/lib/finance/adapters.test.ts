import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeMerchant } from './merchant';
import { parseAmountToMinor, toWesternDigits } from './parse';
import { SmsAdapter } from './adapters/sms';
import { CsvAdapter } from './adapters/csv';
import { ManualAdapter } from './adapters/manual';

describe('normalizeMerchant', () => {
  it('strips bank noise and uppercases', () => {
    assert.equal(normalizeMerchant('  POS Starbucks Riyadh  '), 'STARBUCKS');
    assert.equal(normalizeMerchant('XYZ #12'), 'XYZ');
  });
});

describe('parseAmountToMinor', () => {
  it('parses western and arabic-indic amounts to integer minor units', () => {
    assert.equal(parseAmountToMinor('12.50'), 1250);
    assert.equal(parseAmountToMinor('١٢.٥٠'), 1250);
    assert.equal(parseAmountToMinor('-3.00'), -300);
  });
});

describe('toWesternDigits', () => {
  it('converts arabic-indic digits', () => {
    assert.equal(toWesternDigits('٢٠٢٦-٠٩-١٦'), '2026-09-16');
  });
});

describe('ManualAdapter', () => {
  it('emits NormalizedTxn with minor units', () => {
    const rows = new ManualAdapter().parse({
      amountMajor: 10.5,
      date: '2026-09-16',
      merchant: 'Cafe',
      type: 'expense',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.amountMinor, 1050);
    assert.equal(rows[0]?.source, 'manual');
  });
});

describe('CsvAdapter', () => {
  it('maps columns into NormalizedTxn rows', () => {
    const csv = [
      'Date,Amount,Description',
      '2026-09-01,25.00,Jarir Bookstore',
      '16/09/2026,١٠.٠٠,Tamimi',
    ].join('\n');
    const rows = new CsvAdapter().parse({
      csvText: csv,
      mapping: {
        date: 'Date',
        amount: 'Amount',
        merchant: 'Description',
      },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.amountMinor, 2500);
    assert.equal(rows[0]?.merchant, 'Jarir Bookstore');
    assert.equal(rows[1]?.amountMinor, 1000);
  });
});

describe('SmsAdapter', () => {
  it('parses a Saudi-style English SMS', () => {
    const rows = new SmsAdapter().parse({
      text: 'Purchase SAR 45.00 at Starbucks on 16/09/2026 using card *1234',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.amountMinor, 4500);
    assert.equal(rows[0]?.type, 'expense');
    assert.ok(rows[0]?.merchant?.toLowerCase().includes('starbucks'));
    assert.equal(rows[0]?.cardLabel, '•••• 1234');
    assert.equal(rows[0]?.needsReview, false);
  });

  it('flags unparseable SMS for review instead of dropping', () => {
    const rows = new SmsAdapter().parse({
      text: 'مرحبا بك في تطبيق البنك',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.needsReview, true);
    assert.equal(rows[0]?.parseError, 'unparseable_sms');
  });
});
