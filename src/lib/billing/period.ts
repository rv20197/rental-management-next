/**
 * Bill Period utilities.
 *
 * The "Bill Period" is a user-selectable duration (in months, default 1)
 * that determines the billing end date starting from a bill's Due Date, and
 * scales all period-dependent amounts (recurring item charges, usage-based
 * charges, etc). It is persisted per-bill (see `billings.billPeriodMonths`)
 * so edits/regeneration reuse the previously selected value instead of
 * silently reverting to the 1-month default.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const DEFAULT_BILL_PERIOD_MONTHS = 1;
export const MIN_BILL_PERIOD_MONTHS = 0.5;
export const MAX_BILL_PERIOD_MONTHS = 36;

/** Commonly offered options for the Bill Period selector in the UI. */
export const BILL_PERIOD_OPTIONS_MONTHS = [0.5, 1, 2, 3, 6, 12] as const;

function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex0: number): number {
  // Day 0 of the next month is the last day of the target month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Adds a whole number of months to `date`, clamping the day-of-month to the
 * last valid day of the target month (e.g. Jan 31 + 1 month => Feb 28/29).
 * This is the app's existing date-handling convention for month-end dates.
 */
export function addMonthsClamped(date: Date, wholeMonths: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const totalMonths = month + wholeMonths;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

/**
 * Ensures a raw Bill Period value is a finite, positive number within
 * sane bounds, falling back to the 1-month default when missing/invalid.
 */
export function normalizeBillPeriodMonths(value: unknown): number {
  if (value == null || value === '') return DEFAULT_BILL_PERIOD_MONTHS;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BILL_PERIOD_MONTHS;
  return Math.min(Math.max(n, MIN_BILL_PERIOD_MONTHS), MAX_BILL_PERIOD_MONTHS);
}

export function isValidBillPeriodMonths(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= MIN_BILL_PERIOD_MONTHS && n <= MAX_BILL_PERIOD_MONTHS;
}

/**
 * Computes the billing end date (ISO `YYYY-MM-DD`) for a given due date and
 * Bill Period length in months. Whole months are added with month-end
 * clamping; a fractional remainder (e.g. 0.5) is applied as 30-day-month
 * days, consistent with the 30-day-month convention used elsewhere in
 * `lib/billing/months.ts`.
 */
export function calculateBillPeriodEndDate(dueDateIso: string, billPeriodMonths: number): string {
  const months = normalizeBillPeriodMonths(billPeriodMonths);
  const due = parseIsoDateUTC(dueDateIso);

  const wholeMonths = Math.trunc(months);
  const fractionalMonths = months - wholeMonths;

  let end = addMonthsClamped(due, wholeMonths);
  if (fractionalMonths > 0) {
    const fractionalDays = Math.round(fractionalMonths * 30);
    end = new Date(end.getTime() + fractionalDays * MS_PER_DAY);
  }

  return toIsoDate(end);
}

/** Number of calendar days spanned by [dueDate, billingEndDate). */
export function calculateBillPeriodDays(dueDateIso: string, billingEndDateIso: string): number {
  const start = parseIsoDateUTC(dueDateIso);
  const end = parseIsoDateUTC(billingEndDateIso);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}
