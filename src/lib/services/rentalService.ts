import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customers,
  inventoryUnits,
  items,
  rentals,
  rentalItems,
} from '@/lib/db/schema';
import { calculateMonthsRented } from '@/lib/billing/months';
import { calculateDefaultDeposit } from '@/lib/rental/deposit';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface RentalItemInput {
  itemId: number;
  quantity: number | string;
  unitPrice?: number | string | null;
}

interface CreateRentalPayload {
  customerId?: number;
  itemId?: number;
  quantity?: number;
  unitPrice?: number | string | null;
  startDate?: string | Date;
  endDate?: string | Date;
  depositAmount?: number | string | null;
  labourCost?: number | string | null;
  transportCost?: number | string | null;
  address?: string | null;
  items?: RentalItemInput[];
}

interface UpdateRentalPayload {
  endDate?: string | Date;
  status?: string;
  depositAmount?: number | string | null;
  labourCost?: number | string | null;
  transportCost?: number | string | null;
  address?: string | null;
  items?: RentalItemInput[];
}

const num = (v: unknown, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

async function loadRentalAggregate(rentalId: number) {
  return db.query.rentals.findFirst({
    where: eq(rentals.id, rentalId),
    with: {
      Item: true,
      Customer: true,
      RentalItems: { with: { Item: true } },
      Billings: true,
    },
  });
}

function enrich(rentalData: any) {
  const months = calculateMonthsRented(
    new Date(rentalData.startDate),
    new Date(rentalData.endDate),
    new Date(rentalData.endDate),
  );

  let baseAmount = 0;
  let totalQuantity = 0;
  let totalReturnedQuantity = 0;

  if (rentalData.RentalItems && rentalData.RentalItems.length > 0) {
    for (const ri of rentalData.RentalItems) {
      const storedUnit = ri.unitPrice != null ? parseFloat(ri.unitPrice) : null;
      const rate = storedUnit != null ? storedUnit : ri.Item?.monthlyRate ? parseFloat(ri.Item.monthlyRate) : 0;
      baseAmount += ri.quantity * rate * months;
      totalQuantity += ri.quantity;
      totalReturnedQuantity += ri.returnedQuantity || 0;
    }
  } else {
    const rate = rentalData.Item?.monthlyRate ? parseFloat(rentalData.Item.monthlyRate) : 0;
    baseAmount = (rentalData.quantity || 0) * rate * months;
    totalQuantity = rentalData.quantity || 0;
  }

  const transportCost = num(rentalData.transportCost);
  const labourCost = num(rentalData.labourCost);
  const totalAmount = baseAmount + transportCost + labourCost;
  const outstandingAmount = (rentalData.Billings || []).reduce((sum: number, b: any) => {
    if (b.status === 'paid') return sum;
    return sum + num(b.amount);
  }, 0);

  return {
    ...rentalData,
    baseAmount,
    transportCost,
    labourCost,
    depositAmount: num(rentalData.depositAmount),
    totalAmount,
    outstandingAmount,
    outstandingQty: Math.max(totalQuantity - totalReturnedQuantity, 0),
  };
}

async function ensureUnitsCapacity(tx: Tx, itemId: number, itemQuantity: number) {
  const [{ value: existing }] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(inventoryUnits)
    .where(eq(inventoryUnits.itemId, itemId));
  if (existing < itemQuantity) {
    const toCreate = itemQuantity - existing;
    const payload = Array.from({ length: toCreate }, () => ({
      itemId,
      status: 'available' as const,
    }));
    await tx.insert(inventoryUnits).values(payload);
  }
}

async function pickAvailableUnits(tx: Tx, itemId: number, requested: number) {
  return tx
    .select()
    .from(inventoryUnits)
    .where(and(eq(inventoryUnits.itemId, itemId), eq(inventoryUnits.status, 'available')))
    .orderBy(asc(inventoryUnits.dateAdded))
    .limit(requested);
}

export const RentalService = {
  async getAllRentals(filters: { customerId?: string; status?: string }) {
    const conds = [];
    if (filters.customerId) conds.push(eq(rentals.customerId, parseInt(filters.customerId, 10)));
    if (filters.status) conds.push(eq(rentals.status, filters.status as any));

    const rows = await db.query.rentals.findMany({
      where: conds.length ? and(...conds) : undefined,
      with: {
        Item: true,
        Customer: true,
        RentalItems: { with: { Item: true } },
        Billings: true,
      },
    });

    return rows.map(enrich);
  },

  async getRentalById(id: string) {
    const rentalId = parseInt(id, 10);
    if (!Number.isFinite(rentalId)) return null;
    const rental = await loadRentalAggregate(rentalId);
    if (!rental) return null;
    return enrich(rental);
  },

  async createRental(payload: CreateRentalPayload) {
    const { items: rawItems, ...rentalData } = payload;

    if (rentalData.depositAmount != null) {
      const dep = Number(rentalData.depositAmount);
      if (!Number.isFinite(dep) || dep < 0) {
        throw new Error('Invalid depositAmount: must be a non-negative number.');
      }
      rentalData.depositAmount = dep;
    }

    let requestedItems: RentalItemInput[] = [];
    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
      requestedItems = rawItems;
    } else if (payload.itemId) {
      requestedItems = [{ itemId: payload.itemId, quantity: payload.quantity || 1, unitPrice: payload.unitPrice }];
    }
    if (requestedItems.length === 0) {
      throw new Error('At least one item is required for rental.');
    }

    for (const ri of requestedItems) {
      if (ri.unitPrice != null && ri.unitPrice !== '') {
        const n = Number(ri.unitPrice);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error('Invalid unitPrice: must be a non-negative number.');
        }
      }
    }

    return db.transaction(async (tx) => {
      const itemIds = requestedItems.map((r) => r.itemId);
      const itemsData = await tx.select().from(items).where(inArray(items.id, itemIds));
      const itemMap = new Map(itemsData.map((i) => [i.id, i]));

      const assigned: {
        itemId: number;
        unitIds: number[];
        quantity: number;
        unitPrice: number | null;
      }[] = [];

      for (const requested of requestedItems) {
        const requestedQuantity = Number(requested.quantity) || 1;
        const resolvedUnitPrice = requested.unitPrice == null || requested.unitPrice === '' ? null : Number(requested.unitPrice);
        const item = itemMap.get(requested.itemId);
        if (!item) throw new Error(`Target item ${requested.itemId} not found for rental.`);

        await ensureUnitsCapacity(tx, requested.itemId, item.quantity ?? 0);

        const available = await pickAvailableUnits(tx, requested.itemId, requestedQuantity);
        if (available.length < requestedQuantity) {
          throw new Error(`Insufficient stock for item: ${item.name}`);
        }

        assigned.push({
          itemId: requested.itemId,
          unitIds: available.map((u) => u.id),
          quantity: requestedQuantity,
          unitPrice: resolvedUnitPrice,
        });
      }

      const providedStart = rentalData.startDate ? new Date(rentalData.startDate) : new Date();
      const providedEnd = rentalData.endDate
        ? new Date(rentalData.endDate)
        : (() => {
            const d = new Date(providedStart);
            d.setDate(d.getDate() + 30);
            return d;
          })();

      let totalDeposit: number = num(rentalData.depositAmount, NaN);
      if (!Number.isFinite(totalDeposit)) {
        totalDeposit = 0;
        for (const a of assigned) {
          const item = itemMap.get(a.itemId);
          const ratePerUnit =
            a.unitPrice != null ? a.unitPrice : item?.monthlyRate ? parseFloat(item.monthlyRate) : 0;
          totalDeposit += calculateDefaultDeposit(ratePerUnit, a.quantity);
        }
      }

      const first = assigned[0];
      const [created] = await tx
        .insert(rentals)
        .values({
          customerId: rentalData.customerId ?? null,
          itemId: first.itemId,
          quantity: first.quantity,
          inventoryUnitIds: first.unitIds,
          startDate: providedStart,
          endDate: providedEnd,
          depositAmount: String(totalDeposit),
          labourCost: rentalData.labourCost != null ? String(rentalData.labourCost) : '0',
          transportCost: rentalData.transportCost != null ? String(rentalData.transportCost) : '0',
          address: rentalData.address ?? null,
        })
        .returning();

      if (rentalData.customerId && rentalData.address?.trim()) {
        const [cust] = await tx
          .select({ address: customers.address })
          .from(customers)
          .where(eq(customers.id, rentalData.customerId));
        if (cust && (!cust.address || cust.address.trim() === '')) {
          await tx
            .update(customers)
            .set({ address: rentalData.address.trim().slice(0, 255) })
            .where(eq(customers.id, rentalData.customerId));
        }
      }

      await tx.insert(rentalItems).values(
        assigned.map((a) => ({
          rentalId: created.id,
          itemId: a.itemId,
          quantity: a.quantity,
          unitPrice: a.unitPrice != null ? String(a.unitPrice) : null,
          inventoryUnitIds: a.unitIds,
        })),
      );

      for (const a of assigned) {
        const item = itemMap.get(a.itemId)!;
        await tx
          .update(items)
          .set({ quantity: (item.quantity ?? 0) - a.quantity })
          .where(eq(items.id, a.itemId));
        await tx
          .update(inventoryUnits)
          .set({ status: 'rented' })
          .where(inArray(inventoryUnits.id, a.unitIds));
      }

      return loadRentalAggregate(created.id);
    });
  },

  async updateRental(id: string, payload: UpdateRentalPayload) {
    const rentalId = parseInt(id, 10);
    if (!Number.isFinite(rentalId)) throw new Error('Rental not found');

    const { items: rawItems, ...rentalData } = payload;

    if (rentalData.depositAmount != null) {
      const dep = Number(rentalData.depositAmount);
      if (!Number.isFinite(dep) || dep < 0) {
        throw new Error('Invalid depositAmount: must be a non-negative number.');
      }
      rentalData.depositAmount = dep;
    }

    return db.transaction(async (tx) => {
      const rental = await tx.query.rentals.findFirst({
        where: eq(rentals.id, rentalId),
        with: { RentalItems: true },
      });
      if (!rental) throw new Error('Rental not found');
      if (rental.status === 'returned' || rental.status === 'completed') {
        throw new Error('This rental can no longer be edited.');
      }

      if (rentalData.endDate) {
        const newEnd = new Date(rentalData.endDate);
        const start = new Date(rental.startDate);
        if (Number.isNaN(newEnd.getTime())) throw new Error('Invalid endDate provided');
        if (newEnd <= start) throw new Error('New end date must be after start date');
      }

      if (rawItems && Array.isArray(rawItems)) {
        const existing = rental.RentalItems ?? [];
        const requestedIds = rawItems.map((i) => i.itemId);
        const toRemove = existing.filter((eri) => !requestedIds.includes(eri.itemId));

        if (toRemove.length > 0) {
          const removeIds = toRemove.map((r) => r.itemId);
          const removeItems = await tx.select().from(items).where(inArray(items.id, removeIds));
          const removeMap = new Map(removeItems.map((i) => [i.id, i]));

          for (const eri of toRemove) {
            const item = removeMap.get(eri.itemId);
            if (item) {
              await tx
                .update(items)
                .set({ quantity: (item.quantity ?? 0) + eri.quantity })
                .where(eq(items.id, item.id));
            }
            if (eri.inventoryUnitIds && eri.inventoryUnitIds.length > 0) {
              await tx
                .update(inventoryUnits)
                .set({ status: 'available' })
                .where(inArray(inventoryUnits.id, eri.inventoryUnitIds));
            }
            await tx.delete(rentalItems).where(eq(rentalItems.id, eri.id));
          }
        }

        const itemIds = rawItems.map((i) => i.itemId);
        const itemsData = await tx.select().from(items).where(inArray(items.id, itemIds));
        const itemMap = new Map(itemsData.map((i) => [i.id, i]));

        for (const requested of rawItems) {
          const itemId = requested.itemId;
          const requestedQuantity = Number(requested.quantity);
          if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) continue;

          let resolvedUnitPrice: number | null | undefined;
          if (requested.unitPrice === null || requested.unitPrice === '') {
            resolvedUnitPrice = null;
          } else if (requested.unitPrice != null) {
            const n = Number(requested.unitPrice);
            if (!Number.isFinite(n) || n < 0) {
              throw new Error('Invalid unitPrice: must be a non-negative number.');
            }
            resolvedUnitPrice = n;
          }

          const existingRow = existing.find((eri) => eri.itemId === itemId);

          if (existingRow) {
            const diff = requestedQuantity - existingRow.quantity;
            if (diff > 0) {
              const available = await pickAvailableUnits(tx, itemId, diff);
              if (available.length < diff) {
                const item = itemMap.get(itemId);
                throw new Error(`Insufficient stock for item: ${item?.name ?? itemId}`);
              }
              const newUnitIds = available.map((u) => u.id);
              await tx
                .update(inventoryUnits)
                .set({ status: 'rented' })
                .where(inArray(inventoryUnits.id, newUnitIds));
              const updatePatch: Record<string, unknown> = {
                quantity: requestedQuantity,
                inventoryUnitIds: [...(existingRow.inventoryUnitIds ?? []), ...newUnitIds],
              };
              if (resolvedUnitPrice !== undefined) updatePatch.unitPrice = resolvedUnitPrice != null ? String(resolvedUnitPrice) : null;
              await tx.update(rentalItems).set(updatePatch).where(eq(rentalItems.id, existingRow.id));
              const item = itemMap.get(itemId);
              if (item) {
                await tx.update(items).set({ quantity: (item.quantity ?? 0) - diff }).where(eq(items.id, itemId));
              }
            } else if (diff < 0) {
              const releaseCount = Math.abs(diff);
              const currentUnits = existingRow.inventoryUnitIds ?? [];
              const releaseUnitIds = currentUnits.slice(0, releaseCount);
              const remainUnitIds = currentUnits.slice(releaseCount);
              if (releaseUnitIds.length > 0) {
                await tx
                  .update(inventoryUnits)
                  .set({ status: 'available' })
                  .where(inArray(inventoryUnits.id, releaseUnitIds));
              }
              const updatePatch: Record<string, unknown> = {
                quantity: requestedQuantity,
                inventoryUnitIds: remainUnitIds,
              };
              if (resolvedUnitPrice !== undefined) updatePatch.unitPrice = resolvedUnitPrice != null ? String(resolvedUnitPrice) : null;
              await tx.update(rentalItems).set(updatePatch).where(eq(rentalItems.id, existingRow.id));
              const item = itemMap.get(itemId);
              if (item) {
                await tx.update(items).set({ quantity: (item.quantity ?? 0) + releaseCount }).where(eq(items.id, itemId));
              }
            } else if (resolvedUnitPrice !== undefined) {
              await tx
                .update(rentalItems)
                .set({ unitPrice: resolvedUnitPrice != null ? String(resolvedUnitPrice) : null })
                .where(eq(rentalItems.id, existingRow.id));
            }
          } else {
            const item = itemMap.get(itemId);
            if (!item) throw new Error(`Item ${itemId} not found.`);
            const available = await pickAvailableUnits(tx, itemId, requestedQuantity);
            if (available.length < requestedQuantity) throw new Error(`Insufficient stock for item: ${item.name}`);
            const unitIds = available.map((u) => u.id);
            await tx.insert(rentalItems).values({
              rentalId: rental.id,
              itemId,
              quantity: requestedQuantity,
              unitPrice: resolvedUnitPrice != null ? String(resolvedUnitPrice) : null,
              inventoryUnitIds: unitIds,
            });
            await tx.update(items).set({ quantity: (item.quantity ?? 0) - requestedQuantity }).where(eq(items.id, itemId));
            await tx
              .update(inventoryUnits)
              .set({ status: 'rented' })
              .where(inArray(inventoryUnits.id, unitIds));
          }
        }
      }

      let finalDeposit: number = num(rentalData.depositAmount, NaN);
      if (!Number.isFinite(finalDeposit)) {
        finalDeposit = 0;
        const current = await tx
          .select()
          .from(rentalItems)
          .where(eq(rentalItems.rentalId, rental.id));
        const currentItemIds = current.map((c) => c.itemId);
        const currentItems = currentItemIds.length
          ? await tx.select().from(items).where(inArray(items.id, currentItemIds))
          : [];
        const map = new Map(currentItems.map((i) => [i.id, i]));
        for (const ri of current) {
          const item = map.get(ri.itemId);
          const ratePerUnit =
            ri.unitPrice != null
              ? parseFloat(ri.unitPrice)
              : item?.monthlyRate
                ? parseFloat(item.monthlyRate)
                : 0;
          finalDeposit += calculateDefaultDeposit(ratePerUnit, ri.quantity);
        }
      }

      const remaining = await tx
        .select()
        .from(rentalItems)
        .where(eq(rentalItems.rentalId, rental.id))
        .orderBy(asc(rentalItems.id))
        .limit(1);
      const firstItem = remaining[0];

      const updateValues: Record<string, unknown> = {
        depositAmount: String(finalDeposit),
        itemId: firstItem ? firstItem.itemId : rental.itemId,
        quantity: firstItem ? firstItem.quantity : rental.quantity,
        inventoryUnitIds: firstItem ? firstItem.inventoryUnitIds : rental.inventoryUnitIds,
      };
      if (rentalData.endDate) updateValues.endDate = new Date(rentalData.endDate);
      if (rentalData.status) updateValues.status = rentalData.status;
      if (rentalData.labourCost != null) updateValues.labourCost = String(rentalData.labourCost);
      if (rentalData.transportCost != null) updateValues.transportCost = String(rentalData.transportCost);
      if (rentalData.address !== undefined) updateValues.address = rentalData.address;

      await tx.update(rentals).set(updateValues).where(eq(rentals.id, rental.id));

      return loadRentalAggregate(rental.id);
    });
  },

  async deleteRental(id: string) {
    const rentalId = parseInt(id, 10);
    if (!Number.isFinite(rentalId)) throw new Error('Rental not found');
    const result = await db.delete(rentals).where(eq(rentals.id, rentalId)).returning({ id: rentals.id });
    if (result.length === 0) throw new Error('Rental not found');
    return { message: 'Rental deleted successfully' };
  },
};
