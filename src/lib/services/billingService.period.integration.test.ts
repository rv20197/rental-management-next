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

describe.skipIf(!hasTestDb)('BillingService Bill Period (integration)', () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;

  it('defaults to a 1-month Bill Period and persists a user-selected period, reopening it unchanged', async () => {
    const { BillingService } = await import('@/lib/services/billingService');

    const defaultBilling = await BillingService.createBilling({
      dueDate: '2026-05-01',
      items: [{ itemId: null, description: 'Chair', quantity: 2, rate: 100 }],
    });
    expect(billPeriodOf(defaultBilling)).toBe(1);
    expect(Number(defaultBilling!.amount)).toBe(200);

    const customBilling = await BillingService.createBilling({
      dueDate: '2026-01-31',
      billPeriodMonths: 3,
      items: [{ itemId: null, description: 'Table', quantity: 1, rate: 300 }],
    });
    expect(billPeriodOf(customBilling)).toBe(3);
    expect(Number(customBilling!.amount)).toBe(900); // 300 * 3

    // Reopening (fetching) the bill must load the saved period, not the default.
    const reopened = await BillingService.getBillingById(String(customBilling!.id));
    expect(billPeriodOf(reopened)).toBe(3);

    // Regenerating/updating without changing the period preserves it.
    const regenerated = await BillingService.updateBilling(String(customBilling!.id), {
      items: [{ itemId: null, description: 'Table', quantity: 2, rate: 300 }],
    });
    expect(billPeriodOf(regenerated)).toBe(3);
    expect(Number(regenerated!.amount)).toBe(1800); // 2 * 300 * 3

    // Changing the Bill Period on update recalculates the whole bill.
    const rePeriod = await BillingService.updateBilling(String(customBilling!.id), {
      billPeriodMonths: 6,
    });
    expect(billPeriodOf(rePeriod)).toBe(6);
    expect(Number(rePeriod!.amount)).toBe(3600); // 2 * 300 * 6
  });
});

if (!hasTestDb) {
  describe('BillingService Bill Period (integration) [skipped]', () => {
    it('is skipped without TEST_DATABASE_URL — see file header for setup', () => {
      expect(hasTestDb).toBe(false);
    });
  });
}
