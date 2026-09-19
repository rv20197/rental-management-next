/**
 * Bill Period utilities.
 *
 * The "Bill Period" determines the Billing Start Date and Billing End Date
 * for a bill, and scales all period-dependent amounts (recurring item
 * charges, usage-based charges, etc). It can be either:
 *  - `predefined`: one of a configurable list of calendar-month durations
 *    (1, 2, 3, 6, 12 months by default — see `BILL_PERIOD_OPTIONS`), whose
 *    end date is auto-calculated from the Billing Start Date, or
 *  - `custom`: an explicit, user-selected Start/End Date range, whose
 *    duration is derived from the actual dates (not a fixed days-per-month
 *    assumption).
 *
 * The final Billing Start Date and Billing End Date are the single source
 * of truth for all billing calculations and are persisted per-bill (see
 * `billings.dueDate` (start), `billings.billingEndDate` (end),
 * `billings.billPeriodType`, `billings.billPeriodMonths`) so edits/
 * regeneration reuse the previously selected values instead of silently
 * reverting to the 1-month default.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type BillPeriodType = 'predefined' | 'custom';

export interface BillPeriodOption {
  /** Stable identifier used in the UI selector and persisted/sent to the API. */
  value: string;
  label: string;
  /** Whole calendar months for predefined options; `null` for Custom Dates. */
  months: number | null;
}

/**
 * Configurable list of Bill Period options offered by the UI. Additional
 * predefined durations can be added here without touching calculation code.
 */
export const BILL_PERIOD_OPTIONS: readonly BillPeriodOption[] = [
  { value: '1', label: '1 Month', months: 1 },
  { value: '2', label: '2 Months', months: 2 },
  { value: '3', label: '3 Months', months: 3 },
  { value: '6', label: '6 Months', months: 6 },
  { value: '12', label: '12 Months (1 Year)', months: 12 },
  { value: 'custom', label: 'Custom Dates', months: null },
];

export const CUSTOM_BILL_PERIOD_VALUE = 'custom';
export const DEFAULT_BILL_PERIOD_VALUE = '1';
export const DEFAULT_BILL_PERIOD_MONTHS = 1;
export const MIN_BILL_PERIOD_MONTHS = 0.5;
export const MAX_BILL_PERIOD_MONTHS = 36;

/** @deprecated Prefer `BILL_PERIOD_OPTIONS`. Kept only for reference/back-compat. */
export const BILL_PERIOD_OPTIONS_MONTHS = [1, 2, 3, 6, 12] as const;

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

export function getBillPeriodOptionByValue(value: unknown): BillPeriodOption | null {
  if (value == null) return null;
  const v = String(value);
  return BILL_PERIOD_OPTIONS.find((o) => o.value === v) ?? null;
}

export function isCustomBillPeriodValue(value: unknown): boolean {
  return String(value) === CUSTOM_BILL_PERIOD_VALUE;
}

/**
 * Computes the billing end date (ISO `YYYY-MM-DD`, inclusive — the last
 * billed day) for a given start date and Bill Period length in months.
 * Whole months are added with month-end clamping (Jan 31 + 1 month lands on
 * Feb 28/29, and — because that landing is already the last day of the
 * target month — it is used as-is rather than shifted back a day). When no
 * clamping occurs, the unclamped "N months later, same day" instant is
 * exclusive, so it is shifted back one day to make the range inclusive
 * (e.g. 01-Jan-2026 + 1 month => 31-Jan-2026, not 01-Feb-2026). A
 * fractional remainder (e.g. legacy 0.5) is applied as 30-day-month days.
 */
export function calculateBillPeriodEndDate(startDateIso: string, billPeriodMonths: number): string {
  const months = normalizeBillPeriodMonths(billPeriodMonths);
  const start = parseIsoDateUTC(startDateIso);

  const wholeMonths = Math.trunc(months);
  const fractionalMonths = months - wholeMonths;

  const startDay = start.getUTCDate();
  const rawTarget = addMonthsClamped(start, wholeMonths);
  const wasClamped = rawTarget.getUTCDate() < startDay;

  let end = wasClamped ? rawTarget : new Date(rawTarget.getTime() - MS_PER_DAY);

  if (fractionalMonths > 0) {
    const fractionalDays = Math.round(fractionalMonths * 30);
    end = new Date(end.getTime() + fractionalDays * MS_PER_DAY);
  }

  return toIsoDate(end);
}

