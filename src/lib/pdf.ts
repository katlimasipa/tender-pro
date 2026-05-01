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
  const margin = 56;
  const SERIF = "times";
  const SANS = "helvetica";

  // Refined editorial palette
  const primary = hexToRgb(data.company.primary_color, [18, 38, 32]);
  const accent = hexToRgb(data.company.accent_color, [176, 132, 56]); // refined gold
  const ink: [number, number, number] = [24, 24, 22];
  const subInk: [number, number, number] = [86, 86, 82];
  const muted: [number, number, number] = [140, 140, 134];
  const hairline: [number, number, number] = [212, 206, 192];
  const cream: [number, number, number] = [251, 248, 241];
  const deepInk: [number, number, number] = [12, 12, 10];

  const rowCount = data.items.length;
  const dense = rowCount > 8;
  const veryDense = rowCount > 14;

  // ========== EDITORIAL FRAME ==========
  // Outer hairline frame for premium feel
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.5);
  doc.rect(28, 28, pageW - 56, pageH - 56, "S");
  // Inner accent rule
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(28, 36, pageW - 28, 36);

  // ========== HEADER: serif wordmark + meta ==========
  const headerTop = margin + 4;

  // Small uppercase eyebrow above title
  doc.setFont(SANS, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text("— PROPOSAL", margin, headerTop);

  // Serif display title
  const titleText = data.title || "Quotation";
  doc.setFont(SERIF, "normal");
  doc.setFontSize(28);
  doc.setTextColor(...deepInk);
  doc.text(titleText, margin, headerTop + 28);

  // Right meta column
  doc.setFont(SANS, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("REFERENCE", pageW - margin, headerTop, { align: "right" });
  doc.setFont(SANS, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(data.tenderNumber || "—", pageW - margin, headerTop + 14, { align: "right" });

  doc.setFont(SANS, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("ISSUED", pageW - margin, headerTop + 30, { align: "right" });
  doc.setFont(SANS, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(formatDate(new Date()), pageW - margin, headerTop + 44, { align: "right" });

  let cursorY = headerTop + 56;

  // Hairline beneath header
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 18;

  // ========== COMPANY (logo + identity, centered-left composition) ==========
  const idTop = cursorY;
  let logoH = 0;
  if (data.company.logo_url) {
    try {
      const logo = await loadImage(data.company.logo_url);
      const maxH = 38;
      const ratio = logo.width / logo.height;
      logoH = maxH;
      const w = Math.min(maxH * ratio, 130);
      doc.addImage(logo, "PNG", margin, idTop, w, logoH);
    } catch { /* skip */ }
  }

  // Company info aligned right of logo OR full width if no logo
  const idTextX = data.company.logo_url ? margin + 145 : margin;
  doc.setFont(SERIF, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text(data.company.name || "Company", idTextX, idTop + 12);

  doc.setFont(SANS, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...subInk);
  let icy = idTop + 24;
  const contactBits = [
    data.company.address,
    [data.company.contact_phone, data.company.contact_email].filter(Boolean).join("  ·  "),
    data.company.website,
  ].filter(Boolean) as string[];
  contactBits.forEach((line) => {
    doc.text(line, idTextX, icy);
    icy += 10;
  });

  cursorY = Math.max(idTop + logoH, icy) + 22;

  // ========== BILLED TO  |  REFERENCES ==========
  const colGap = 32;
  const colW = (pageW - margin * 2 - colGap) / 2;

  // Eyebrow labels
  doc.setFont(SANS, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.text("PREPARED FOR", margin, cursorY);
  doc.text("DETAILS", margin + colW + colGap, cursorY);

  // Underline marks
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(margin, cursorY + 4, margin + 22, cursorY + 4);
  doc.line(margin + colW + colGap, cursorY + 4, margin + colW + colGap + 22, cursorY + 4);

  // Bill To
  doc.setFont(SERIF, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...deepInk);
  let bly = cursorY + 20;
  doc.text(data.clientName || "—", margin, bly);
  bly += 14;
  doc.setFont(SANS, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...subInk);
  if (data.clientAddress) {
    data.clientAddress.split(/\r?\n/).forEach((l) => {
      const t = l.trim();
      if (t) {
        doc.text(t, margin, bly);
        bly += 11;
      }
    });
  }

  // References
  const rightColX = margin + colW + colGap;
  doc.setFont(SANS, "normal");
  doc.setFontSize(9);
  let rry = cursorY + 20;
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
      doc.setFont(SANS, "normal");
      doc.setTextColor(...muted);
      doc.text(k, rightColX, rry);
      doc.setFont(SANS, "bold");
      doc.setTextColor(...ink);
      doc.text(v, rightColX + 78, rry);
      rry += 13;
    });
  }

  cursorY = Math.max(bly, rry) + (dense ? 14 : 22);

  // ========== TABLE — borderless editorial style ==========
  const body = data.items.map((it, i) => [
    String(i + 1).padStart(2, "0"),
    it.product,
    String(it.quantity),
    formatZAR(it.unitPrice),
    formatZAR(it.quantity * it.unitPrice),
  ]);

  const cellPadV = veryDense ? 7 : dense ? 9 : 12;
  const tableFontSize = veryDense ? 8.5 : dense ? 9.5 : 10;

  autoTable(doc, {
    head: [["№", "DESCRIPTION", "QTY", "UNIT", "AMOUNT"]],
    body,
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: {
      font: SANS,
      fontSize: tableFontSize,
      cellPadding: { top: cellPadV, right: 8, bottom: cellPadV, left: 8 },
      textColor: ink,
      lineColor: hairline,
      lineWidth: 0,
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: muted,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 6, right: 8, bottom: 8, left: 8 },
      lineColor: ink,
      lineWidth: 0,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 28, textColor: accent, fontStyle: "bold", halign: "left" },
      1: { textColor: deepInk, fontStyle: "bold" },
      2: { halign: "right", cellWidth: 44, textColor: subInk },
      3: { halign: "right", cellWidth: 86, textColor: subInk },
      4: { halign: "right", cellWidth: 96, fontStyle: "bold", textColor: deepInk },
    },
    didParseCell: (d) => {
      if (d.section === "head" && d.column.index >= 2) {
        d.cell.styles.halign = "right";
      }
    },
    didDrawCell: (d) => {
      // Hairline under header
      if (d.section === "head" && d.row.index === 0) {
        const y = d.cell.y + d.cell.height;
        if (d.column.index === 0) {
          doc.setDrawColor(...deepInk);
          doc.setLineWidth(0.8);
          doc.line(margin, y, pageW - margin, y);
        }
      }
      // Hairline between body rows
      if (d.section === "body" && d.column.index === 0) {
        const y = d.cell.y + d.cell.height;
        doc.setDrawColor(...hairline);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
      }
    },
  });

  let lastY = (doc as any).lastAutoTable.finalY;

  // ========== TOTALS — refined right-aligned editorial ==========
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  const totalsW = 240;
  const totalsX = pageW - margin - totalsW;
  let ty = lastY + 18;

  // Subtotal & VAT rows
  doc.setFont(SANS, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("Subtotal", totalsX, ty);
  doc.setTextColor(...ink);
  doc.setFont(SANS, "normal");
  doc.text(formatZAR(totals.subtotal), totalsX + totalsW, ty, { align: "right" });

  doc.setTextColor(...muted);
  doc.text(`VAT ${data.vatRate}%${data.vatInclusive ? " (incl.)" : ""}`, totalsX, ty + 16);
  doc.setTextColor(...ink);
  doc.text(formatZAR(totals.vatAmount), totalsX + totalsW, ty + 16, { align: "right" });

  // Double rule above grand total (editorial style)
  doc.setDrawColor(...deepInk);
  doc.setLineWidth(0.5);
  doc.line(totalsX, ty + 26, totalsX + totalsW, ty + 26);
  doc.line(totalsX, ty + 28.5, totalsX + totalsW, ty + 28.5);

  // Grand total — clean black on cream, no box clutter
  doc.setFont(SANS, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text("TOTAL DUE", totalsX, ty + 44);

  doc.setFont(SERIF, "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text(formatZAR(totals.grandTotal), totalsX + totalsW, ty + 50, { align: "right" });

  lastY = ty + 60;

  // ========== NOTES (left of totals) ==========
  let notesBottom = lastY;
  if (data.notes) {
    let ny = ty;
    doc.setFont(SANS, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    doc.text("NOTES & TERMS", margin, ny);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(margin, ny + 4, margin + 22, ny + 4);

    doc.setFont(SERIF, "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...subInk);
    const split = doc.splitTextToSize(data.notes, pageW - margin * 2 - totalsW - 30);
    doc.text(split, margin, ny + 18);
    notesBottom = ny + 18 + split.length * 12;
  }
  lastY = Math.max(lastY, notesBottom);

  // ========== BOTTOM BLOCK: signature + bank ==========
  const c = data.company;
  const bankRows: [string, string][] = [];
  if (c.bank_account_name) bankRows.push(["Account", c.bank_account_name]);
  if (c.bank_name) bankRows.push(["Bank", c.bank_name]);
  if (c.bank_account_number) bankRows.push(["Number", c.bank_account_number]);
  if (c.bank_branch_code) bankRows.push(["Branch", c.bank_branch_code]);
  if (c.bank_account_type) bankRows.push(["Type", c.bank_account_type]);
  if (c.bank_swift) bankRows.push(["SWIFT", c.bank_swift]);

  const padX = 14;
  const padY = 12;
  const titleH = 14;
  const rowH = 12;
  const labelGapX = 12;
  const bankTitle = "BANKING DETAILS";

  let bankBoxW = 0;
  let bankBoxH = 0;
  let bankLabelColW = 0;
  let bankValueColW = 0;
  if (bankRows.length > 0) {
    doc.setFont(SANS, "bold");
    doc.setFontSize(7);
    const titleW = doc.getTextWidth(bankTitle);
    doc.setFont(SANS, "normal");
    doc.setFontSize(8.5);
    bankRows.forEach(([k]) => {
      const w = doc.getTextWidth(k);
      if (w > bankLabelColW) bankLabelColW = w;
    });
    doc.setFont(SANS, "bold");
    doc.setFontSize(8.5);
    bankRows.forEach(([, v]) => {
      const w = doc.getTextWidth(String(v));
      if (w > bankValueColW) bankValueColW = w;
    });
    const contentW = Math.max(titleW, bankLabelColW + labelGapX + bankValueColW);
    bankBoxW = Math.min(contentW + padX * 2, 260);
    bankBoxH = padY + titleH + bankRows.length * rowH + padY;
  }

  const sigBlockH = 64;
  const footerBlockH = 32;
  const gapSigToFooter = 22;
  const bottomBlockH = Math.max(bankBoxH, sigBlockH) + gapSigToFooter + footerBlockH + 14;

  const minTopForBottomBlock = pageH - bottomBlockH - margin;
  const requiredGap = 24;
  if (lastY + requiredGap > minTopForBottomBlock) {
    doc.addPage();
    // re-draw frame on new page
    doc.setDrawColor(...hairline);
    doc.setLineWidth(0.5);
    doc.rect(28, 28, pageW - 56, pageH - 56, "S");
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.line(28, 36, pageW - 28, 36);
  }

  const footerHairlineY = pageH - 54;
  const sigY = footerHairlineY - 22 - gapSigToFooter;

  // ----- Bank panel (right) — minimal cream block, no border, just left accent rule -----
  if (bankRows.length > 0) {
    const boxX = pageW - margin - bankBoxW;
    const boxY = sigY - sigBlockH + 4;

    doc.setFillColor(...cream);
    doc.rect(boxX, boxY, bankBoxW, bankBoxH, "F");
    // left accent rule
    doc.setFillColor(...accent);
    doc.rect(boxX, boxY, 2, bankBoxH, "F");

    doc.setFont(SANS, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    doc.text(bankTitle, boxX + padX, boxY + padY + 4);

    doc.setFontSize(8.5);
    bankRows.forEach((row, i) => {
      const ry = boxY + padY + titleH + 6 + i * rowH;
      doc.setFont(SANS, "normal");
      doc.setTextColor(...muted);
      doc.text(row[0], boxX + padX, ry);
      doc.setFont(SANS, "bold");
      doc.setTextColor(...ink);
      doc.text(String(row[1]), boxX + padX + bankLabelColW + labelGapX, ry);
    });
  }

  // ----- Signature (left) -----
  const sigW = 200;
  if (data.company.signature_url) {
    try {
      const sig = await loadImage(data.company.signature_url);
      const ratio = sig.width / sig.height;
      const h = 38;
      const w = Math.min(h * ratio, sigW - 20);
      doc.addImage(sig, "PNG", margin, sigY - h - 6, w, h);
    } catch { /* skip */ }
  }
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + sigW, sigY);
  doc.setFont(SANS, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("AUTHORISED SIGNATURE", margin, sigY + 12);

  const dateLineX = margin + sigW + 24;
  const dateLineW = 130;
  doc.line(dateLineX, sigY, dateLineX + dateLineW, sigY);
  doc.text("DATE", dateLineX, sigY + 12);

  // ----- Footer -----
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(margin, footerHairlineY, margin + 30, footerHairlineY);
  doc.line(pageW - margin - 30, footerHairlineY, pageW - margin, footerHairlineY);

  doc.setFont(SERIF, "italic");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  const footer = [
    data.company.name,
    data.company.website,
    data.company.contact_email,
    data.company.contact_phone,
  ].filter(Boolean).join("   ·   ");
  doc.text(footer, pageW / 2, footerHairlineY + 4, { align: "center" });

  doc.setFont(SANS, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text("THANK YOU FOR YOUR BUSINESS", pageW / 2, footerHairlineY + 18, { align: "center" });

  return doc.output("blob");
}
