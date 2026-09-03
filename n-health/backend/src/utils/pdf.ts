import { PDFDocument, StandardFonts, PDFFont, PDFPage, rgb } from 'pdf-lib';

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 595;
const MARGIN = 40;
const BRAND = rgb(0.102, 0.451, 0.910); // matches the mobile app's primary blue
const TEXT = rgb(0.126, 0.129, 0.141);
const MUTED = rgb(0.373, 0.388, 0.408);
const LINE = rgb(0.878, 0.878, 0.878);

export interface PdfDocHandle {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

/** Starts a new one-page A6-ish document with the N-Health header already drawn. */
export async function startDocument(title: string, subtitle?: string): Promise<PdfDocHandle> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - 50;
  page.drawText('N-Health', { x: MARGIN, y, size: 20, font: bold, color: BRAND });
  y -= 26;
  page.drawText(title, { x: MARGIN, y, size: 14, font: bold, color: TEXT });
  y -= 18;
  if (subtitle) {
    page.drawText(subtitle, { x: MARGIN, y, size: 10, font, color: MUTED });
    y -= 18;
  }
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: LINE });
  y -= 20;

  return { doc, page, font, bold, y };
}

/** Draws a "label: value" line and moves the cursor down. */
export function drawField(h: PdfDocHandle, label: string, value: string) {
  h.page.drawText(label.toUpperCase(), { x: MARGIN, y: h.y, size: 8, font: h.bold, color: MUTED });
  h.y -= 13;
  h.page.drawText(value, { x: MARGIN, y: h.y, size: 12, font: h.font, color: TEXT });
  h.y -= 20;
}

/** Draws a simple 3-column table with a header row. Column labels default to an invoice-style layout. */
export function drawTable(
  h: PdfDocHandle,
  rows: { name: string; qty?: string; amount: string }[],
  headers: { name: string; qty: string; amount: string } = { name: 'ITEM', qty: 'QTY', amount: 'AMOUNT' }
) {
  const colName = MARGIN;
  const colQty = PAGE_WIDTH - MARGIN - 140;
  const colAmount = PAGE_WIDTH - MARGIN - 70;

  h.page.drawText(headers.name, { x: colName, y: h.y, size: 8, font: h.bold, color: MUTED });
  h.page.drawText(headers.qty, { x: colQty, y: h.y, size: 8, font: h.bold, color: MUTED });
  h.page.drawText(headers.amount, { x: colAmount, y: h.y, size: 8, font: h.bold, color: MUTED });
  h.y -= 6;
  h.page.drawLine({ start: { x: MARGIN, y: h.y }, end: { x: PAGE_WIDTH - MARGIN, y: h.y }, thickness: 1, color: LINE });
  h.y -= 16;

  for (const row of rows) {
    h.page.drawText(row.name, { x: colName, y: h.y, size: 10, font: h.font, color: TEXT, maxWidth: 150 });
    if (row.qty) h.page.drawText(row.qty, { x: colQty, y: h.y, size: 10, font: h.font, color: TEXT });
    h.page.drawText(row.amount, { x: colAmount, y: h.y, size: 10, font: h.font, color: TEXT });
    h.y -= 18;
  }
  h.y -= 4;
  h.page.drawLine({ start: { x: MARGIN, y: h.y }, end: { x: PAGE_WIDTH - MARGIN, y: h.y }, thickness: 1, color: LINE });
  h.y -= 20;
}

/** Draws a bold total line, right-aligned-ish. */
export function drawTotal(h: PdfDocHandle, label: string, amount: string) {
  h.page.drawText(label, { x: MARGIN, y: h.y, size: 12, font: h.bold, color: TEXT });
  h.page.drawText(amount, { x: PAGE_WIDTH - MARGIN - 90, y: h.y, size: 14, font: h.bold, color: BRAND });
  h.y -= 24;
}

export function drawFooterNote(h: PdfDocHandle, note: string) {
  h.page.drawText(note, { x: MARGIN, y: 40, size: 8, font: h.font, color: MUTED, maxWidth: PAGE_WIDTH - MARGIN * 2 });
}

export async function finishDocument(h: PdfDocHandle): Promise<Buffer> {
  const bytes = await h.doc.save();
  return Buffer.from(bytes);
}

export function formatNaira(amount: number | string): string {
  return `NGN ${Number(amount).toLocaleString()}`;
}
