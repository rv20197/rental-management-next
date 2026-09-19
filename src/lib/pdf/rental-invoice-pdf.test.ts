import { describe, expect, it } from 'vitest';
import { generateRentalInvoicePdf, resolveBillPeriodDisplay } from './rental-invoice-pdf';

describe('resolveBillPeriodDisplay', () => {
  it('uses enriched fields when the billing has already been resolved by BillingService', () => {
    const display = resolveBillPeriodDisplay({
      dueDate: '2026-01-01',
      billPeriodMonths: 3,
      billPeriodType: 'predefined',
      billPeriodValue: '3',
      billingStartDate: '2026-01-01',
      billingEndDate: '2026-03-31',
      billingDurationDays: 90,
    });

    expect(display).toEqual({
      billingStartDate: '2026-01-01',
      billingEndDate: '2026-03-31',
      billingDurationDays: 90,
      label: '3 Months',
    });
  });

  it('derives the display from legacy raw rows that only have dueDate + billPeriodMonths', () => {
    const display = resolveBillPeriodDisplay({
      dueDate: '2026-01-01',
      billPeriodMonths: 1,
      billPeriodType: 'predefined',
    });

    expect(display.billingStartDate).toBe('2026-01-01');
    expect(display.billingEndDate).toBe('2026-01-31');
    expect(display.billingDurationDays).toBe(31);
    expect(display.label).toBe('1 Month');
  });

  it('labels custom date ranges as "Custom Dates"', () => {
    const display = resolveBillPeriodDisplay({
      dueDate: '2026-01-10',
      billPeriodType: 'custom',
      billPeriodValue: 'custom',
      billingStartDate: '2026-01-10',
      billingEndDate: '2026-02-25',
      billingDurationDays: 47,
    });

    expect(display.label).toBe('Custom Dates');
    expect(display.billingDurationDays).toBe(47);
  });
});

describe('generateRentalInvoicePdf', () => {
  it('generates a PDF buffer without throwing for a fully enriched billing', async () => {
    const result = await generateRentalInvoicePdf({
      id: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-01',
      status: 'pending',
      billPeriodType: 'predefined',
      billPeriodValue: '1',
      billingStartDate: '2026-01-01',
      billingEndDate: '2026-01-31',
      billingDurationDays: 31,
      BillingItems: [],
      Rental: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.filename).toContain('Invoice');
  });

  it('generates a PDF buffer without throwing for a legacy raw billing (no billingEndDate column)', async () => {
    const result = await generateRentalInvoicePdf({
      id: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-01',
      status: 'pending',
      billPeriodMonths: 2,
      billPeriodType: null,
      BillingItems: [],
    });

    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
