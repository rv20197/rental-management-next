import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BILL_PERIOD_MONTHS,
  addMonthsClamped,
  calculateBillPeriodDays,
  calculateBillPeriodEndDate,
  isValidBillPeriodMonths,
  normalizeBillPeriodMonths,
} from './period';

describe('normalizeBillPeriodMonths', () => {
  it('defaults to 1 month when no value is provided', () => {
    expect(normalizeBillPeriodMonths(undefined)).toBe(DEFAULT_BILL_PERIOD_MONTHS);
    expect(normalizeBillPeriodMonths(null)).toBe(DEFAULT_BILL_PERIOD_MONTHS);
    expect(normalizeBillPeriodMonths('')).toBe(DEFAULT_BILL_PERIOD_MONTHS);
  });

  it('defaults to 1 month for invalid or non-positive values', () => {
    expect(normalizeBillPeriodMonths('abc')).toBe(1);
    expect(normalizeBillPeriodMonths(0)).toBe(1);
    expect(normalizeBillPeriodMonths(-3)).toBe(1);
  });

  it('preserves a valid user-selected period', () => {
    expect(normalizeBillPeriodMonths(3)).toBe(3);
    expect(normalizeBillPeriodMonths('6')).toBe(6);
    expect(normalizeBillPeriodMonths(0.5)).toBe(0.5);
  });

  it('clamps values outside the supported bounds', () => {
    expect(normalizeBillPeriodMonths(0.1)).toBe(0.5);
    expect(normalizeBillPeriodMonths(100)).toBe(36);
  });
});

describe('isValidBillPeriodMonths', () => {
  it('accepts values within bounds', () => {
    expect(isValidBillPeriodMonths(1)).toBe(true);
    expect(isValidBillPeriodMonths(12)).toBe(true);
  });

  it('rejects values outside bounds or non-numeric', () => {
    expect(isValidBillPeriodMonths(0)).toBe(false);
    expect(isValidBillPeriodMonths(-1)).toBe(false);
    expect(isValidBillPeriodMonths(37)).toBe(false);
    expect(isValidBillPeriodMonths('abc')).toBe(false);
  });
});

describe('addMonthsClamped', () => {
  it('adds whole months normally', () => {
    const result = addMonthsClamped(new Date('2026-01-15T00:00:00Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('clamps Jan 31 + 1 month to Feb 28 in a non-leap year', () => {
    const result = addMonthsClamped(new Date('2026-01-31T00:00:00Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('clamps Jan 31 + 1 month to Feb 29 in a leap year', () => {
    const result = addMonthsClamped(new Date('2028-01-31T00:00:00Z'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('rolls over into the next year', () => {
    const result = addMonthsClamped(new Date('2026-12-15T00:00:00Z'), 2);
    expect(result.toISOString().slice(0, 10)).toBe('2027-02-15');
  });
});

describe('calculateBillPeriodEndDate', () => {
  it('defaults to 1 month from the due date', () => {
    expect(calculateBillPeriodEndDate('2026-05-01', DEFAULT_BILL_PERIOD_MONTHS)).toBe('2026-06-01');
  });

  it('supports a user-selected multi-month period', () => {
    expect(calculateBillPeriodEndDate('2026-05-01', 3)).toBe('2026-08-01');
    expect(calculateBillPeriodEndDate('2026-01-01', 12)).toBe('2027-01-01');
  });

  it('handles month-end due dates by clamping to the shorter month', () => {
    expect(calculateBillPeriodEndDate('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('handles leap-year February correctly', () => {
    expect(calculateBillPeriodEndDate('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('applies fractional (half-month) periods using the 30-day-month convention', () => {
    expect(calculateBillPeriodEndDate('2026-05-01', 0.5)).toBe('2026-05-16');
  });
});

describe('calculateBillPeriodDays', () => {
  it('computes the number of days spanned by the period', () => {
    expect(calculateBillPeriodDays('2026-05-01', '2026-06-01')).toBe(31);
  });
});
