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
  const margin = 48;
  const FONT = "helvetica"; // jsPDF's helvetica is metric-compatible with Arial

  const primary = hexToRgb(data.company.primary_color, [28, 56, 44]);
  const accent = hexToRgb(data.company.accent_color, [200, 147, 43]);
  const onPrimary: [number, number, number] = luminance(primary) > 0.6 ? [20, 24, 22] : [250, 248, 242];
  const onAccent: [number, number, number] = luminance(accent) > 0.6 ? [20, 24, 22] : [250, 248, 242];
  const ink: [number, number, number] = [22, 26, 24];
  const muted: [number, number, number] = [110, 116, 112];
  const hairline: [number, number, number] = [225, 222, 215];

  // ========== HEADER BAND ==========
  const headerH = 110;
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageW, headerH, "F");
  // accent stripe
  doc.setFillColor(...accent);
  doc.rect(0, headerH, pageW, 4, "F");

  // Logo (top-left)
  let textStartX = margin;
  if (data.company.logo_url) {
    try {
      const logo = await loadImage(data.company.logo_url);
      const maxH = 64;
      const ratio = logo.width / logo.height;
      const h = maxH;
      const w = Math.min(h * ratio, 140);
      doc.addImage(logo, "PNG", margin, (headerH - h) / 2, w, h);
      textStartX = margin + w + 18;
    } catch { /* skip */ }
  }

  // Company name + contact (next to logo)
  doc.setTextColor(...onPrimary);
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  doc.text(data.company.name || "Company", textStartX, 44);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  const contactBits = [
    data.company.address,
    [data.company.contact_phone, data.company.contact_email].filter(Boolean).join("  •  "),
    data.company.website,
  ].filter(Boolean) as string[];
  contactBits.forEach((line, i) => doc.text(line, textStartX, 60 + i * 12));

  // ========== DOCUMENT TITLE ==========
  let cursorY = headerH + 36;
  doc.setTextColor(...ink);
  doc.setFont(FONT, "bold");
  doc.setFontSize(22);
  doc.text((data.title || "Quotation").toUpperCase(), margin, cursorY);

  cursorY += 26;

  // ========== INFO BLOCK (mirrors uploaded reference) ==========
  // Left column: QUOTATION FOR (client)
  // Right column: Quotation No / Quotation Date
  const labelGap = 12;
  const lineGap = 13;

  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("QUOTATION FOR:", margin, cursorY);

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  const clientLines: string[] = [];
  if (data.clientName) clientLines.push(data.clientName);
  if (data.clientAddress) {
    data.clientAddress.split(/\r?\n/).forEach(l => l.trim() && clientLines.push(l.trim()));
  }
  if (clientLines.length === 0) clientLines.push("—");
  clientLines.forEach((l, i) => doc.text(l, margin, cursorY + labelGap + i * lineGap));

  // Right meta lines (label + value on same row)
  const rightX = pageW - margin;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  if (data.tenderNumber) {
    doc.text(`Quotation No : ${data.tenderNumber}`, rightX, cursorY, { align: "right" });
  }
  doc.text(`Quotation Date : ${formatDate(new Date())}`, rightX, cursorY + lineGap, { align: "right" });

  // Compute lower edge of the info block
  const clientBlockBottom = cursorY + labelGap + clientLines.length * lineGap;
  let refY = clientBlockBottom + 12;

  // QUOTATION REF (left) and CSD NO (right) — bold accent line like reference
  if (data.quotationRef) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ink);
    doc.text(`QUOTATION REF: ${data.quotationRef}`, margin, refY);
  }
  if (data.company.csd_number) {
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text(`CSD NO: ${data.company.csd_number}`, rightX, refY, { align: "right" });
  }

  cursorY = refY + 18;

  // Issuer (VAT / Reg) – kept compact under the ref line
  if (data.company.vat_number || data.company.registration_number) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const issuer = [
      data.company.vat_number ? `VAT ${data.company.vat_number}` : null,
      data.company.registration_number ? `Reg ${data.company.registration_number}` : null,
    ].filter(Boolean).join("   •   ");
    doc.text(issuer, rightX, cursorY, { align: "right" });
  }

  // Hairline divider
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY + 8, pageW - margin, cursorY + 8);
  cursorY += 22;

  // ========== TABLE ==========
  const body = data.items.map((it) => [
    it.product,
    String(it.quantity),
    formatZAR(it.unitPrice),
    formatZAR(it.quantity * it.unitPrice),
  ]);

  autoTable(doc, {
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"]],
    body,
    startY: cursorY,
    margin: { left: margin, right: margin },
    styles: {
      font: FONT,
      fontSize: 10,
      cellPadding: { top: 9, right: 10, bottom: 9, left: 10 },
      textColor: ink,
      lineColor: hairline,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: primary,
      textColor: onPrimary,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 10, right: 10, bottom: 10, left: 10 },
    },
    alternateRowStyles: { fillColor: [250, 248, 243] },
    columnStyles: {
      1: { halign: "right", cellWidth: 50 },
      2: { halign: "right", cellWidth: 95 },
      3: { halign: "right", cellWidth: 105, fontStyle: "bold" },
    },
  });

  let lastY = (doc as any).lastAutoTable.finalY;

  // ========== TOTALS BLOCK (right side) ==========
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  const totalsW = 240;
  const totalsX = pageW - margin - totalsW;
  let ty = lastY + 14;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text("Subtotal", totalsX + 12, ty + 14);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.subtotal), totalsX + totalsW - 12, ty + 14, { align: "right" });

  doc.setTextColor(...muted);
  doc.text(`VAT ${data.vatRate}%${data.vatInclusive ? " (incl.)" : ""}`, totalsX + 12, ty + 32);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.vatAmount), totalsX + totalsW - 12, ty + 32, { align: "right" });

  // Grand total bar
  const gtY = ty + 48;
  doc.setFillColor(...primary);
  doc.rect(totalsX, gtY, totalsW, 38, "F");
  doc.setFillColor(...accent);
  doc.rect(totalsX, gtY, 4, 38, "F");
  doc.setTextColor(...onPrimary);
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.text("GRAND TOTAL", totalsX + 14, gtY + 16);
  doc.setFontSize(15);
  doc.text(formatZAR(totals.grandTotal), totalsX + totalsW - 12, gtY + 25, { align: "right" });

  lastY = gtY + 38;

  // ========== NOTES ==========
  if (data.notes) {
    let ny = lastY + 28;
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text("NOTES & TERMS", margin, ny);
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    const split = doc.splitTextToSize(data.notes, pageW - margin * 2 - totalsW - 24);
    doc.text(split, margin, ny + 14);
    lastY = Math.max(lastY, ny + 14 + split.length * 13);
  }

  // ========== PAYMENT DETAILS ==========
  const c = data.company;
  const bankRows: [string, string][] = [];
  if (c.bank_name) bankRows.push(["Bank", c.bank_name]);
  if (c.bank_account_name) bankRows.push(["Account Name", c.bank_account_name]);
  if (c.bank_account_number) bankRows.push(["Account Number", c.bank_account_number]);
  if (c.bank_branch_code) bankRows.push(["Branch Code", c.bank_branch_code]);
  if (c.bank_account_type) bankRows.push(["Account Type", c.bank_account_type]);
  if (c.bank_swift) bankRows.push(["SWIFT / BIC", c.bank_swift]);
  if (c.payment_reference) bankRows.push(["Reference", c.payment_reference]);

  if (bankRows.length > 0) {
    let py = lastY + 28;
    const blockW = pageW - margin * 2;
    const rowH = 16;
    const headerBarH = 22;
    const blockH = headerBarH + bankRows.length * rowH + 12;

    // Page break if needed
    if (py + blockH > pageH - 140) {
      doc.addPage();
      py = margin;
    }

    // Header bar
    doc.setFillColor(...primary);
    doc.rect(margin, py, blockW, headerBarH, "F");
    doc.setFillColor(...accent);
    doc.rect(margin, py, 4, headerBarH, "F");
    doc.setTextColor(...onPrimary);
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT DETAILS", margin + 14, py + 15);

    // Body
    doc.setDrawColor(...hairline);
    doc.setLineWidth(0.5);
    doc.rect(margin, py + headerBarH, blockW, blockH - headerBarH, "S");

    const labelX = margin + 14;
    const valueX = margin + 150;
    bankRows.forEach((row, i) => {
      const ry = py + headerBarH + 14 + i * rowH;
      doc.setFont(FONT, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(row[0], labelX, ry);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      doc.text(row[1], valueX, ry);
    });

    lastY = py + blockH;
  }

  // ========== SIGNATURE ==========
  const sigY = Math.min(lastY + 60, pageH - 120);
  const sigW = 200;

  // Signature image
  if (data.company.signature_url) {
    try {
      const sig = await loadImage(data.company.signature_url);
      const ratio = sig.width / sig.height;
      const h = 40;
      const w = Math.min(h * ratio, sigW - 20);
      doc.addImage(sig, "PNG", margin, sigY - h - 4, w, h);
    } catch { /* skip */ }
  }

  doc.setDrawColor(...ink);
  doc.setLineWidth(0.6);
  doc.line(margin, sigY, margin + sigW, sigY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("AUTHORISED SIGNATURE", margin, sigY + 12);

  doc.line(pageW - margin - sigW, sigY, pageW - margin, sigY);
  doc.text("DATE", pageW - margin - sigW, sigY + 12);

  // ========== FOOTER ==========
  doc.setDrawColor(...hairline);
  doc.line(margin, pageH - 48, pageW - margin, pageH - 48);
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  const footer = [
    data.company.name,
    data.company.website,
    data.company.contact_email,
    data.company.contact_phone,
  ].filter(Boolean).join("   •   ");
  doc.text(footer, pageW / 2, pageH - 32, { align: "center" });
  doc.setTextColor(...accent);
  doc.text("Thank you for your business", pageW / 2, pageH - 20, { align: "center" });

  return doc.output("blob");
}
