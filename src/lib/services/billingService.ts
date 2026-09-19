import { and, eq, inArray, lt, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  billingDamages,
  billingItems,
  billings,
  inventoryUnits,
  items,
  rentalItems,
  rentals,
} from '@/lib/db/schema';
import { calculateMonthsRented } from '@/lib/billing/months';
import { calculateBillingTotals } from '@/lib/billing/calculations';
import {
  CUSTOM_BILL_PERIOD_VALUE,
  DEFAULT_BILL_PERIOD_MONTHS,
  type BillPeriodType,
  calculateBillPeriodDays,
  calculateBillPeriodEndDate,
  calculateCalendarMonthsEquivalent,
  getBillPeriodOptionByValue,
  matchPredefinedBillPeriod,
  normalizeBillPeriodMonths,
  validateBillingDateRange,
} from '@/lib/billing/period';
const num = (v: unknown, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

interface CreateBillingPayload {
  rentalId?: number;
  customerId?: number;
  amount?: number | string;
  /** Billing Start Date (historically also the payment Due Date). */
  dueDate?: string;
  /** Bill Period selector value: '1' | '2' | '3' | '6' | '12' | 'custom'. Preferred over `billPeriodMonths`. */
  billPeriodValue?: string;
  /** Billing End Date. Required when `billPeriodValue` is 'custom'; auto-calculated from `dueDate` otherwise unless explicitly overridden. */
  billingEndDate?: string;
  /** @deprecated Legacy raw Bill Period length, in months, from `dueDate`. Defaults to 1. Prefer `billPeriodValue`. */
  billPeriodMonths?: number | string;
  status?: string;
  paymentDate?: string;
  labourCost?: number | string | null;
  transportCost?: number | string | null;
  availableDeposit?: number | string | null;
  items?: { itemId?: number | null; description?: string; quantity: number | string; rate: number | string }[];
  damages?: { description: string; amount: number | string }[];
}

type UpdateBillingPayload = CreateBillingPayload;

interface ExistingPeriodFields {
  dueDate: string;
  billPeriodType: string;
  billPeriodMonths: string;
  billingEndDate: string | null;
}

interface ResolvedBillingPeriod {
  dueDate: string;
  billPeriodType: BillPeriodType;
  billPeriodMonths: number;
  billingEndDate: string;
}

/**
 * Resolves the final Billing Start/End Date and Bill Period type/multiplier
 * for a create/update request. The final dates are the single source of
 * truth for all billing calculations (see `calculateBillingTotals`).
 *
 * - A `billPeriodValue` of a predefined option auto-calculates the End Date
 *   from the Start Date unless `billingEndDate` is explicitly supplied.
 * - A `billPeriodValue` of 'custom' (or any explicit `billingEndDate` that
 *   doesn't match a predefined option) requires/uses the explicit End Date,
 *   with the recurring-charge multiplier derived via calendar-month
 *   proration of the actual date range (no fixed days-per-month).
 * - The legacy `billPeriodMonths` (no `billPeriodValue`) is still supported
 *   for backward compatibility.
 * - When neither is supplied on an update, the previously persisted Bill
 *   Period is reused unchanged, except the End Date is recalculated when
 *   the Start Date changes and the previous period was predefined (per the
 *   Start-Date/Bill-Period synchronization rule).
 */
function resolveBillingPeriod(
  payload: CreateBillingPayload,
  existing?: ExistingPeriodFields | null,
): ResolvedBillingPeriod {
  const dueDate = payload.dueDate ?? existing?.dueDate ?? new Date().toISOString().slice(0, 10);
  let result: ResolvedBillingPeriod;

  if (payload.billPeriodValue != null) {
    const option = getBillPeriodOptionByValue(payload.billPeriodValue);
    if (option && option.months != null) {
      result = {
        dueDate,
        billPeriodType: 'predefined',
        billPeriodMonths: option.months,
        billingEndDate: payload.billingEndDate ?? calculateBillPeriodEndDate(dueDate, option.months),
      };
    } else {
      if (!payload.billingEndDate) throw new Error('Billing End Date is required for a Custom Dates Bill Period');
      result = {
        dueDate,
        billPeriodType: 'custom',
        billPeriodMonths: calculateCalendarMonthsEquivalent(dueDate, payload.billingEndDate),
        billingEndDate: payload.billingEndDate,
      };
    }
  } else if (payload.billPeriodMonths != null) {
    // Legacy numeric-only payload.
    const billPeriodMonths = normalizeBillPeriodMonths(payload.billPeriodMonths);
    const billingEndDate = payload.billingEndDate ?? calculateBillPeriodEndDate(dueDate, billPeriodMonths);
    const matched = matchPredefinedBillPeriod(dueDate, billingEndDate);
    result = {
      dueDate,
      billPeriodType: matched ? 'predefined' : 'custom',
      billPeriodMonths,
      billingEndDate,
    };
  } else if (existing) {
    // Nothing period-related supplied — reuse the previously persisted
    // period rather than resetting to the default.
    const billPeriodMonths = normalizeBillPeriodMonths(existing.billPeriodMonths);
    const billPeriodType: BillPeriodType = existing.billPeriodType === 'custom' ? 'custom' : 'predefined';
    const startChanged = payload.dueDate != null && payload.dueDate !== existing.dueDate;
    let billingEndDate = existing.billingEndDate ?? calculateBillPeriodEndDate(existing.dueDate, billPeriodMonths);
    if (startChanged && billPeriodType === 'predefined') {
      billingEndDate = calculateBillPeriodEndDate(dueDate, billPeriodMonths);
    }
    result = { dueDate, billPeriodType, billPeriodMonths, billingEndDate };
  } else {
    result = {
      dueDate,
      billPeriodType: 'predefined',
      billPeriodMonths: DEFAULT_BILL_PERIOD_MONTHS,
      billingEndDate: calculateBillPeriodEndDate(dueDate, DEFAULT_BILL_PERIOD_MONTHS),
    };
  }

  const error = validateBillingDateRange(result.dueDate, result.billingEndDate);
  if (error) throw new Error(error);
  return result;
}

function billPeriodValueOf(billPeriodType: string, billPeriodMonths: unknown): string {
  return billPeriodType === 'custom' ? CUSTOM_BILL_PERIOD_VALUE : String(normalizeBillPeriodMonths(billPeriodMonths));
}

interface ReturnAndBillPayload {
  rentalId: number;
  items: { rentalItemId: number; quantity: number }[];
  labourCost?: number | string;
  transportCost?: number | string;
  returnLabourCost?: number | string;
  returnTransportCost?: number | string;
  damagesCost?: number | string;
}

async function loadBillingAggregate(id: number) {
  return db.query.billings.findFirst({
    where: eq(billings.id, id),
    with: {
      Rental: {
        with: {
          Customer: true,
          Item: true,
          RentalItems: { with: { Item: true } },
        },
      },
      Customer: true,
      BillingItems: { with: { Item: true } },
      BillingDamages: true,
    },
  });
}

function enrichBilling(b: any) {
  const labourCost = num(b.labourCost);
  const transportCost = num(b.transportCost);
  const totalAmount = num(b.amount);
  const baseAmount = totalAmount - labourCost - transportCost;
  const billPeriodMonths = normalizeBillPeriodMonths(b.billPeriodMonths);
  const billPeriodType: BillPeriodType = b.billPeriodType === 'custom' ? 'custom' : 'predefined';
  // Persisted billingEndDate is the source of truth; fall back to a computed
  // value only for bills created before this column existed.
  const billingEndDate = b.billingEndDate ?? (b.dueDate ? calculateBillPeriodEndDate(b.dueDate, billPeriodMonths) : null);
  const billingStartDate = b.dueDate ?? null;
  const billingDurationDays =
    billingStartDate && billingEndDate ? calculateBillPeriodDays(billingStartDate, billingEndDate) : null;
  return {
    ...b,
    baseAmount,
    transportCost,
    labourCost,
    depositAmount: num(b.Rental?.depositAmount),
    totalAmount,
    billPeriodMonths,
    billPeriodType,
    billPeriodValue: billPeriodValueOf(billPeriodType, billPeriodMonths),
    billingStartDate,
    billingEndDate,
    billingDurationDays,
  };
}

export const BillingService = {
  async getAllBillings() {
    const rows = await db.query.billings.findMany({
      with: {
        Rental: {
          with: {
            Customer: true,
            Item: true,
            RentalItems: { with: { Item: true } },
          },
        },
        Customer: true,
        BillingItems: { with: { Item: true } },
        BillingDamages: true,
      },
    });
    return rows.map(enrichBilling);
  },

  async getBillingById(id: string) {
    const billingId = parseInt(id, 10);
    if (!Number.isFinite(billingId)) return null;
    const row = await loadBillingAggregate(billingId);
    if (!row) return null;
    return enrichBilling(row);
  },

  async createBilling(payload: CreateBillingPayload) {
    const { items: rawItems, damages, ...billingData } = payload;

    const resolvedPeriod = resolveBillingPeriod(billingData);

    const {
      processedItems,
      processedDamages,
      totalDamages,
      depositUsed,
      finalAmount,
      billPeriodMonths,
    } = calculateBillingTotals({
      items: rawItems,
      damages,
      amount: billingData.amount,
      availableDeposit: billingData.availableDeposit,
      labourCost: billingData.labourCost,
      transportCost: billingData.transportCost,
      billPeriodMonths: resolvedPeriod.billPeriodMonths,
    });

    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(billings)
        .values({
          rentalId: billingData.rentalId ?? null,
          customerId: billingData.customerId ?? null,
          amount: String(finalAmount),
          dueDate: resolvedPeriod.dueDate,
          billPeriodMonths: String(billPeriodMonths),
          billPeriodType: resolvedPeriod.billPeriodType,
          billingEndDate: resolvedPeriod.billingEndDate,
          status: (billingData.status as 'pending' | 'paid' | 'overdue') ?? 'pending',
          totalDamages: String(totalDamages),
          depositUsed: String(depositUsed),
          labourCost: billingData.labourCost != null ? String(billingData.labourCost) : '0',
          transportCost: billingData.transportCost != null ? String(billingData.transportCost) : '0',
        })
        .returning();

      if (processedItems.length > 0) {
        await tx.insert(billingItems).values(
          processedItems.map((p) => ({
            billingId: created.id,
            itemId: p.itemId,
            description: p.description,
            quantity: p.quantity,
            rate: String(p.rate),
            total: String(p.total),
          })),
        );
      }

      if (processedDamages.length > 0) {
        await tx.insert(billingDamages).values(
          processedDamages.map((d) => ({
            billingId: created.id,
            description: d.description,
            amount: String(d.amount),
          })),
        );
      }

      return loadBillingAggregate(created.id);
    });
  },

  /**
   * Recalculates and updates an existing billing using a (possibly changed)
   * Bill Period, due date, items, damages, or costs. Line items and damages
   * are replaced with freshly recalculated rows so the stored totals always
   * reflect the currently selected Bill Period.
   */
  async updateBilling(id: string, payload: UpdateBillingPayload) {
    const billingId = parseInt(id, 10);
    if (!Number.isFinite(billingId)) throw new Error('Billing not found');

    const existing = await db.query.billings.findFirst({ where: eq(billings.id, billingId) });
    if (!existing) throw new Error('Billing not found');
    if (existing.status === 'paid') throw new Error('Cannot edit a billing that has already been paid');

    const { items: rawItems, damages, ...billingData } = payload;

    const resolvedPeriod = resolveBillingPeriod(billingData, existing);

    const {
      processedItems,
      processedDamages,
      totalDamages,
      depositUsed,
      finalAmount,
      billPeriodMonths,
    } = calculateBillingTotals({
      items: rawItems,
      damages,
      amount: billingData.amount ?? existing.amount,
      availableDeposit: billingData.availableDeposit,
      labourCost: billingData.labourCost ?? existing.labourCost,
      transportCost: billingData.transportCost ?? existing.transportCost,
      // Falls back to the previously persisted Bill Period, never silently
      // resetting to the 1-month default when not explicitly changed.
      billPeriodMonths: resolvedPeriod.billPeriodMonths,
    });

    return db.transaction(async (tx) => {
      await tx
        .update(billings)
        .set({
          rentalId: billingData.rentalId ?? existing.rentalId,
          customerId: billingData.customerId ?? existing.customerId,
          amount: String(finalAmount),
          dueDate: resolvedPeriod.dueDate,
          billPeriodMonths: String(billPeriodMonths),
          billPeriodType: resolvedPeriod.billPeriodType,
          billingEndDate: resolvedPeriod.billingEndDate,
          totalDamages: String(totalDamages),
          depositUsed: String(depositUsed),
          labourCost: billingData.labourCost != null ? String(billingData.labourCost) : existing.labourCost,
          transportCost:
            billingData.transportCost != null ? String(billingData.transportCost) : existing.transportCost,
        })
        .where(eq(billings.id, billingId));

      await tx.delete(billingItems).where(eq(billingItems.billingId, billingId));
      await tx.delete(billingDamages).where(eq(billingDamages.billingId, billingId));

      if (processedItems.length > 0) {
        await tx.insert(billingItems).values(
          processedItems.map((p) => ({
            billingId,
            itemId: p.itemId,
            description: p.description,
            quantity: p.quantity,
            rate: String(p.rate),
            total: String(p.total),
          })),
        );
      }

      if (processedDamages.length > 0) {
        await tx.insert(billingDamages).values(
          processedDamages.map((d) => ({
            billingId,
            description: d.description,
            amount: String(d.amount),
          })),
        );
      }

      return loadBillingAggregate(billingId);
    });
  },

  async payBilling(id: string) {
    const billingId = parseInt(id, 10);
    if (!Number.isFinite(billingId)) throw new Error('Billing not found');
    const billing = await db.query.billings.findFirst({ where: eq(billings.id, billingId) });
    if (!billing) throw new Error('Billing not found');
    if (billing.status === 'paid') throw new Error('Billing is already paid');
    const today = new Date().toISOString().slice(0, 10);
    await db.update(billings).set({ status: 'paid', paymentDate: today }).where(eq(billings.id, billingId));
    return { ...billing, status: 'paid', paymentDate: today };
  },

  async returnAndBill(payload: ReturnAndBillPayload) {
    const { rentalId, items: returnItems } = payload;

    const returnLabourCostNum = num(payload.returnLabourCost);
    const returnTransportCostNum = num(payload.returnTransportCost);
    const damagesCostNum = num(payload.damagesCost);
    const labourCostAmount = num(payload.labourCost);
    const transportCostAmount = num(payload.transportCost);

    if (returnLabourCostNum < 0 || returnTransportCostNum < 0 || damagesCostNum < 0) {
      throw new Error('Return costs cannot be negative');
    }

    if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
      throw new Error('No items specified for return');
    }

    return db.transaction(async (tx) => {
      const rental = await tx.query.rentals.findFirst({
        where: eq(rentals.id, rentalId),
        with: { Customer: true, RentalItems: { with: { Item: true } } },
      });
      if (!rental) throw new Error('Rental not found');
      if (rental.status !== 'active') throw new Error('Rental is no longer active');

      const now = new Date();
      const startDate = new Date(rental.startDate);
      const endDate = new Date(rental.endDate);
      const monthsRented = calculateMonthsRented(startDate, now, endDate);

      let totalBillAmount = labourCostAmount + transportCostAmount + returnLabourCostNum + returnTransportCostNum + damagesCostNum;
      let totalReturnedQuantity = 0;
      for (const r of returnItems) totalReturnedQuantity += r.quantity;

      const [billing] = await tx
        .insert(billings)
        .values({
          rentalId: rental.id,
          customerId: rental.customerId,
          amount: '0',
          dueDate: now.toISOString().slice(0, 10),
          status: 'pending',
          labourCost: String(labourCostAmount),
          transportCost: String(transportCostAmount),
          returnLabourCost: String(returnLabourCostNum),
          returnTransportCost: String(returnTransportCostNum),
          damagesCost: String(damagesCostNum),
          returnedQuantity: totalReturnedQuantity,
        })
        .returning();

      const itemBillingPayloads: any[] = [];
      const processedReturns: { itemId: number; quantity: number; amount: number }[] = [];

      for (const spec of returnItems) {
        const ri = rental.RentalItems?.find((x) => x.id === spec.rentalItemId);
        if (!ri) throw new Error(`Item with ID ${spec.rentalItemId} not found in this rental`);

        const availableToReturn = ri.quantity - ri.returnedQuantity;
        if (spec.quantity > availableToReturn || spec.quantity <= 0) {
          throw new Error(`Invalid return quantity for ${ri.Item?.name}. Available: ${availableToReturn}, Requested: ${spec.quantity}`);
        }

        const storedUnit = ri.unitPrice != null ? parseFloat(ri.unitPrice) : null;
        const monthlyRate = storedUnit != null
          ? storedUnit
          : ri.Item?.monthlyRate
            ? parseFloat(ri.Item.monthlyRate)
            : 0;
        const itemBillAmount = spec.quantity * monthlyRate * monthsRented;
        totalBillAmount += itemBillAmount;

        itemBillingPayloads.push({
          billingId: billing.id,
          itemId: ri.itemId,
          quantity: spec.quantity,
          rate: String(monthlyRate * monthsRented),
          total: String(itemBillAmount),
        });

        if (ri.Item) {
          await tx
            .update(items)
            .set({ quantity: (ri.Item.quantity ?? 0) + spec.quantity })
            .where(eq(items.id, ri.Item.id));

          const unitsArr = ri.inventoryUnitIds ?? [];
          if (unitsArr.length > 0) {
            const unitsToReturn = unitsArr.slice(ri.returnedQuantity, ri.returnedQuantity + spec.quantity);
            if (unitsToReturn.length > 0) {
              await tx
                .update(inventoryUnits)
                .set({ status: 'available' })
                .where(inArray(inventoryUnits.id, unitsToReturn));
            }
          }
        }

        await tx
          .update(rentalItems)
          .set({ returnedQuantity: ri.returnedQuantity + spec.quantity })
          .where(eq(rentalItems.id, ri.id));

        processedReturns.push({ itemId: ri.itemId, quantity: spec.quantity, amount: itemBillAmount });
      }

      if (itemBillingPayloads.length > 0) {
        await tx.insert(billingItems).values(itemBillingPayloads);
      }

      if (returnLabourCostNum > 0) {
        await tx.insert(billingItems).values({
          billingId: billing.id,
          itemId: null,
          description: 'Return Labour Cost',
          quantity: 1,
          rate: String(returnLabourCostNum),
          total: String(returnLabourCostNum),
        });
      }
      if (returnTransportCostNum > 0) {
        await tx.insert(billingItems).values({
          billingId: billing.id,
          itemId: null,
          description: 'Return Transport Cost',
          quantity: 1,
          rate: String(returnTransportCostNum),
          total: String(returnTransportCostNum),
        });
      }
      if (damagesCostNum > 0) {
        await tx.insert(billingItems).values({
          billingId: billing.id,
          itemId: null,
          description: 'Return Damages',
          quantity: 1,
          rate: String(damagesCostNum),
          total: String(damagesCostNum),
        });
      }

      await tx.update(billings).set({ amount: String(totalBillAmount) }).where(eq(billings.id, billing.id));

      const allItems = await tx.select().from(rentalItems).where(eq(rentalItems.rentalId, rental.id));
      if (allItems.every((ri) => ri.returnedQuantity >= ri.quantity)) {
        await tx
          .update(rentals)
          .set({
            status: 'returned',
            returnLabourCost: String(returnLabourCostNum),
            returnTransportCost: String(returnTransportCostNum),
            damagesCost: String(damagesCostNum),
          })
          .where(eq(rentals.id, rental.id));
      }

      const fresh = await loadBillingAggregate(billing.id);
      return { billing: fresh, processedReturns };
    });
  },

  async findOverdueAndUpcoming(threeDayTarget: string) {
    return db.query.billings.findMany({
      where: and(eq(billings.status, 'pending'), lte(billings.dueDate, threeDayTarget)),
      with: { Rental: { with: { Customer: true } } },
    });
  },

  async markOverdue(today: string) {
    const result = await db
      .update(billings)
      .set({ status: 'overdue' })
      .where(and(eq(billings.status, 'pending'), lt(billings.dueDate, today)))
      .returning({ id: billings.id });
    return result.length;
  },
};