/** Number of calendar days spanned by [startDate, endDate], inclusive of both ends. */
export function calculateBillPeriodDays(startDateIso: string, endDateIso: string): number {
  const start = parseIsoDateUTC(startDateIso);
  const end = parseIsoDateUTC(endDateIso);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Computes an equivalent "number of months" for an arbitrary (possibly not
 * calendar-aligned) `[startDate, endDate]` inclusive range, used to scale
 * recurring per-month charges for a Custom Dates Bill Period. Proration is
 * calendar-month-aware: each calendar month overlapped by the range
 * contributes `daysOverlapped / daysInThatMonth`, so results are correct
 * across month-end dates and leap years without assuming a fixed
 * days-per-month.
 */
export function calculateCalendarMonthsEquivalent(startDateIso: string, endDateIso: string): number {
  const start = parseIsoDateUTC(startDateIso);
  const end = parseIsoDateUTC(endDateIso);
  if (end < start) return 0;

  let total = 0;
  let cursorYear = start.getUTCFullYear();
  let cursorMonth = start.getUTCMonth();

  // Safety cap to avoid runaway loops on malformed input.
  for (let guard = 0; guard < 1200; guard++) {
    const monthStart = new Date(Date.UTC(cursorYear, cursorMonth, 1));
    const monthEnd = new Date(Date.UTC(cursorYear, cursorMonth, daysInMonth(cursorYear, cursorMonth)));
    const segmentStart = monthStart > start ? monthStart : start;
    const segmentEnd = monthEnd < end ? monthEnd : end;

    if (segmentStart <= segmentEnd) {
      const overlapDays = Math.round((segmentEnd.getTime() - segmentStart.getTime()) / MS_PER_DAY) + 1;
      total += overlapDays / daysInMonth(cursorYear, cursorMonth);
    }

    if (monthEnd >= end) break;
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  // Round away floating point noise while keeping useful precision.
  return Math.round(total * 10000) / 10000;
}

/**
 * Finds the predefined Bill Period option (if any) whose auto-calculated
 * end date exactly matches `endDateIso` given `startDateIso`. Returns
 * `null` when the range doesn't match any predefined option, in which case
 * the range should be treated as Custom Dates.
 */
export function matchPredefinedBillPeriod(startDateIso: string, endDateIso: string): BillPeriodOption | null {
  for (const option of BILL_PERIOD_OPTIONS) {
    if (option.months == null) continue;
    if (calculateBillPeriodEndDate(startDateIso, option.months) === endDateIso) return option;
  }
  return null;
}

/**
 * Resolves the Bill Period multiplier ("number of months") used to scale
 * recurring charges, given the final selected option value and date range.
 * Predefined options use their fixed month count; Custom Dates (or any
 * value not found in `BILL_PERIOD_OPTIONS`) use the calendar-prorated
 * equivalent computed from the actual dates.
 */
export function resolveBillPeriodMonths(
  billPeriodValue: string | null | undefined,
  billingStartDate: string,
  billingEndDate: string,
): number {
  const option = getBillPeriodOptionByValue(billPeriodValue);
  if (option && option.months != null) return option.months;
  return calculateCalendarMonthsEquivalent(billingStartDate, billingEndDate);
}

export function billPeriodTypeOf(billPeriodValue: string | null | undefined): BillPeriodType {
  return isCustomBillPeriodValue(billPeriodValue) ? 'custom' : 'predefined';
}

/** Validates a mandatory, non-inverted billing date range. Returns an error message, or `null` if valid. */
export function validateBillingDateRange(
  billingStartDate?: string | null,
  billingEndDate?: string | null,
): string | null {
  if (!billingStartDate) return 'Billing Start Date is required';
  if (!billingEndDate) return 'Billing End Date is required';

  const start = parseIsoDateUTC(billingStartDate);
  const end = parseIsoDateUTC(billingEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Invalid billing date(s)';
  if (end < start) return 'Billing End Date cannot be earlier than Billing Start Date';
  return null;
}

/** Handler helper: user changed the Bill Period selector — recalculates the End Date from the Start Date (predefined), or leaves it for the user to pick (Custom Dates). */
export function applyBillPeriodOptionChange(
  newValue: string,
  billingStartDate: string,
  currentBillingEndDate: string,
): { billPeriodValue: string; billingEndDate: string } {
  const option = getBillPeriodOptionByValue(newValue);
  if (option && option.months != null && billingStartDate) {
    return { billPeriodValue: option.value, billingEndDate: calculateBillPeriodEndDate(billingStartDate, option.months) };
  }
  return { billPeriodValue: CUSTOM_BILL_PERIOD_VALUE, billingEndDate: currentBillingEndDate };
}

/** Handler helper: user changed the Start Date — recalculates the End Date per the current Bill Period (predefined), or leaves an explicit Custom Dates end date untouched. */
export function applyBillingStartDateChange(
  newStartDate: string,
  billPeriodValue: string,
  currentBillingEndDate: string,
): { billingEndDate: string } {
  const option = getBillPeriodOptionByValue(billPeriodValue);
  if (option && option.months != null) {
    return { billingEndDate: calculateBillPeriodEndDate(newStartDate, option.months) };
  }
  return { billingEndDate: currentBillingEndDate };
}

/** Handler helper: user manually changed the End Date — the selected dates become the source of truth, switching the Bill Period to Custom Dates unless the new range exactly matches a predefined option. */
export function applyBillingEndDateChange(
  newEndDate: string,
  billingStartDate: string,
): { billPeriodValue: string } {
  const matched = billingStartDate ? matchPredefinedBillPeriod(billingStartDate, newEndDate) : null;
  return { billPeriodValue: matched ? matched.value : CUSTOM_BILL_PERIOD_VALUE };
}
