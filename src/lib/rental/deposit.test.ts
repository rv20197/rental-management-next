import { describe, expect, it } from 'vitest';
import { calculateDefaultDeposit } from './deposit';

describe('calculateDefaultDeposit', () => {
  it('returns 2 × rate × quantity', () => {
    expect(calculateDefaultDeposit(500, 3)).toBe(3000);
  });

  it('returns 0 when rate is 0', () => {
    expect(calculateDefaultDeposit(0, 5)).toBe(0);
  });

  it('returns 0 when quantity is 0', () => {
    expect(calculateDefaultDeposit(500, 0)).toBe(0);
  });

  it('treats missing inputs as 0 rather than NaN', () => {
    // The product code uses `(monthlyRate || 0) * 2 * (quantity || 0)`,
    // which means callers can pass undefined without breaking deposit math.
    expect(calculateDefaultDeposit(undefined as unknown as number, 3)).toBe(0);
    expect(calculateDefaultDeposit(500, undefined as unknown as number)).toBe(0);
  });

  it('handles decimal rates correctly', () => {
    expect(calculateDefaultDeposit(199.99, 2)).toBeCloseTo(799.96, 2);
  });
});
