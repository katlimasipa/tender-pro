import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatZAR, formatDate } from "./format";

export interface TenderItem {
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface PdfData {
  title: string;
  tenderNumber?: string;
  quotationRef?: string;
  clientName?: string;
  clientAddress?: string;
  notes?: string;
  vatInclusive: boolean;
  vatRate: number;
  items: TenderItem[];
  company: {
    name: string;
    registration_number?: string | null;
    vat_number?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    address?: string | null;
    letterhead_url?: string | null;
    website?: string | null;
    logo_url?: string | null;
    signature_url?: string | null;
    primary_color?: string | null;
    accent_color?: string | null;
    csd_number?: string | null;
    bank_name?: string | null;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    bank_branch_code?: string | null;
    bank_account_type?: string | null;
    bank_swift?: string | null;
    payment_reference?: string | null;
  };
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

const hexToRgb = (hex?: string | null, fallback: [number, number, number] = [28, 56, 44]): [number, number, number] => {
  if (!hex) return fallback;
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return fallback;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
};

const luminance = ([r, g, b]: [number, number, number]) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export function computeTotals(items: TenderItem[], vatRate: number, vatInclusive: boolean) {
  const lineSum = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  if (vatInclusive) {
    const subtotal = lineSum / (1 + vatRate / 100);
    const vatAmount = lineSum - subtotal;
    return { subtotal, vatAmount, grandTotal: lineSum };
  }
  const vatAmount = (lineSum * vatRate) / 100;
  return { subtotal: lineSum, vatAmount, grandTotal: lineSum + vatAmount };
}

export async function generateTenderPDF(data: PdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 44;
  const FONT = "helvetica";

  const primary = hexToRgb(data.company.primary_color, [28, 56, 44]);
  const accent = hexToRgb(data.company.accent_color, [200, 147, 43]);
  const onPrimary: [number, number, number] = luminance(primary) > 0.6 ? [20, 24, 22] : [250, 248, 242];
  const ink: [number, number, number] = [22, 26, 24];
  const muted: [number, number, number] = [120, 124, 120];
  const hairline: [number, number, number] = [228, 224, 216];
  const softBg: [number, number, number] = [251, 249, 244];

  // Density heuristic: tighter spacing when there are many rows so we fit on one page
  const rowCount = data.items.length;
  const dense = rowCount > 8;
  const veryDense = rowCount > 14;

  // ========== HEADER BAND ==========
  const headerH = veryDense ? 86 : dense ? 96 : 104;
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageW, headerH, "F");
  // accent stripe
  doc.setFillColor(...accent);
  doc.rect(0, headerH, pageW, 3, "F");

  // Logo (top-left)
  let textStartX = margin;
  if (data.company.logo_url) {
    try {
      const logo = await loadImage(data.company.logo_url);
      const maxH = veryDense ? 48 : dense ? 56 : 62;
      const ratio = logo.width / logo.height;
      const h = maxH;
      const w = Math.min(h * ratio, 140);
      doc.addImage(logo, "PNG", margin, (headerH - h) / 2, w, h);
      textStartX = margin + w + 16;
    } catch { /* skip */ }
  }

  // Company name + contact (next to logo)
  doc.setTextColor(...onPrimary);
  doc.setFont(FONT, "bold");
  doc.setFontSize(veryDense ? 15 : 17);
  doc.text(data.company.name || "Company", textStartX, veryDense ? 36 : 40);

  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  const contactBits = [
    data.company.address,
    [data.company.contact_phone, data.company.contact_email].filter(Boolean).join("  •  "),
    data.company.website,
  ].filter(Boolean) as string[];
  contactBits.forEach((line, i) => doc.text(line, textStartX, (veryDense ? 50 : 56) + i * 11));

  // ========== DOCUMENT TITLE ==========
  let cursorY = headerH + (dense ? 26 : 32);
  doc.setTextColor(...ink);
  doc.setFont(FONT, "bold");
  doc.setFontSize(dense ? 18 : 21);
  doc.text((data.title || "Quotation").toUpperCase(), margin, cursorY);

  // small accent underline
  doc.setFillColor(...accent);
  doc.rect(margin, cursorY + 4, 36, 2, "F");

  cursorY += dense ? 22 : 26;

  // ========== INFO BLOCK ==========
  const labelGap = 11;
  const lineGap = 12;

  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("QUOTATION FOR", margin, cursorY);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ink);
  const clientLines: string[] = [];
  if (data.clientName) clientLines.push(data.clientName);
  if (data.clientAddress) {
    data.clientAddress.split(/\r?\n/).forEach(l => l.trim() && clientLines.push(l.trim()));
  }
  if (clientLines.length === 0) clientLines.push("—");
  clientLines.forEach((l, i) => doc.text(l, margin, cursorY + labelGap + i * lineGap));

