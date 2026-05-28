import { describe, expect, it } from 'vitest';
import { calculateMonthsRented } from './months';

const day = (iso: string) => new Date(iso);

describe('calculateMonthsRented (partial-month rule)', () => {
  it('returns 0 when the return date precedes the start date', () => {
    const start = day('2026-05-15');
    const ret = day('2026-05-10');
    expect(calculateMonthsRented(start, ret, ret)).toBe(0);
  });

  it('charges roughly 1 month for a 30-day rental returned on the due date', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-31');
    expect(calculateMonthsRented(start, due, due)).toBe(1);
  });

  it('charges roughly 0.5 month for a 15-day rental returned on the due date', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-16');
    expect(calculateMonthsRented(start, due, due)).toBeCloseTo(0.5, 1);
  });

  it('adds no overdue charge when returned ≤ 7 days late', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-31');
    const ret = day('2026-06-05'); // 5 days late
    expect(calculateMonthsRented(start, ret, due)).toBe(1);
  });

  it('adds 0.5 overdue charge when returned 7–15 days late', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-31');
    const ret = day('2026-06-10'); // 10 days late
    expect(calculateMonthsRented(start, ret, due)).toBeCloseTo(1.5, 1);
  });

  it('adds 1 overdue charge when returned > 15 days late', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-31');
    const ret = day('2026-06-20'); // 20 days late
    expect(calculateMonthsRented(start, ret, due)).toBeCloseTo(2, 1);
  });

  it('rounds to one decimal place', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-22'); // 21 days = 0.7 months base
    expect(calculateMonthsRented(start, due, due)).toBe(0.7);
  });

  it('overdue boundary at exactly 7 days late is treated as the no-charge band', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-31');
    const ret = day('2026-06-07'); // 7 days late
    expect(calculateMonthsRented(start, ret, due)).toBe(1);
  });

  it('overdue boundary at exactly 15 days late is still the 0.5 band, not 1', () => {
    const start = day('2026-05-01');
    const due = day('2026-05-31');
    const ret = day('2026-06-15'); // 15 days late
    expect(calculateMonthsRented(start, ret, due)).toBeCloseTo(1.5, 1);
  });
});
