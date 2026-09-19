import { generateRentalInvoicePdf } from '@/lib/pdf/rental-invoice-pdf';
import { jsonError, requireAuth } from '@/lib/http';
import { BillingService } from '@/lib/services/billingService';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const billing = await BillingService.getBillingById(id);
  if (!billing) return jsonError('Billing not found', 404);

  const { buffer, filename } = await generateRentalInvoicePdf(billing);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
