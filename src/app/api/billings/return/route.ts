import { z } from 'zod';
import { BillingService } from '@/lib/services/billingService';
import { json, jsonError, requireAuth } from '@/lib/http';

const returnLineSchema = z.object({
  rentalItemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const returnPayloadSchema = z.object({
  rentalId: z.number().int().positive(),
  items: z.array(returnLineSchema).min(1, 'No items specified for return'),
  labourCost: z.union([z.number(), z.string()]).optional(),
  transportCost: z.union([z.number(), z.string()]).optional(),
  returnLabourCost: z.union([z.number(), z.string()]).optional(),
  returnTransportCost: z.union([z.number(), z.string()]).optional(),
  damagesCost: z.union([z.number(), z.string()]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const parsed = returnPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid return payload', 400);
  }
  try {
    const { billing, processedReturns } = await BillingService.returnAndBill(parsed.data);
    return json(
      {
        message: 'Items returned, inventory adjusted, and bill generated dynamically!',
        billing,
        processedReturns,
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('not found')
      ? 404
      : msg.includes('active') || msg.includes('No items') || msg.includes('Invalid') || msg.includes('negative')
        ? 400
        : 500;
    return jsonError(msg, status);
  }
}
