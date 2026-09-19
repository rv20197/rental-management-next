import PDFDocument from 'pdfkit';

// Low-level layout constants shared by every rental PDF document type.
export const MARGIN = 50;
export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
export const COL_ITEM_X = 50;
export const COL_ITEM_W = 160;
export const COL_DATE_X = 210;
export const COL_DATE_W = 80;
export const COL_RATE_X = 290;
export const COL_RATE_W = 80;
export const COL_QTY_X = 370;
export const COL_QTY_W = 50;
export const COL_TOTAL_X = 420;
export const COL_TOTAL_W = 110;

// Seller/company data shared by every document type. Not layout logic -
// just the static values each template renders in its own header.
export const SELLER_COMPANY = (): string => process.env.FROM_NAME || 'Rental Management';
export const SELLER_ADDRESS =
  'Gala.no. 08, Haria Industrial Estate, Behind Universal Petrol Pump, Next to Capitol Hotel, Majiwada, Thane (W) - 400608.';
export const SELLER_PHONE = '+91-9821509815';

export interface PdfResult {
  buffer: Buffer;
  filename: string;
}

export const formatCurrency = (value: unknown): string => {
  const num = Number(parseFloat(String(value)) || 0);
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDate = (dateVal: unknown): string => {
  const date = new Date(dateVal as string | number | Date);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const drawStatusBadge = (
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

export const checkPageBreak = (
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

export const safeFilenamePart = (raw: unknown): string =>
  String(raw || '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'Customer';
