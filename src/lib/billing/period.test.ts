import { describe, expect, it } from 'vitest';
import {
  BILL_PERIOD_OPTIONS,
  CUSTOM_BILL_PERIOD_VALUE,
  DEFAULT_BILL_PERIOD_MONTHS,
  addMonthsClamped,
  applyBillPeriodOptionChange,
  applyBillingEndDateChange,
  applyBillingStartDateChange,
  billPeriodTypeOf,
  calculateBillPeriodDays,
  calculateBillPeriodEndDate,
  calculateCalendarMonthsEquivalent,
  getBillPeriodOptionByValue,
  isCustomBillPeriodValue,
  isValidBillPeriodMonths,
  matchPredefinedBillPeriod,
  normalizeBillPeriodMonths,
  resolveBillPeriodMonths,
  validateBillingDateRange,
} from './period';

describe('BILL_PERIOD_OPTIONS', () => {
  it('offers 1, 2, 3, 6, 12 month options plus Custom Dates', () => {
    expect(BILL_PERIOD_OPTIONS.map((o) => o.value)).toEqual(['1', '2', '3', '6', '12', 'custom']);
    expect(BILL_PERIOD_OPTIONS.find((o) => o.value === '1')?.months).toBe(1);
    expect(BILL_PERIOD_OPTIONS.find((o) => o.value === 'custom')?.months).toBeNull();
  });

  it('defaults to the 1-month option', () => {
    expect(getBillPeriodOptionByValue('1')?.months).toBe(DEFAULT_BILL_PERIOD_MONTHS);
  });
});

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

