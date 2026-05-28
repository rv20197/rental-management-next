import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billings } from '@/lib/db/schema';
import { generateRentalPdf } from '@/lib/pdf/rental-pdf';
import { jsonError, requireAuth } from '@/lib/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const billingId = parseInt(id, 10);
  if (!Number.isFinite(billingId)) return jsonError('Billing not found', 404);

  const billing = await db.query.billings.findFirst({
    where: eq(billings.id, billingId),
    with: {
      Rental: {
        with: {
          Customer: true,
          Item: true,
          RentalItems: { with: { Item: true } },
        },
      },
      Customer: true,
      BillingItems: { with: { Item: true } },
      BillingDamages: true,
    },
  });
  if (!billing) return jsonError('Billing not found', 404);

  const { buffer, filename } = await generateRentalPdf(billing);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
