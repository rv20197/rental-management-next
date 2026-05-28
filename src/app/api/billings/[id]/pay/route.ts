import { BillingService } from '@/lib/services/billingService';
import { json, jsonError, requireAuth } from '@/lib/http';

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const billing = await BillingService.payBilling(id);
    return json({ message: 'Billing updated to paid successfully', billing });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === 'Billing not found' ? 404 : msg === 'Billing is already paid' ? 400 : 500;
    return jsonError(msg, status);
  }
}
