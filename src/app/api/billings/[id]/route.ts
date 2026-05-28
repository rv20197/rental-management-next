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
