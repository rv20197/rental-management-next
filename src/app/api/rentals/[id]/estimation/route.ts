import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rentals } from '@/lib/db/schema';
import { calculateMonthsRented } from '@/lib/billing/months';
import { generateRentalEstimationPdf } from '@/lib/pdf/rental-estimation-pdf';
import { jsonError, requireAuth } from '@/lib/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const rentalId = parseInt(id, 10);
  if (!Number.isFinite(rentalId)) return jsonError('Rental not found.', 404);

  const rental = await db.query.rentals.findFirst({
    where: eq(rentals.id, rentalId),
    with: {
      Customer: true,
      Item: true,
      RentalItems: { with: { Item: true } },
    },
  });
  if (!rental) return jsonError('Rental not found.', 404);

  const startDate = new Date(rental.startDate);
  const endDate = new Date(rental.endDate);
  const mRented = calculateMonthsRented(startDate, endDate, endDate);

  let billAmount = 0;
  const billingItemsForPdf: unknown[] = [];
  if (rental.RentalItems && rental.RentalItems.length > 0) {
    for (const ri of rental.RentalItems) {
      const storedUnit = ri.unitPrice != null ? parseFloat(ri.unitPrice) : null;
      const monthlyRate = storedUnit != null ? storedUnit : ri.Item?.monthlyRate ? parseFloat(ri.Item.monthlyRate) : 0;
      const total = ri.quantity * monthlyRate * mRented;
      billAmount += total;
      billingItemsForPdf.push({
        Item: ri.Item,
        quantity: ri.quantity,
        rate: monthlyRate,
        total,
      });
    }
  } else if (rental.Item) {
    const monthlyRate = parseFloat(rental.Item.monthlyRate);
    billAmount = (rental.quantity || 0) * monthlyRate * mRented;
  }

  const labourCost = Number(rental.labourCost) || 0;
  const transportCost = Number(rental.transportCost) || 0;
  const depositAmount = Number(rental.depositAmount) || 0;
  const totalAmount = billAmount + labourCost + transportCost + depositAmount;

  const mockBilling = {
    id: rental.id,
    createdAt: rental.createdAt,
    dueDate: rental.endDate,
    status: 'pending',
    amount: totalAmount,
    returnedQuantity: null,
    Rental: rental,
    BillingItems: billingItemsForPdf,
    labourCost,
    transportCost,
    depositAmount,
    totalDamages: 0,
    depositUsed: 0,
    availableDeposit: depositAmount,
  };

  const { buffer, filename } = await generateRentalEstimationPdf(mockBilling);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
