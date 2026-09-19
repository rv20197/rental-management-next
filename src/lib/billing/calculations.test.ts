import { describe, expect, it } from 'vitest';
import { calculateBillingTotals } from './calculations';

describe('calculateBillingTotals', () => {
  it('defaults to a 1-month Bill Period when none is provided', () => {
    const result = calculateBillingTotals({
      items: [{ itemId: 1, quantity: 2, rate: 100 }],
    });
    expect(result.billPeriodMonths).toBe(1);
    expect(result.itemsTotal).toBe(200); // 2 * 100 * 1
    expect(result.finalAmount).toBe(200);
  });

  it('scales recurring item charges by the selected Bill Period', () => {
    const result = calculateBillingTotals({
      items: [{ itemId: 1, quantity: 2, rate: 100 }],
      billPeriodMonths: 3,
    });
    expect(result.billPeriodMonths).toBe(3);
    expect(result.itemsTotal).toBe(600); // 2 * 100 * 3
    expect(result.finalAmount).toBe(600);
  });

  it('recalculates the whole bill when the Bill Period changes', () => {
    const oneMonth = calculateBillingTotals({ items: [{ itemId: 1, quantity: 1, rate: 500 }], billPeriodMonths: 1 });
    const sixMonths = calculateBillingTotals({ items: [{ itemId: 1, quantity: 1, rate: 500 }], billPeriodMonths: 6 });
    expect(sixMonths.itemsTotal).toBe(oneMonth.itemsTotal * 6);
    expect(sixMonths.finalAmount).toBe(oneMonth.finalAmount * 6);
  });

  it('does not scale one-off damages, labour, or transport costs by the Bill Period', () => {
    const result = calculateBillingTotals({
      items: [{ itemId: 1, quantity: 1, rate: 100 }],
      damages: [{ description: 'Broken leg', amount: 50 }],
      labourCost: 20,
      transportCost: 10,
      billPeriodMonths: 3,
    });
    expect(result.itemsTotal).toBe(300); // 100 * 1 * 3
    expect(result.totalDamages).toBe(50);
    expect(result.labourCost).toBe(20);
    expect(result.transportCost).toBe(10);
    // 300 (items) + 50 (excess damages, no deposit) + 20 (labour) + 10 (transport)
    expect(result.finalAmount).toBe(380);
  });

  it('applies available deposit against damages before adding excess to the bill', () => {
    const result = calculateBillingTotals({
      items: [{ itemId: 1, quantity: 1, rate: 100 }],
      damages: [{ description: 'Broken leg', amount: 150 }],
      availableDeposit: 100,
      billPeriodMonths: 1,
    });
    expect(result.depositUsed).toBe(100);
    expect(result.excessDamages).toBe(50);
    expect(result.finalAmount).toBe(150); // 100 (items) + 50 (excess damages)
  });

  it('falls back to a flat amount when no line items are supplied (not period-scaled)', () => {
    const result = calculateBillingTotals({ amount: 999, billPeriodMonths: 3 });
    expect(result.itemsTotal).toBe(999);
    expect(result.finalAmount).toBe(999);
  });

  it('normalizes and clamps invalid Bill Period input to the default/bounds', () => {
    expect(calculateBillingTotals({ items: [{ itemId: 1, quantity: 1, rate: 10 }], billPeriodMonths: -5 }).billPeriodMonths).toBe(1);
    expect(calculateBillingTotals({ items: [{ itemId: 1, quantity: 1, rate: 10 }], billPeriodMonths: 100 }).billPeriodMonths).toBe(36);
  });
});
