import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { inventoryUnits, items } from '@/lib/db/schema';
import { json, jsonError, requireAuth } from '@/lib/http';

const updateItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  status: z.enum(['available', 'rented', 'maintenance']).optional(),
  monthlyRate: z.union([z.number(), z.string()]).optional(),
  quantity: z.number().int().nonnegative().optional(),
});

async function readItem(id: string) {
  const itemId = parseInt(id, 10);
  if (!Number.isFinite(itemId)) return null;
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
  return item ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const item = await readItem(id);
  if (!item) return jsonError('Item not found', 404);
  return json(item);
}

async function update(request: Request, params: Promise<{ id: string }>) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const item = await readItem(id);
  if (!item) return jsonError('Item not found', 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid item payload', 400);
  const patch = parsed.data;

  try {
    const updated = await db.transaction(async (tx) => {
      if (patch.name !== undefined) {
        if (!patch.name || patch.name.trim() === '') {
          throw new Error('Item name cannot be empty');
        }
        const duplicate = await tx.query.items.findFirst({
          where: and(eq(items.name, patch.name), ne(items.id, item.id)),
        });
        if (duplicate) throw new Error('An item with this name already exists');
      }

      const updatedValues: Record<string, unknown> = {};
      if (patch.name !== undefined) updatedValues.name = patch.name;
      if (patch.description !== undefined) updatedValues.description = patch.description;
      if (patch.category !== undefined) updatedValues.category = patch.category;
      if (patch.status !== undefined) updatedValues.status = patch.status;
      if (patch.monthlyRate !== undefined) updatedValues.monthlyRate = String(patch.monthlyRate);
      if (patch.quantity !== undefined) updatedValues.quantity = patch.quantity;

      const oldQuantity = item.quantity ?? 0;
      const [next] = await tx.update(items).set(updatedValues).where(eq(items.id, item.id)).returning();

      const newQuantity = next.quantity ?? 0;
      if (newQuantity > oldQuantity) {
        const delta = newQuantity - oldQuantity;
        const payload = Array.from({ length: delta }, () => ({ itemId: item.id, status: 'available' as const }));
        await tx.insert(inventoryUnits).values(payload);
      }
      return next;
    });
    return json(updated);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('already exists') || msg.includes('empty') ? 400 : 500;
    return jsonError(msg, status);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return update(request, ctx.params);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return update(request, ctx.params);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (!Number.isFinite(itemId)) return jsonError('Item not found', 404);
  const result = await db.delete(items).where(eq(items.id, itemId)).returning({ id: items.id });
  if (result.length === 0) return jsonError('Item not found', 404);
  return json({ message: 'Item deleted successfully' });
}
