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

const mix = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] => [
  Math.round(a[0] * (1 - t) + b[0] * t),
  Math.round(a[1] * (1 - t) + b[1] * t),
  Math.round(a[2] * (1 - t) + b[2] * t),
];

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
  const margin = 40;
  const FONT = "helvetica";

  const primary = hexToRgb(data.company.primary_color, [18, 38, 32]);
  const accent = hexToRgb(data.company.accent_color, [200, 147, 43]);
  const onPrimary: [number, number, number] = luminance(primary) > 0.6 ? [20, 24, 22] : [250, 248, 242];
  const ink: [number, number, number] = [22, 26, 24];
  const subInk: [number, number, number] = [70, 76, 72];
  const muted: [number, number, number] = [128, 132, 128];
  const hairline: [number, number, number] = [222, 218, 208];
  const paper: [number, number, number] = [255, 255, 255];
  const cream: [number, number, number] = [250, 247, 240];
  const primarySoft = mix(primary, [255, 255, 255], 0.92);

  // Density heuristic: tighter spacing when there are many rows so we fit on one page
  const rowCount = data.items.length;
  const dense = rowCount > 8;
  const veryDense = rowCount > 14;

  // ========== LEFT ACCENT RAIL ==========
  const railW = 6;
  doc.setFillColor(...primary);
  doc.rect(0, 0, railW, pageH, "F");
  doc.setFillColor(...accent);
  doc.rect(0, 0, railW, 90, "F");

  // ========== HEADER ==========
  const headerTop = 38;
  const headerH = veryDense ? 72 : dense ? 80 : 88;

  // Logo (top-left, on paper — no colored band)
  let logoBottom = headerTop;
  let logoRight = margin;
  if (data.company.logo_url) {
    try {
      const logo = await loadImage(data.company.logo_url);
      const maxH = veryDense ? 44 : dense ? 50 : 56;
      const ratio = logo.width / logo.height;
      const h = maxH;
      const w = Math.min(h * ratio, 150);
      doc.addImage(logo, "PNG", margin, headerTop, w, h);
      logoBottom = headerTop + h;
      logoRight = margin + w;
    } catch { /* skip */ }
  }

  // Right-aligned QUOTATION title block
  const titleText = (data.title || "Quotation").toUpperCase();
  doc.setFont(FONT, "bold");
  doc.setFontSize(26);
  doc.setTextColor(...primary);
  doc.text(titleText, pageW - margin, headerTop + 22, { align: "right" });

  // Accent rule under title
  doc.setFillColor(...accent);
  doc.rect(pageW - margin - 56, headerTop + 30, 56, 2.5, "F");

  // Meta under title
  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...subInk);
  let metaY = headerTop + 46;
  if (data.tenderNumber) {
    doc.text(`No. ${data.tenderNumber}`, pageW - margin, metaY, { align: "right" });
    metaY += 11;
  }
  doc.text(`Date  ${formatDate(new Date())}`, pageW - margin, metaY, { align: "right" });

  // Company name + contacts (left, under logo)
  let cy = Math.max(logoBottom + 14, headerTop + headerH);
  doc.setFont(FONT, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...ink);
  doc.text(data.company.name || "Company", margin, cy);
  cy += 11;

  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  const contactBits = [
    data.company.address,
    [data.company.contact_phone, data.company.contact_email].filter(Boolean).join("  ·  "),
    data.company.website,
  ].filter(Boolean) as string[];
  contactBits.forEach((line) => {
    doc.text(line, margin, cy);
    cy += 10;
  });

  // ========== DIVIDER ==========
  let cursorY = cy + 8;
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.6);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += dense ? 16 : 20;

  // ========== INFO ROW: BILL TO  |  REFS ==========
  const colGap = 24;
  const colW = (pageW - margin * 2 - colGap) / 2;

  // Left: Bill To
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.text("BILLED TO", margin, cursorY);

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  const clientLines: string[] = [];
  if (data.clientName) clientLines.push(data.clientName);
  if (data.clientAddress) {
    data.clientAddress.split(/\r?\n/).forEach(l => l.trim() && clientLines.push(l.trim()));
  }
  if (clientLines.length === 0) clientLines.push("—");
  let bly = cursorY + 13;
  clientLines.forEach((l, i) => {
    if (i === 0) doc.setFont(FONT, "bold");
    else doc.setFont(FONT, "normal");
    doc.text(l, margin, bly);
    bly += 12;
  });

  // Right: References
  const rightColX = margin + colW + colGap;
  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.text("REFERENCE", rightColX, cursorY);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ink);
  let rry = cursorY + 13;
  const refRows: [string, string][] = [];
  if (data.quotationRef) refRows.push(["Quote Ref", data.quotationRef]);
  if (data.company.csd_number) refRows.push(["CSD No.", data.company.csd_number]);
  if (data.company.vat_number) refRows.push(["VAT", data.company.vat_number]);
  if (data.company.registration_number) refRows.push(["Reg.", data.company.registration_number]);

  if (refRows.length === 0) {
    doc.setTextColor(...muted);
    doc.text("—", rightColX, rry);
    rry += 12;
  } else {
    refRows.forEach(([k, v]) => {
      doc.setFont(FONT, "normal");
      doc.setTextColor(...muted);
      doc.text(k, rightColX, rry);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...ink);
      doc.text(v, rightColX + 70, rry);
      rry += 12;
    });
  }

  cursorY = Math.max(bly, rry) + (dense ? 6 : 12);

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
    theme: "grid",
    styles: {
      font: FONT,
      fontSize: tableFontSize,
      cellPadding: { top: cellPadV, right: 10, bottom: cellPadV, left: 10 },
      textColor: ink,
      lineColor: hairline,
      lineWidth: 0.4,
      valign: "middle",
    },
    headStyles: {
      fillColor: primary,
      textColor: onPrimary,
      fontStyle: "bold",
      fontSize: veryDense ? 7.5 : 8,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
      lineColor: primary,
      lineWidth: 0.4,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: cream,
    },
    columnStyles: {
      0: { textColor: ink },
      1: { halign: "right", cellWidth: 44, textColor: subInk },
      2: { halign: "right", cellWidth: 92, textColor: subInk },
      3: { halign: "right", cellWidth: 100, fontStyle: "bold", textColor: ink },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) {
        data.cell.styles.halign = "right";
      }
    },
  });

  let lastY = (doc as any).lastAutoTable.finalY;

  // ========== TOTALS BLOCK ==========
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  const totalsW = 230;
  const totalsX = pageW - margin - totalsW;
  let ty = lastY + (dense ? 10 : 14);

  doc.setFont(FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text("Subtotal", totalsX + 4, ty + 12);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.subtotal), totalsX + totalsW - 4, ty + 12, { align: "right" });

  doc.setTextColor(...muted);
  doc.text(`VAT ${data.vatRate}%${data.vatInclusive ? " (incl.)" : ""}`, totalsX + 4, ty + 27);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.vatAmount), totalsX + totalsW - 4, ty + 27, { align: "right" });

  // thin divider
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.5);
  doc.line(totalsX, ty + 34, totalsX + totalsW, ty + 34);

  // Grand total — flat, typographic
  const gtY = ty + 34;
  const gtH = dense ? 32 : 38;
  doc.setFillColor(...primary);
  doc.rect(totalsX, gtY, totalsW, gtH, "F");
  // accent corner
  doc.setFillColor(...accent);
  doc.rect(totalsX, gtY, totalsW, 2, "F");

  doc.setTextColor(...onPrimary);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  doc.text("TOTAL DUE", totalsX + 12, gtY + 16);
  doc.setFont(FONT, "bold");
  doc.setFontSize(dense ? 14 : 16);
  doc.text(formatZAR(totals.grandTotal), totalsX + totalsW - 12, gtY + (dense ? 24 : 27), { align: "right" });

  lastY = gtY + gtH;

  // ========== NOTES (left of totals) ==========
  let notesBottom = lastY;
  if (data.notes) {
    let ny = ty + 4;
    doc.setFont(FONT, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    doc.text("NOTES & TERMS", margin, ny);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...subInk);
    const split = doc.splitTextToSize(data.notes, pageW - margin * 2 - totalsW - 24);
    doc.text(split, margin, ny + 12);
    notesBottom = ny + 12 + split.length * 10.5;
  }
  lastY = Math.max(lastY, notesBottom);

  // ========== BOTTOM-PINNED FOOTER GROUP ==========
  const c = data.company;
  const bankRows: [string, string][] = [];
  if (c.bank_account_name) bankRows.push(["Name", c.bank_account_name]);
  if (c.bank_name) bankRows.push(["Bank", c.bank_name]);
  if (c.bank_account_number) bankRows.push(["Acc No", c.bank_account_number]);
  if (c.bank_branch_code) bankRows.push(["Branch", c.bank_branch_code]);
  if (c.bank_account_type) bankRows.push(["Type", c.bank_account_type]);
  if (c.bank_swift) bankRows.push(["SWIFT", c.bank_swift]);

  // Pre-measure bank box (compact)
  const padX = 12;
  const padY = 10;
  const titleH = 12;
  const rowH = 11;
  const labelGapX = 10;
  const bankTitle = "BANKING DETAILS";

  doc.setFont(FONT, "bold");
  doc.setFontSize(7);
  let bankBoxW = 0;
  let bankBoxH = 0;
  let bankLabelColW = 0;
  let bankValueColW = 0;
  if (bankRows.length > 0) {
    const titleW = doc.getTextWidth(bankTitle);
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    bankRows.forEach(([k]) => {
      const w = doc.getTextWidth(k);
      if (w > bankLabelColW) bankLabelColW = w;
    });
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    bankRows.forEach(([, v]) => {
      const w = doc.getTextWidth(String(v));
      if (w > bankValueColW) bankValueColW = w;
    });
    const contentW = Math.max(titleW, bankLabelColW + labelGapX + bankValueColW);
    bankBoxW = Math.min(contentW + padX * 2, pageW - margin * 2 - 230);
    bankBoxH = padY + titleH + bankRows.length * rowH + padY - 4;
  }

  const sigBlockH = 60;
  const footerBlockH = 28;
  const gapSigToFooter = 18;
  const bottomBlockH = Math.max(bankBoxH, sigBlockH) + gapSigToFooter + footerBlockH + 10;

  const minTopForBottomBlock = pageH - bottomBlockH - margin;
  const requiredGap = 18;
  if (lastY + requiredGap > minTopForBottomBlock) {
    doc.addPage();
    // re-draw rail on new page
    doc.setFillColor(...primary);
    doc.rect(0, 0, railW, pageH, "F");
    doc.setFillColor(...accent);
    doc.rect(0, 0, railW, 90, "F");
  }

  const footerHairlineY = pageH - 38;
  const sigY = footerHairlineY - 16 - gapSigToFooter;

  // ----- Bank box (right) -----
  if (bankRows.length > 0) {
    const boxX = pageW - margin - bankBoxW;
    const boxY = sigY - sigBlockH + 6;
    doc.setFillColor(...cream);
    doc.setDrawColor(...accent);
    doc.setLineWidth(1);
    doc.rect(boxX, boxY, bankBoxW, bankBoxH, "FD");

    // accent tab
    doc.setFillColor(...accent);
    doc.rect(boxX, boxY, 3, bankBoxH, "F");

    doc.setFont(FONT, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    doc.text(bankTitle, boxX + padX, boxY + padY + 2);

    doc.setFontSize(8);
    bankRows.forEach((row, i) => {
      const ry = boxY + padY + titleH + 4 + i * rowH;
      doc.setFont(FONT, "normal");
      doc.setTextColor(...muted);
      doc.text(row[0], boxX + padX, ry);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...ink);
      doc.text(String(row[1]), boxX + padX + bankLabelColW + labelGapX, ry);
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
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("AUTHORISED SIGNATURE", margin, sigY + 11);

  const dateLineX = margin + sigW + 20;
  const dateLineW = 130;
  doc.line(dateLineX, sigY, dateLineX + dateLineW, sigY);
  doc.text("DATE", dateLineX, sigY + 11);

  // ----- Footer line -----
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.4);
  doc.line(margin, footerHairlineY, pageW - margin, footerHairlineY);
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  const footer = [
    data.company.name,
    data.company.website,
    data.company.contact_email,
    data.company.contact_phone,
  ].filter(Boolean).join("   ·   ");
  doc.text(footer, pageW / 2, pageH - 22, { align: "center" });

  return doc.output("blob");
}
