import { z } from 'zod';
import { RentalService } from '@/lib/services/rentalService';
import { json, jsonError, pickRouteStatusFromError, requireAuth } from '@/lib/http';

const rentalLineSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.union([z.number(), z.string()]),
  unitPrice: z.union([z.number(), z.string()]).nullish(),
});

const createRentalSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    itemId: z.number().int().positive().optional(),
    quantity: z.number().int().positive().optional(),
    unitPrice: z.union([z.number(), z.string()]).nullish(),
    startDate: z.union([z.string(), z.date()]).optional(),
    endDate: z.union([z.string(), z.date()]).optional(),
    depositAmount: z.union([z.number(), z.string()]).nullish(),
    labourCost: z.union([z.number(), z.string()]).nullish(),
    transportCost: z.union([z.number(), z.string()]).nullish(),
    address: z.string().nullish(),
    items: z.array(rentalLineSchema).optional(),
  })
  .refine((data) => (data.items && data.items.length > 0) || data.itemId != null, {
    message: 'items[] or itemId is required',
  });

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  try {
    const rentals = await RentalService.getAllRentals({ customerId, status });
    return json(rentals);
  } catch (err) {
    return jsonError(`Error fetching rentals: ${(err as Error).message}`, 500);
  }
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
  const parsed = createRentalSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid rental payload', 400);
  }
  try {
    const result = await RentalService.createRental(parsed.data);
    return json(result, { status: 201 });
  } catch (err) {
    const { status, message } = pickRouteStatusFromError(err);
    return jsonError(message, status);
  }
}
