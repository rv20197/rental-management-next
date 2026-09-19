import { z } from 'zod';
import { BillingService } from '@/lib/services/billingService';
import { json, jsonError, requireAuth } from '@/lib/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const billing = await BillingService.getBillingById(id);
  if (!billing) return jsonError('Billing not found', 404);
  return json(billing);
}

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

const updateBillingSchema = z.object({
  rentalId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  dueDate: z.string().optional(),
  /** Bill Period selector: '1' | '2' | '3' | '6' | '12' | 'custom'. Preferred over `billPeriodMonths`. */
  billPeriodValue: z.string().optional(),
  /** Billing End Date. Required for a Custom Dates Bill Period. */
  billingEndDate: z.string().optional(),
  /** @deprecated Legacy raw Bill Period length, in months. Prefer `billPeriodValue`. */
  billPeriodMonths: z
    .union([z.number(), z.string()])
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0.5 && n <= 36;
    }, 'billPeriodMonths must be between 0.5 and 36')
    .optional(),
  labourCost: z.union([z.number(), z.string()]).nullish(),
  transportCost: z.union([z.number(), z.string()]).nullish(),
  availableDeposit: z.union([z.number(), z.string()]).nullish(),
  items: z.array(billingItemSchema).optional(),
  damages: z.array(billingDamageSchema).optional(),
});

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
  const parsed = updateBillingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid billing payload', 400);
  }
  try {
    const updated = await BillingService.updateBilling(id, parsed.data);
    return json(updated);
  } catch (err) {
    const message = (err as Error).message;
    const status = message === 'Billing not found' ? 404 : 400;
    return jsonError(`Error updating billing: ${message}`, status);
  }
}
