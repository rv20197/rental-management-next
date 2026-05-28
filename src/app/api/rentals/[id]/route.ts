import { z } from 'zod';
import { RentalService } from '@/lib/services/rentalService';
import { json, jsonError, pickRouteStatusFromError, requireAuth } from '@/lib/http';

const rentalLineSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.union([z.number(), z.string()]),
  unitPrice: z.union([z.number(), z.string()]).nullish(),
});

const updateRentalSchema = z.object({
  endDate: z.union([z.string(), z.date()]).optional(),
  status: z.string().optional(),
  depositAmount: z.union([z.number(), z.string()]).nullish(),
  labourCost: z.union([z.number(), z.string()]).nullish(),
  transportCost: z.union([z.number(), z.string()]).nullish(),
  address: z.string().nullish(),
  items: z.array(rentalLineSchema).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const rental = await RentalService.getRentalById(id);
    if (!rental) return jsonError('Rental not found', 404);
    return json(rental);
  } catch (err) {
    return jsonError(`Error fetching rental: ${(err as Error).message}`, 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = updateRentalSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid rental payload', 400);
  }
  try {
    const result = await RentalService.updateRental(id, parsed.data);
    return json(result);
  } catch (err) {
    const { status, message } = pickRouteStatusFromError(err);
    return jsonError(message, status);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const result = await RentalService.deleteRental(id);
    return json(result);
  } catch (err) {
    const { status, message } = pickRouteStatusFromError(err);
    return jsonError(message, status);
  }
}
