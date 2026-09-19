import PDFDocument from 'pdfkit';
import {
  MARGIN,
  RIGHT_EDGE,
  COL_ITEM_X,
  COL_ITEM_W,
  COL_DATE_X,
  COL_DATE_W,
  COL_RATE_X,
  COL_RATE_W,
  COL_QTY_X,
  COL_QTY_W,
  COL_TOTAL_X,
  COL_TOTAL_W,
  SELLER_COMPANY,
  SELLER_ADDRESS,
  SELLER_PHONE,
  formatCurrency,
  formatDate,
  drawStatusBadge,
  checkPageBreak,
  safeFilenamePart,
  type PdfResult,
} from './pdfShared';

export type RentalInvoicePdfResult = PdfResult;

/**
 * Rental Invoice PDF - generated for billing records, before or after return.
 * Always shows "Rental Invoice" / "Invoice #" and a dynamic Billing Period
 * (rental start date to rental end date). The End Date and Return Date rows
 * only appear once items have actually been returned.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateRentalInvoicePdf(billing: any): Promise<RentalInvoicePdfResult> {
  return new Promise((resolve, reject) => {
    try {
      const hasBeenReturned = billing.returnedQuantity != null || billing.Rental?.status === 'returned';
      const docTitle = 'RENTAL INVOICE';

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
        const filename = `${customerName}_${dateStr}_Invoice.pdf`;
        resolve({ buffer: Buffer.concat(chunks), filename });
      });

      const sellerCompany = SELLER_COMPANY();
      const customer = billing.Rental?.Customer || billing.Customer;

      let y = MARGIN;

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a1a1a').text(sellerCompany, MARGIN, y, { lineBreak: false });
      y += 25;

      doc.fontSize(9).font('Helvetica').fillColor('#555555');
      doc.text(SELLER_ADDRESS, MARGIN, y, { width: 250 });
      y += 40;
      doc.text(`Phone: ${SELLER_PHONE}`, MARGIN, y, { lineBreak: false });
      y += 15;

      const rightColX = 330;
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(docTitle, rightColX, MARGIN, { lineBreak: false });
      doc.fontSize(10).font('Helvetica').fillColor('#444444');
      doc.text(`Invoice #${billing.id}`, rightColX, MARGIN + 22, { lineBreak: false });
      doc.text(`Date: ${formatDate(billing.createdAt)}`, rightColX, MARGIN + 37, { lineBreak: false });
      doc.text(`Due: ${formatDate(billing.dueDate)}`, rightColX, MARGIN + 52, { lineBreak: false });

      const startDate = billing.Rental?.startDate;
      const endDate = billing.Rental?.endDate;
      let dateY = MARGIN + 67;
      if (startDate) {
        doc.text(`Rental Start Date: ${formatDate(startDate)}`, rightColX, dateY, { lineBreak: false });
        dateY += 15;
      }
      if (startDate && endDate) {
        doc.text(`Billing Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, rightColX, dateY, {
          lineBreak: false,
        });
        dateY += 15;
      }
      if (hasBeenReturned && endDate) {
        doc.text(`End Date: ${formatDate(endDate)}`, rightColX, dateY, { lineBreak: false });
        dateY += 15;
        doc.text(`Return Date: ${formatDate(billing.returnDate || billing.createdAt)}`, rightColX, dateY, {
          lineBreak: false,
        });
        dateY += 15;
      }

      const badgeY = dateY;
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
      if (hasBeenReturned) {
        doc.text('Return Date', COL_DATE_X, headerY + 3, { width: COL_DATE_W, align: 'right', lineBreak: false });
      }
      doc.text('Monthly Rate', COL_RATE_X, headerY + 3, { width: COL_RATE_W, align: 'right', lineBreak: false });
      doc.text('Quantity', COL_QTY_X, headerY + 3, { width: COL_QTY_W, align: 'right', lineBreak: false });
      doc.text('Total Amount', COL_TOTAL_X, headerY + 3, { width: COL_TOTAL_W, align: 'right', lineBreak: false });

      y = headerY + 22;

      doc.fontSize(9).font('Helvetica').fillColor('#444444');
      let rowBgColor = true;

      if (billing.BillingItems && billing.BillingItems.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        billing.BillingItems.forEach((bi: any) => {
          if (rowBgColor) {
            doc.rect(MARGIN, y - 3, RIGHT_EDGE - MARGIN, 16).fill('#f9f9f9');
          }
          rowBgColor = !rowBgColor;

          doc.fillColor('#444444').font('Helvetica');
          const itemName = bi.Item?.name || bi.description || 'Unknown Item';
          const itemDate = hasBeenReturned && (bi.createdAt || billing.returnDate || billing.createdAt)
            ? formatDate(bi.createdAt || billing.returnDate || billing.createdAt)
            : '';
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const totalDue = !hasBeenReturned
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
        `Thank you for your business! For queries contact ${SELLER_PHONE}`,
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
