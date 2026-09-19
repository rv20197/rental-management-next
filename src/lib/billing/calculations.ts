import { normalizeBillPeriodMonths } from './period';

/**
 * Pure billing calculation logic shared by billing create/update.
 * Extracted so the Bill Period math can be unit-tested without a DB.
 */

const num = (v: unknown, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export interface BillingItemInput {
  itemId?: number | null;
  description?: string;
  quantity: number | string;
  rate: number | string;
}

export interface BillingDamageInput {
  description: string;
  amount: number | string;
}

export interface ProcessedBillingItem {
  itemId: number | null;
  description?: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface ProcessedBillingDamage {
  description: string;
  amount: number;
}

export interface BillingCalculationInput {
  items?: BillingItemInput[];
  damages?: BillingDamageInput[];
  /** Fallback total when no line items are supplied. Not scaled by billPeriodMonths. */
  amount?: number | string;
  availableDeposit?: number | string | null;
  labourCost?: number | string | null;
  transportCost?: number | string | null;
  billPeriodMonths?: unknown;
}

export interface BillingCalculationResult {
  processedItems: ProcessedBillingItem[];
  processedDamages: ProcessedBillingDamage[];
  itemsTotal: number;
  totalDamages: number;
  depositUsed: number;
  excessDamages: number;
  labourCost: number;
  transportCost: number;
  finalAmount: number;
  billPeriodMonths: number;
}

/**
 * Computes all Bill-Period-dependent totals for a billing record.
 *
 * Each line item's `rate` represents the recurring (monthly) rate; its
 * `total` is scaled by `billPeriodMonths` so the whole bill recalculates
 * consistently whenever the Bill Period changes. Damages, labour, and
 * transport costs are one-off charges and are not scaled by the period.
 */
export function calculateBillingTotals(input: BillingCalculationInput): BillingCalculationResult {
  const billPeriodMonths = normalizeBillPeriodMonths(input.billPeriodMonths);

  let itemsTotal = 0;
  const processedItems: ProcessedBillingItem[] = [];
  if (input.items && input.items.length > 0) {
    for (const it of input.items) {
      const quantity = num(it.quantity);
      const rate = num(it.rate);
      const total = quantity * rate * billPeriodMonths;
      itemsTotal += total;
      processedItems.push({
        itemId: it.itemId ?? null,
        description: it.description,
        quantity,
        rate,
        total,
      });
    }
  } else {
    itemsTotal = num(input.amount);
  }

  let totalDamages = 0;
  const processedDamages: ProcessedBillingDamage[] = [];
  if (input.damages && input.damages.length > 0) {
    for (const d of input.damages) {
      const amount = num(d.amount);
      totalDamages += amount;
      processedDamages.push({ description: d.description, amount });
    }
  }

  const availableDeposit = num(input.availableDeposit);
  const depositUsed = Math.min(availableDeposit, totalDamages);
  const excessDamages = Math.max(0, totalDamages - availableDeposit);
  const labourCost = num(input.labourCost);
  const transportCost = num(input.transportCost);
  const finalAmount = itemsTotal + excessDamages + labourCost + transportCost;

  return {
    processedItems,
    processedDamages,
    itemsTotal,
    totalDamages,
    depositUsed,
    excessDamages,
    labourCost,
    transportCost,
    finalAmount,
    billPeriodMonths,
  };
}