describe('isCustomBillPeriodValue / billPeriodTypeOf', () => {
  it('identifies the custom option', () => {
    expect(isCustomBillPeriodValue('custom')).toBe(true);
    expect(isCustomBillPeriodValue('1')).toBe(false);
    expect(billPeriodTypeOf('custom')).toBe('custom');
    expect(billPeriodTypeOf('3')).toBe('predefined');
    expect(billPeriodTypeOf(undefined)).toBe('predefined');
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

describe('calculateBillPeriodEndDate (inclusive last billed day)', () => {
  it('calculates the predefined-period examples from a 01-Jan-2026 Start Date', () => {
    expect(calculateBillPeriodEndDate('2026-01-01', 1)).toBe('2026-01-31');
    expect(calculateBillPeriodEndDate('2026-01-01', 2)).toBe('2026-02-28');
    expect(calculateBillPeriodEndDate('2026-01-01', 3)).toBe('2026-03-31');
    expect(calculateBillPeriodEndDate('2026-01-01', 6)).toBe('2026-06-30');
    expect(calculateBillPeriodEndDate('2026-01-01', 12)).toBe('2026-12-31');
  });

  it('defaults to 1 month from the Billing Start Date', () => {
    expect(calculateBillPeriodEndDate('2026-05-01', DEFAULT_BILL_PERIOD_MONTHS)).toBe('2026-05-31');
  });

  it('supports a user-selected multi-month period', () => {
    expect(calculateBillPeriodEndDate('2026-05-01', 3)).toBe('2026-07-31');
  });

  it('handles month-end Start Dates by clamping to the shorter month', () => {
    expect(calculateBillPeriodEndDate('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('handles leap-year February correctly', () => {
    expect(calculateBillPeriodEndDate('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('applies fractional (legacy half-month) periods using the 30-day-month convention', () => {
    expect(calculateBillPeriodEndDate('2026-05-01', 0.5)).toBe('2026-05-15');
  });
});

describe('calculateBillPeriodDays (inclusive of both ends)', () => {
  it('computes the number of days spanned by a 1-month period', () => {
    expect(calculateBillPeriodDays('2026-05-01', '2026-05-31')).toBe(31);
  });

  it('matches the spec Custom Dates example (15-Sep-2026 to 25-Oct-2026 = 41 days)', () => {
    expect(calculateBillPeriodDays('2026-09-15', '2026-10-25')).toBe(41);
  });
});

describe('calculateCalendarMonthsEquivalent (Custom Dates proration)', () => {
  it('equals 1 for a full calendar month', () => {
    expect(calculateCalendarMonthsEquivalent('2026-01-01', '2026-01-31')).toBe(1);
    expect(calculateCalendarMonthsEquivalent('2026-02-01', '2026-02-28')).toBe(1);
  });

  it('handles a leap-year February as a full month', () => {
    expect(calculateCalendarMonthsEquivalent('2028-02-01', '2028-02-29')).toBe(1);
  });

  it('prorates a range spanning parts of two months', () => {
    // Jan 10 - Feb 25: 22/31 (Jan) + 25/28 (Feb)
    expect(calculateCalendarMonthsEquivalent('2026-01-10', '2026-02-25')).toBeCloseTo(22 / 31 + 25 / 28, 4);
  });

  it('prorates the spec Custom Dates example (10-Jan-2026 to 25-Feb-2026)', () => {
    const months = calculateCalendarMonthsEquivalent('2026-01-10', '2026-02-25');
    expect(months).toBeGreaterThan(1.6);
    expect(months).toBeLessThan(1.61);
  });

  it('returns 0 for an inverted range', () => {
    expect(calculateCalendarMonthsEquivalent('2026-02-01', '2026-01-01')).toBe(0);
  });
});

describe('matchPredefinedBillPeriod', () => {
  it('matches a range that exactly equals a predefined option', () => {
    expect(matchPredefinedBillPeriod('2026-01-01', '2026-03-31')?.value).toBe('3');
  });

  it('returns null for a range that does not match any predefined option', () => {
    expect(matchPredefinedBillPeriod('2026-01-10', '2026-02-25')).toBeNull();
  });
});

describe('resolveBillPeriodMonths', () => {
  it('uses the fixed month count for a predefined option', () => {
    expect(resolveBillPeriodMonths('3', '2026-01-01', '2026-03-31')).toBe(3);
  });

  it('uses calendar-prorated months for Custom Dates', () => {
    expect(resolveBillPeriodMonths(CUSTOM_BILL_PERIOD_VALUE, '2026-01-10', '2026-02-25')).toBeCloseTo(
      22 / 31 + 25 / 28,
      4,
    );
  });
});

describe('validateBillingDateRange', () => {
  it('requires both Start and End Date', () => {
    expect(validateBillingDateRange(undefined, '2026-01-31')).toMatch(/Start Date/);
    expect(validateBillingDateRange('2026-01-01', undefined)).toMatch(/End Date/);
  });

  it('rejects an End Date earlier than the Start Date', () => {
    expect(validateBillingDateRange('2026-02-01', '2026-01-01')).toMatch(/cannot be earlier/);
  });

  it('accepts a valid, non-inverted range', () => {
    expect(validateBillingDateRange('2026-01-01', '2026-01-31')).toBeNull();
  });
});

describe('Bill Period / date synchronization handlers', () => {
  it('recalculates the End Date when the Bill Period selector changes', () => {
    const result = applyBillPeriodOptionChange('3', '2026-01-01', '2026-01-31');
    expect(result).toEqual({ billPeriodValue: '3', billingEndDate: '2026-03-31' });
  });

  it('leaves the End Date for the user to pick when switching to Custom Dates', () => {
    const result = applyBillPeriodOptionChange('custom', '2026-01-01', '2026-01-31');
    expect(result).toEqual({ billPeriodValue: 'custom', billingEndDate: '2026-01-31' });
  });

  it('recalculates the End Date when the Start Date changes under a predefined period', () => {
    const result = applyBillingStartDateChange('2026-02-01', '1', '2026-01-31');
    expect(result).toEqual({ billingEndDate: '2026-02-28' });
  });

  it('leaves an explicit Custom Dates End Date untouched when the Start Date changes', () => {
    const result = applyBillingStartDateChange('2026-01-15', 'custom', '2026-02-25');
    expect(result).toEqual({ billingEndDate: '2026-02-25' });
  });

  it('switches to Custom Dates when a manually-edited End Date no longer matches the selected period', () => {
    const result = applyBillingEndDateChange('2026-02-25', '2026-01-10');
    expect(result).toEqual({ billPeriodValue: CUSTOM_BILL_PERIOD_VALUE });
  });

  it('keeps the matching predefined option when a manually-edited End Date happens to align with it', () => {
    const result = applyBillingEndDateChange('2026-03-31', '2026-01-01');
    expect(result).toEqual({ billPeriodValue: '3' });
  });
});
