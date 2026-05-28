import { z } from 'zod';
import { BillingService } from '@/lib/services/billingService';
import { json, jsonError, requireAuth } from '@/lib/http';

const billingItemSchema = z.object({
  itemId: z.number().int().positive().nullish(),
  description: z.string().optional(),
  quantity: z.union([z.number(), z.string()]),
  rate: z.union([z.number(), z.string()]),
});

const billingDamageSchema = z.object({
  description: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
});

const createBillingSchema = z.object({
  rentalId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  labourCost: z.union([z.number(), z.string()]).nullish(),
  transportCost: z.union([z.number(), z.string()]).nullish(),
  availableDeposit: z.union([z.number(), z.string()]).nullish(),
  items: z.array(billingItemSchema).optional(),
  damages: z.array(billingDamageSchema).optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  try {
    const rows = await BillingService.getAllBillings();
    return json(rows);
  } catch (err) {
    return jsonError(`Error fetching billings: ${(err as Error).message}`, 500);
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
  const parsed = createBillingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid billing payload', 400);
  }
  try {
    const created = await BillingService.createBilling(parsed.data);
    return json(created, { status: 201 });
  } catch (err) {
    return jsonError(`Error creating billing: ${(err as Error).message}`, 500);
  }
}
