// Integration tests for BillingService's Bill Period behavior.
//
// These exercise the real create/update flow against Postgres so we can
// verify persistence (not just the pure calculation helpers covered by
// calculations.test.ts / period.test.ts). Only runs when TEST_DATABASE_URL
// is set; see src/app/api/auth/login/route.integration.test.ts for setup
// instructions.

import { describe, expect, it } from 'vitest';

const hasTestDb = !!process.env.TEST_DATABASE_URL;

const billPeriodOf = (billing: unknown): number => Number((billing as { billPeriodMonths: unknown }).billPeriodMonths);
const billPeriodTypeOf = (billing: unknown): string => (billing as { billPeriodType: string }).billPeriodType;
const billingEndDateOf = (billing: unknown): string | null => (billing as { billingEndDate: string | null }).billingEndDate;

describe.skipIf(!hasTestDb)('BillingService Bill Period (integration)', () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;

  it('defaults to a 1-month Bill Period and persists a user-selected period, reopening it unchanged', async () => {
    const { BillingService } = await import('@/lib/services/billingService');

    const defaultBilling = await BillingService.createBilling({
      dueDate: '2026-05-01',
      items: [{ itemId: null, description: 'Chair', quantity: 2, rate: 100 }],
    });
    expect(billPeriodOf(defaultBilling)).toBe(1);
    expect(billPeriodTypeOf(defaultBilling)).toBe('predefined');
    expect(billingEndDateOf(defaultBilling)).toBe('2026-05-31');
    expect(Number(defaultBilling!.amount)).toBe(200);

    const customBilling = await BillingService.createBilling({
      dueDate: '2026-01-31',
      billPeriodValue: '3',
      items: [{ itemId: null, description: 'Table', quantity: 1, rate: 300 }],
    });
    expect(billPeriodOf(customBilling)).toBe(3);
    expect(Number(customBilling!.amount)).toBe(900); // 300 * 3

    // Reopening (fetching) the bill must load the saved period, not the default.
    const reopened = await BillingService.getBillingById(String(customBilling!.id));
    expect(billPeriodOf(reopened)).toBe(3);
    expect(billingEndDateOf(reopened)).toBe(billingEndDateOf(customBilling));

    // Regenerating/updating without changing the period preserves it.
    const regenerated = await BillingService.updateBilling(String(customBilling!.id), {
      items: [{ itemId: null, description: 'Table', quantity: 2, rate: 300 }],
    });
    expect(billPeriodOf(regenerated)).toBe(3);
    expect(Number(regenerated!.amount)).toBe(1800); // 2 * 300 * 3

    // Changing the Bill Period on update recalculates the whole bill.
    const rePeriod = await BillingService.updateBilling(String(customBilling!.id), {
      billPeriodValue: '6',
    });
    expect(billPeriodOf(rePeriod)).toBe(6);
    expect(Number(rePeriod!.amount)).toBe(3600); // 2 * 300 * 6
  });

  it('supports explicit Custom Dates, prorating recurring charges from the actual date range', async () => {
    const { BillingService } = await import('@/lib/services/billingService');

    const customDatesBilling = await BillingService.createBilling({
      dueDate: '2026-01-10',
      billPeriodValue: 'custom',
      billingEndDate: '2026-02-25',
      items: [{ itemId: null, description: 'Sofa', quantity: 1, rate: 1000 }],
    });
    expect(billPeriodTypeOf(customDatesBilling)).toBe('custom');
    expect(billingEndDateOf(customDatesBilling)).toBe('2026-02-25');
    // 22/31 (Jan) + 25/28 (Feb) months-equivalent, scaled onto the 1000 rate.
    const expectedMonths = 22 / 31 + 25 / 28;
    expect(Number(customDatesBilling!.amount)).toBeCloseTo(1000 * expectedMonths, 1);

    // Reopening must load the exact persisted Start/End Date, not recompute them.
    const reopened = await BillingService.getBillingById(String(customDatesBilling!.id));
    expect(billingEndDateOf(reopened)).toBe('2026-02-25');
    expect(billPeriodTypeOf(reopened)).toBe('custom');
  });

  it('automatically switches to Custom Dates when an explicit End Date does not match a predefined option', async () => {
    const { BillingService } = await import('@/lib/services/billingService');

    const billing = await BillingService.createBilling({
      dueDate: '2026-01-01',
      billPeriodValue: '1',
      billingEndDate: '2026-02-10', // Doesn't match the 1-month option's auto end date (2026-01-31).
      items: [{ itemId: null, description: 'Bed', quantity: 1, rate: 500 }],
    });
    expect(billPeriodTypeOf(billing)).toBe('custom');
    expect(billingEndDateOf(billing)).toBe('2026-02-10');
  });

  it('recalculates the End Date when the Start Date changes for a predefined period', async () => {
    const { BillingService } = await import('@/lib/services/billingService');

    const billing = await BillingService.createBilling({
      dueDate: '2026-01-01',
      billPeriodValue: '1',
      items: [{ itemId: null, description: 'Fan', quantity: 1, rate: 100 }],
    });
    expect(billingEndDateOf(billing)).toBe('2026-01-31');

    const updated = await BillingService.updateBilling(String(billing!.id), { dueDate: '2026-02-01' });
    expect(billingEndDateOf(updated)).toBe('2026-02-28');
    expect(billPeriodTypeOf(updated)).toBe('predefined');
  });

  it('rejects an End Date earlier than the Start Date', async () => {
    const { BillingService } = await import('@/lib/services/billingService');

    await expect(
      BillingService.createBilling({
        dueDate: '2026-02-01',
        billPeriodValue: 'custom',
        billingEndDate: '2026-01-01',
        items: [{ itemId: null, description: 'Cot', quantity: 1, rate: 100 }],
      }),
    ).rejects.toThrow(/cannot be earlier/);
  });

  it('handles bills created before this change (no billingEndDate/billPeriodType persisted) without resetting', async () => {
    const { db } = await import('@/lib/db');
    const { billings } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { BillingService } = await import('@/lib/services/billingService');

    // Simulate a legacy row as it would have existed pre-migration: a
    // non-null billPeriodType default is applied by the DB, but
    // billingEndDate is left null to mimic bills saved before that column
    // existed.
    const [legacy] = await db
      .insert(billings)
      .values({
        amount: '400',
        dueDate: '2026-03-01',
        billPeriodMonths: '2',
        billingEndDate: null,
      })
      .returning();

    const loaded = await BillingService.getBillingById(String(legacy.id));
    expect(billPeriodOf(loaded)).toBe(2);
    // Computed on the fly from dueDate + billPeriodMonths since no
    // billingEndDate was persisted.
    expect(billingEndDateOf(loaded)).toBe('2026-04-28');

    // Regenerating (updating) it without touching the period self-heals by
    // persisting the (recomputed) billingEndDate going forward.
    const updated = await BillingService.updateBilling(String(legacy.id), { amount: '450' });
    expect(billPeriodOf(updated)).toBe(2);
    expect(billingEndDateOf(updated)).toBe('2026-04-28');

    await db.delete(billings).where(eq(billings.id, legacy.id));
  });
});

if (!hasTestDb) {
  describe('BillingService Bill Period (integration) [skipped]', () => {
    it('is skipped without TEST_DATABASE_URL — see file header for setup', () => {
      expect(hasTestDb).toBe(false);
    });
  });
}

