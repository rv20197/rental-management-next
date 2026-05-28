import { z } from 'zod';
import { db } from '@/lib/db';
import { inventoryUnits, items } from '@/lib/db/schema';
import { json, jsonError, requireAuth } from '@/lib/http';

const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  category: z.string().nullish(),
  status: z.enum(['available', 'rented', 'maintenance']).optional(),
  monthlyRate: z.union([z.number(), z.string()]),
  quantity: z.number().int().nonnegative().optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const rows = await db.select().from(items);
  return json(rows);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid item payload', 400);

  try {
    const item = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(items)
        .values({
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          category: parsed.data.category ?? null,
          status: parsed.data.status ?? 'available',
          monthlyRate: String(parsed.data.monthlyRate),
          quantity: parsed.data.quantity ?? 1,
        })
        .returning();

      const unitsToCreate = created.quantity || 1;
      const payload = Array.from({ length: unitsToCreate }, () => ({
        itemId: created.id,
        status: 'available' as const,
      }));
      await tx.insert(inventoryUnits).values(payload);
      return created;
    });
    return json(item, { status: 201 });
  } catch (err) {
    return jsonError(`Error creating item: ${(err as Error).message}`, 500);
  }
}