  // Right meta
  const rightX = pageW - margin;
  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ink);
  if (data.tenderNumber) {
    doc.text(`Quotation No : ${data.tenderNumber}`, rightX, cursorY, { align: "right" });
  }
  doc.text(`Quotation Date : ${formatDate(new Date())}`, rightX, cursorY + lineGap, { align: "right" });

  const clientBlockBottom = cursorY + labelGap + clientLines.length * lineGap;
  let refY = clientBlockBottom + 10;

  if (data.quotationRef) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
    doc.text(`QUOTATION REF: ${data.quotationRef}`, margin, refY);
  }
  if (data.company.csd_number) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(`CSD NO: ${data.company.csd_number}`, rightX, refY, { align: "right" });
  }

  cursorY = refY + 14;

  if (data.company.vat_number || data.company.registration_number) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    const issuer = [
      data.company.vat_number ? `VAT ${data.company.vat_number}` : null,
      data.company.registration_number ? `Reg ${data.company.registration_number}` : null,
    ].filter(Boolean).join("   •   ");
    doc.text(issuer, rightX, cursorY, { align: "right" });
  }

  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY + 6, pageW - margin, cursorY + 6);
  cursorY += dense ? 16 : 20;

  // ========== TABLE ==========
  const body = data.items.map((it) => [
    it.product,
    String(it.quantity),
    formatZAR(it.unitPrice),
    formatZAR(it.quantity * it.unitPrice),
  ]);

  const cellPadV = veryDense ? 5 : dense ? 7 : 9;
  const tableFontSize = veryDense ? 8.5 : dense ? 9.5 : 10;

  autoTable(doc, {
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"]],
    body,
    startY: cursorY,
    margin: { left: margin, right: margin },
    styles: {
      font: FONT,
      fontSize: tableFontSize,
      cellPadding: { top: cellPadV, right: 10, bottom: cellPadV, left: 10 },
      textColor: ink,
      lineColor: hairline,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: primary,
      textColor: onPrimary,
      fontStyle: "bold",
      fontSize: veryDense ? 8 : 8.5,
      cellPadding: { top: cellPadV + 1, right: 10, bottom: cellPadV + 1, left: 10 },
    },
    alternateRowStyles: { fillColor: softBg },
    columnStyles: {
      1: { halign: "right", cellWidth: 46 },
      2: { halign: "right", cellWidth: 92 },
      3: { halign: "right", cellWidth: 100, fontStyle: "bold" },
    },
  });

  let lastY = (doc as any).lastAutoTable.finalY;

  // ========== TOTALS BLOCK ==========
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  const totalsW = 230;
  const totalsX = pageW - margin - totalsW;
  const totalsTopGap = dense ? 10 : 14;
  let ty = lastY + totalsTopGap;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text("Subtotal", totalsX + 12, ty + 12);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.subtotal), totalsX + totalsW - 12, ty + 12, { align: "right" });

  doc.setTextColor(...muted);
  doc.text(`VAT ${data.vatRate}%${data.vatInclusive ? " (incl.)" : ""}`, totalsX + 12, ty + 28);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.vatAmount), totalsX + totalsW - 12, ty + 28, { align: "right" });

  // Grand total bar
  const gtH = dense ? 32 : 36;
  const gtY = ty + 40;
  doc.setFillColor(...primary);
  doc.rect(totalsX, gtY, totalsW, gtH, "F");
  doc.setFillColor(...accent);
  doc.rect(totalsX, gtY, 3, gtH, "F");
  doc.setTextColor(...onPrimary);
  doc.setFont(FONT, "bold");
  doc.setFontSize(9.5);
  doc.text("GRAND TOTAL", totalsX + 14, gtY + 14);
  doc.setFontSize(dense ? 13 : 15);
  doc.text(formatZAR(totals.grandTotal), totalsX + totalsW - 12, gtY + (dense ? 23 : 25), { align: "right" });

  lastY = gtY + gtH;

  // ========== NOTES ==========
  let notesBottom = lastY;
  if (data.notes) {
    let ny = lastY + (dense ? 16 : 22);
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("NOTES & TERMS", margin, ny);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    const split = doc.splitTextToSize(data.notes, pageW - margin * 2 - totalsW - 20);
    doc.text(split, margin, ny + 12);
    notesBottom = ny + 12 + split.length * 11;
  }
  lastY = Math.max(lastY, notesBottom);

  // ========== BOTTOM-PINNED FOOTER GROUP ==========
  const c = data.company;
  const bankRows: [string, string][] = [];
  if (c.bank_account_name) bankRows.push(["NAME", c.bank_account_name]);
  if (c.bank_name) bankRows.push(["BANK", c.bank_name]);
  if (c.bank_account_number) bankRows.push(["ACC NO", c.bank_account_number]);
  if (c.bank_branch_code) bankRows.push(["BRANCH", c.bank_branch_code]);
  if (c.bank_account_type) bankRows.push(["TYPE", c.bank_account_type]);
  if (c.bank_swift) bankRows.push(["SWIFT", c.bank_swift]);

  // Pre-measure bank box (compact)
  const padX = 10;
  const padY = 8;
  const titleH = 11;
  const rowH = 10;
  const labelGapX = 8;
  const titleText = "BANK ACCOUNT DETAILS";
  doc.setFont(FONT, "bold");
  doc.setFontSize(7.5);
  let bankBoxW = 0;
  let bankBoxH = 0;
  let bankLabelColW = 0;
  let bankValueColW = 0;
  if (bankRows.length > 0) {
    let titleW = doc.getTextWidth(titleText);
    doc.setFont(FONT, "bold");
    doc.setFontSize(7.5);
    bankRows.forEach(([k]) => {
      const w = doc.getTextWidth(`${k}:`);
      if (w > bankLabelColW) bankLabelColW = w;
    });
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    bankRows.forEach(([, v]) => {
      const w = doc.getTextWidth(String(v).toUpperCase());
      if (w > bankValueColW) bankValueColW = w;
    });
    const contentW = Math.max(titleW, bankLabelColW + labelGapX + bankValueColW);
    bankBoxW = Math.min(contentW + padX * 2, pageW - margin * 2 - 220);
    bankBoxH = padY + titleH + bankRows.length * rowH + padY - 4;
  }

  const sigBlockH = 60;
  const footerBlockH = 32;
  const gapBankToSig = 16;
  const gapSigToFooter = 18;
  const bottomBlockH = Math.max(bankBoxH, sigBlockH) + gapSigToFooter + footerBlockH + 10;

  // Decide whether to add a new page — only when truly necessary
  const minTopForBottomBlock = pageH - bottomBlockH - margin;
  const requiredGap = 20;
  if (lastY + requiredGap > minTopForBottomBlock) {
    doc.addPage();
  }

  const footerHairlineY = pageH - 42;
  const sigY = footerHairlineY - 16 - gapSigToFooter;

  // ----- Bank box (right) at same vertical band as signature -----
  if (bankRows.length > 0) {
    const boxX = pageW - margin - bankBoxW;
    const boxY = sigY - sigBlockH + 6;
    // soft fill + accent border
    doc.setFillColor(...softBg);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.9);
    doc.rect(boxX, boxY, bankBoxW, bankBoxH, "FD");

    doc.setFont(FONT, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(titleText, boxX + padX, boxY + padY + 2);

    doc.setFontSize(7.5);
    doc.setTextColor(...ink);
    bankRows.forEach((row, i) => {
      const ry = boxY + padY + titleH + 4 + i * rowH;
      doc.setFont(FONT, "bold");
      doc.text(`${row[0]}:`, boxX + padX, ry);
      doc.setFont(FONT, "normal");
      doc.text(String(row[1]).toUpperCase(), boxX + padX + bankLabelColW + labelGapX, ry);
    });
  }

  // ----- Signature (left) -----
  const sigW = 190;
  if (data.company.signature_url) {
    try {
      const sig = await loadImage(data.company.signature_url);
      const ratio = sig.width / sig.height;
      const h = 36;
      const w = Math.min(h * ratio, sigW - 20);
      doc.addImage(sig, "PNG", margin, sigY - h - 4, w, h);
    } catch { /* skip */ }
  }
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.6);
  doc.line(margin, sigY, margin + sigW, sigY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("AUTHORISED SIGNATURE", margin, sigY + 11);

  const dateLineX = margin + sigW + 16;
  const dateLineW = 130;
  doc.line(dateLineX, sigY, dateLineX + dateLineW, sigY);
  doc.text("DATE", dateLineX, sigY + 11);

  // ----- Footer line -----
  doc.setDrawColor(...hairline);
  doc.line(margin, footerHairlineY, pageW - margin, footerHairlineY);
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  const footer = [
    data.company.name,
    data.company.website,
    data.company.contact_email,
    data.company.contact_phone,
  ].filter(Boolean).join("   •   ");
  doc.text(footer, pageW / 2, pageH - 22, { align: "center" });

  return doc.output("blob");
}
