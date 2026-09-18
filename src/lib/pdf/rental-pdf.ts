import PDFDocument from 'pdfkit';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
const COL_ITEM_X = 50;
const COL_ITEM_W = 160;
const COL_DATE_X = 210;
const COL_DATE_W = 80;
const COL_RATE_X = 290;
const COL_RATE_W = 80;
const COL_QTY_X = 370;
const COL_QTY_W = 50;
const COL_TOTAL_X = 420;
const COL_TOTAL_W = 110;

const formatCurrency = (value: unknown): string => {
  const num = Number(parseFloat(String(value)) || 0);
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateVal: unknown): string => {
  const date = new Date(dateVal as string | number | Date);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const drawStatusBadge = (
  doc: InstanceType<typeof PDFDocument>,
  status: string,
  x: number,
  y: number,
) => {
  const statusUpper = status.toUpperCase();
  const badgeColors: Record<string, string | { bg: string; fg: string }> = {
    PAID: { bg: '#10b981', fg: '#ffffff' },
    PENDING: '#f59e0b',
    RETURNED: '#9ca3af',
  };
  const colors = badgeColors[statusUpper] || badgeColors.PENDING;

  if (typeof colors === 'object') {
    doc.rect(x - 5, y - 3, 60, 16).fill(colors.bg);
    doc.fillColor(colors.fg);
  } else {
    doc.rect(x - 5, y - 3, 60, 16).fill(colors);
    doc.fillColor('#ffffff');
  }

  doc.fontSize(9).font('Helvetica-Bold').text(statusUpper, x, y, { width: 60 });
  doc.fillColor('#444444').font('Helvetica');
};

const checkPageBreak = (
  doc: InstanceType<typeof PDFDocument>,
  currentY: number,
  neededSpace: number,
): number => {
  if (currentY + neededSpace > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return MARGIN + 20;
  }
  return currentY;
};

const safeFilenamePart = (raw: unknown): string =>
  String(raw || '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'Customer';

export interface RentalPdfResult {
  buffer: Buffer;
  filename: string;
}

export function generateRentalPdf(billing: any): Promise<RentalPdfResult> {
  return new Promise((resolve, reject) => {
    try {
      const isEstimation = billing.returnedQuantity == null;
      const docTitle = isEstimation ? 'RENTAL ESTIMATION' : 'RENTAL BILL';

      const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('error', reject);
      doc.on('end', () => {
        const customer = billing.Rental?.Customer || billing.Customer;
        const customerName = customer
          ? `${safeFilenamePart(customer.firstName)}_${safeFilenamePart(customer.lastName)}`
          : 'Customer';
        const dateStr = new Date(billing.createdAt || new Date()).toISOString().split('T')[0];
        const type = isEstimation ? 'Estimate' : 'Bill';
        const filename = `${customerName}_${dateStr}_${type}.pdf`;
        resolve({ buffer: Buffer.concat(chunks), filename });
      });

      const sellerCompany = process.env.FROM_NAME || 'Rental Management';
      const sellerAddress =
        'Gala.no. 08, Haria Industrial Estate, Behind Universal Petrol Pump, Next to Capitol Hotel, Majiwada, Thane (W) - 400608.';
      const sellerPhone = '+91-9821509815';
      const customer = billing.Rental?.Customer || billing.Customer;

      let y = MARGIN;

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a1a1a').text(sellerCompany, MARGIN, y, { lineBreak: false });
      y += 25;

      doc.fontSize(9).font('Helvetica').fillColor('#555555');
      doc.text(sellerAddress, MARGIN, y, { width: 250 });
      y += 40;
      doc.text(`Phone: ${sellerPhone}`, MARGIN, y, { lineBreak: false });
      y += 15;

      const rightColX = 330;
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(docTitle, rightColX, MARGIN, { lineBreak: false });
      doc.fontSize(10).font('Helvetica').fillColor('#444444');
      doc.text(`${isEstimation ? 'Estimation' : 'Bill'} #${billing.id}`, rightColX, MARGIN + 22, { lineBreak: false });
      doc.text(`Date: ${formatDate(billing.createdAt)}`, rightColX, MARGIN + 37, { lineBreak: false });
      doc.text(`Due: ${formatDate(billing.dueDate)}`, rightColX, MARGIN + 52, { lineBreak: false });

      const startDate = billing.Rental?.startDate;
      const endDate = billing.Rental?.endDate;
      if (startDate) doc.text(`Start Date: ${formatDate(startDate)}`, rightColX, MARGIN + 67, { lineBreak: false });
      if (endDate) doc.text(`End Date: ${formatDate(endDate)}`, rightColX, MARGIN + 82, { lineBreak: false });
      else if (isEstimation) doc.text(`End Date: N/A`, rightColX, MARGIN + 82, { lineBreak: false });

      const badgeY = endDate ? MARGIN + 97 : MARGIN + 67;
      drawStatusBadge(doc, billing.status || 'PENDING', rightColX, badgeY);
      y = Math.max(y, badgeY + 20);

      doc.strokeColor('#cccccc').lineWidth(1).moveTo(MARGIN, y).lineTo(RIGHT_EDGE, y).stroke();
      y += 15;

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a').text('Customer Details', MARGIN, y, { lineBreak: false });
      y += 15;

      doc.fontSize(9).font('Helvetica').fillColor('#444444');
      const labelWidth = 100;
      const detailX = MARGIN + labelWidth + 10;

      doc.text('Name:', MARGIN, y, { lineBreak: false });
      doc.text(customer ? `${customer.firstName} ${customer.lastName}` : 'N/A', detailX, y, { lineBreak: false });
      y += 12;

      doc.text('Email:', MARGIN, y, { lineBreak: false });
      doc.text(customer?.email || 'N/A', detailX, y, { lineBreak: false });
      y += 12;

      doc.text('Phone:', MARGIN, y, { lineBreak: false });
      doc.text(customer?.phone || 'N/A', detailX, y, { lineBreak: false });
      y += 12;

      const customerAddress =
        billing.Rental?.address?.trim() || customer?.address?.trim() || billing.address?.trim() || 'N/A';
      const addressHeight = doc.heightOfString(customerAddress, { width: RIGHT_EDGE - detailX });
      doc.text('Address:', MARGIN, y, { lineBreak: false });
      doc.text(customerAddress, detailX, y, { width: RIGHT_EDGE - detailX });
      y += Math.max(18, addressHeight + 6);

      doc.strokeColor('#cccccc').lineWidth(1).moveTo(MARGIN, y).lineTo(RIGHT_EDGE, y).stroke();
      y += 15;

      y = checkPageBreak(doc, y, 80);

      const headerY = y;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
      doc.rect(MARGIN, headerY, RIGHT_EDGE - MARGIN, 18).fill('#333333');

      doc.fillColor('#ffffff').text('Item Name', COL_ITEM_X + 2, headerY + 3, { width: COL_ITEM_W, lineBreak: false });
      doc.text('Return Date', COL_DATE_X, headerY + 3, { width: COL_DATE_W, align: 'right', lineBreak: false });
      doc.text('Monthly Rate', COL_RATE_X, headerY + 3, { width: COL_RATE_W, align: 'right', lineBreak: false });
      doc.text('Quantity', COL_QTY_X, headerY + 3, { width: COL_QTY_W, align: 'right', lineBreak: false });
      doc.text('Total Amount', COL_TOTAL_X, headerY + 3, { width: COL_TOTAL_W, align: 'right', lineBreak: false });

      y = headerY + 22;

      doc.fontSize(9).font('Helvetica').fillColor('#444444');
      let rowBgColor = true;

      if (billing.BillingItems && billing.BillingItems.length > 0) {
        billing.BillingItems.forEach((bi: any) => {
          if (rowBgColor) {
            doc.rect(MARGIN, y - 3, RIGHT_EDGE - MARGIN, 16).fill('#f9f9f9');
          }
          rowBgColor = !rowBgColor;

          doc.fillColor('#444444').font('Helvetica');
          const itemName = bi.Item?.name || bi.description || 'Unknown Item';
          const itemDate = bi.createdAt
            ? formatDate(bi.createdAt)
            : billing.Rental?.endDate
              ? formatDate(billing.Rental.endDate)
              : isEstimation
                ? 'Est. Date'
                : 'N/A';
          doc.text(itemName, COL_ITEM_X + 2, y, { width: COL_ITEM_W, lineBreak: false });
          doc.text(itemDate, COL_DATE_X, y, { width: COL_DATE_W, align: 'right', lineBreak: false });
          doc.text(formatCurrency(bi.rate || 0), COL_RATE_X, y, { width: COL_RATE_W, align: 'right', lineBreak: false });
          doc.text(`${bi.quantity}`, COL_QTY_X, y, { width: COL_QTY_W, align: 'right', lineBreak: false });
          doc.text(formatCurrency(bi.total || 0), COL_TOTAL_X, y, { width: COL_TOTAL_W, align: 'right', lineBreak: false });

          y += 16;
        });
      } else {
        if (rowBgColor) doc.rect(MARGIN, y - 3, RIGHT_EDGE - MARGIN, 16).fill('#f9f9f9');
        doc.fillColor('#999999').font('Helvetica').text('No items added', COL_ITEM_X + 2, y, { lineBreak: false });
        y += 16;
      }

      doc.strokeColor('#cccccc').lineWidth(1).moveTo(MARGIN, y).lineTo(RIGHT_EDGE, y).stroke();
      y += 15;

      y = checkPageBreak(doc, y, 100);

      const summaryLabelX = 50;
      const summaryValueX = 420;
      const summaryValueW = 110;

      doc.fontSize(9).font('Helvetica').fillColor('#444444');

      let rentalCharges = 0;
      if (billing.BillingItems && billing.BillingItems.length > 0) {
        rentalCharges = billing.BillingItems.reduce((sum: number, bi: any) => {
          const itemTotal = Number(
            parseFloat(bi.total) || parseFloat(bi.rate || 0) * parseInt(bi.quantity || 0),
          );
          return sum + itemTotal;
        }, 0);
      } else {
        rentalCharges = Number(parseFloat(billing.baseAmount) || 0);
      }

      const labourCost = Number(parseFloat(billing.labourCost) || 0);
      const transportCost = Number(parseFloat(billing.transportCost) || 0);
      const returnLabourCost = Number(parseFloat(billing.returnLabourCost || billing.Rental?.returnLabourCost) || 0);
      const returnTransportCost = Number(parseFloat(billing.returnTransportCost || billing.Rental?.returnTransportCost) || 0);
      const damagesCost = Number(parseFloat(billing.damagesCost || billing.Rental?.damagesCost) || 0);
      const depositAmount = Number(parseFloat(billing.depositAmount) || 0);

      doc.font('Helvetica').fontSize(10).text('Base Amount:', summaryLabelX, y, { width: 300, lineBreak: false });
      doc.font('Helvetica').fontSize(10).text(formatCurrency(rentalCharges), summaryValueX, y, { width: summaryValueW, align: 'right', lineBreak: false });
      y += 20;

      if (transportCost > 0) {
        doc.font('Helvetica').fontSize(10).text('Transport Cost:', summaryLabelX, y, { width: 300, lineBreak: false });
        doc.font('Helvetica').fontSize(10).text(formatCurrency(transportCost), summaryValueX, y, { width: summaryValueW, align: 'right', lineBreak: false });
        y += 20;
      }
      if (labourCost > 0) {
        doc.font('Helvetica').fontSize(10).text('Labour Cost:', summaryLabelX, y, { width: 300, lineBreak: false });
        doc.font('Helvetica').fontSize(10).text(formatCurrency(labourCost), summaryValueX, y, { width: summaryValueW, align: 'right', lineBreak: false });
        y += 20;
      }
      if (depositAmount > 0) {
        doc.font('Helvetica').fontSize(10).fillColor('#2563eb').text('Deposit Collected:', summaryLabelX, y, { width: 300, lineBreak: false });
        doc.font('Helvetica').fontSize(10).fillColor('#2563eb').text(formatCurrency(depositAmount), summaryValueX, y, { width: summaryValueW, align: 'right', lineBreak: false });
        doc.fillColor('#444444');
        y += 20;
      }

      y += 6;

      const totalDue = isEstimation
        ? rentalCharges + labourCost + transportCost
        : rentalCharges + returnLabourCost + returnTransportCost + damagesCost;

      doc.font('Helvetica-Bold').fontSize(11).text('Total Due:', summaryLabelX, y, { width: 300, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(11).text(formatCurrency(totalDue), summaryValueX, y, { width: summaryValueW, align: 'right', lineBreak: false });
      y += 20;

      doc.fillColor('#444444').font('Helvetica');
      y += 5;

      y = checkPageBreak(doc, y, 50);

      doc.strokeColor('#cccccc').lineWidth(1).moveTo(MARGIN, y).lineTo(RIGHT_EDGE, y).stroke();
      y += 12;

      doc.fontSize(10).fillColor('#444444');
      if (billing.status === 'paid' && billing.paymentDate) {
        doc.fillColor('green').text(`Paid on: ${formatDate(billing.paymentDate)}`, MARGIN, y, { lineBreak: false });
      } else if (billing.status === 'returned') {
        doc.fillColor('#6b7280').text('Returned - Locked for editing', MARGIN, y, { lineBreak: false });
      } else {
        doc.fillColor('#ea580c').text(`Payment due by: ${formatDate(billing.dueDate)}`, MARGIN, y, { lineBreak: false });
      }
      y += 15;

      doc.fontSize(8).font('Helvetica').fillColor('#999999').text(
        'Thank you for your business! For queries contact +91-9821509815',
        MARGIN,
        y,
        { align: 'center', width: RIGHT_EDGE - MARGIN },
      );

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
