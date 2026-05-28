/**
 * Partial-month billing rule (ported verbatim from the Express backend):
 * - Overdue ≤ 7 days: 0 extra months
 * - Overdue 7-15 days: 0.5
 * - Overdue > 15 days: 1.0
 *
 * Base period = (dueDate - startDate) / 30 days. Returns rounded to 1dp.
 */
export function calculateMonthsRented(startDate: Date, returnDate: Date, dueDate: Date): number {
  if (returnDate < startDate) return 0;

  const baseDays = (dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const baseMonths = baseDays / 30;

  const diffDays = Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  let overdueCharge = 0;
  if (diffDays <= 7) overdueCharge = 0;
  else if (diffDays <= 15) overdueCharge = 0.5;
  else if (diffDays > 15) overdueCharge = 1;

  return Math.max(0, Math.round((baseMonths + overdueCharge) * 10) / 10);
}
