import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatZAR, formatDate } from "./format";

export interface TenderItem {
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface PdfData {
  title: string;
  documentType?: string;
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

const formatPdfMoney = (n: number) => formatZAR(n).replace(/\u00a0/g, " ");
const formatPdfAmount = (n: number) =>
  new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);

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
  // Use helvetica everywhere — jsPDF's helvetica is metric-compatible with Arial
  const SERIF = "helvetica";
  const SANS = "helvetica";
  const MONO = "helvetica";

  // Editorial palette
  const primary = hexToRgb(data.company.primary_color, [18, 38, 32]);
  // Primary drives structural elements (borders, rules, the bank box).
  // `accent` keeps that role for non-text uses; `accentText` is a neutral
  // ink so labels/eyebrows never render in the brand (e.g. orange) colour.
  const accent = primary;
  const ink: [number, number, number] = [24, 24, 22];
  const subInk: [number, number, number] = [86, 86, 82];
  const muted: [number, number, number] = [140, 140, 134];
  const hairline: [number, number, number] = [212, 206, 192];
  const cream: [number, number, number] = [251, 248, 241];
  const deepInk: [number, number, number] = [12, 12, 10];
  const accentText: [number, number, number] = deepInk;

  const docType = (data.documentType || "Quotation").trim();
  const docTypeUpper = docType.toUpperCase();

  // Adaptive density to fit one page when possible
  const rowCount = data.items.length;
  let density: "comfortable" | "normal" | "dense" | "veryDense" | "ultra";
  if (rowCount <= 5) density = "comfortable";
  else if (rowCount <= 8) density = "normal";
  else if (rowCount <= 12) density = "dense";
  else if (rowCount <= 16) density = "veryDense";
  else density = "ultra";

  const drawFrame = () => {
    doc.setDrawColor(...hairline);
    doc.setLineWidth(0.5);
    doc.rect(24, 24, pageW - 48, pageH - 48, "S");
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.line(24, 32, pageW - 24, 32);
  };
  drawFrame();

  // ========== HEADER ==========
  const headerTop = margin;

  // Eyebrow shows document type
  doc.setFont(SANS, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...accentText);
  doc.text(`— ${docTypeUpper}`, margin, headerTop);

  // Serif display title (the user-entered title)
  const titleText = data.title || docType;
  doc.setFont(SERIF, "bold");
  doc.setFontSize(18);
  doc.setTextColor(...deepInk);
  const titleMaxW = pageW - margin * 2 - 170;
  const titleLines = doc.splitTextToSize(titleText, titleMaxW);
  doc.text(titleLines.slice(0, 2), margin, headerTop + 18);
  const titleH = Math.min(titleLines.length, 2) * 18;

  // Right meta column
  doc.setFont(SANS, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("REFERENCE", pageW - margin, headerTop, { align: "right" });
  doc.setFont(SANS, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(data.tenderNumber || "—", pageW - margin, headerTop + 13, { align: "right" });

  doc.setFont(SANS, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("ISSUED", pageW - margin, headerTop + 28, { align: "right" });
  doc.setFont(SANS, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text(formatDate(new Date()), pageW - margin, headerTop + 41, { align: "right" });

  let cursorY = headerTop + Math.max(titleH + 4, 50);

  // Hairline beneath header
  doc.setDrawColor(...hairline);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += density === "ultra" ? 10 : 14;

  // ========== COMPANY identity ==========
  const idTop = cursorY;
  let logoH = 0;
  let logoW = 0;
  if (data.company.logo_url) {
    try {
      const logo = await loadImage(data.company.logo_url);
      const maxH = density === "ultra" || density === "veryDense" ? 30 : 36;
      const ratio = logo.width / logo.height;
      logoH = maxH;
      logoW = Math.min(maxH * ratio, 130);
      doc.addImage(logo, "PNG", margin, idTop, logoW, logoH);
    } catch { /* skip */ }
  }

  const idTextX = data.company.logo_url ? margin + logoW + 14 : margin;
  doc.setFont(SERIF, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text(data.company.name || "Company", idTextX, idTop + 10);

  // Right-aligned address & contact stack
  doc.setFont(SANS, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...subInk);
  const rightEdge = pageW - margin;
  const addressLines: string[] = [];
  if (data.company.address) {
    data.company.address
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => addressLines.push(l));
  }
  const contactLine = [data.company.contact_phone, data.company.contact_email].filter(Boolean).join("  ·  ");
  if (contactLine) addressLines.push(contactLine);
  if (data.company.website) addressLines.push(data.company.website);

  let icy = idTop + 10;
  addressLines.forEach((line) => {
    doc.text(line, rightEdge, icy, { align: "right" });
    icy += 9.5;
  });

  cursorY = Math.max(idTop + logoH, icy) + (density === "ultra" ? 12 : 18);

  // ========== PREPARED FOR | DETAILS ==========
  const colGap = 28;
  const colW = (pageW - margin * 2 - colGap) / 2;

  doc.setFont(SANS, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accentText);
  doc.text("PREPARED FOR", margin, cursorY);
  doc.text("DETAILS", margin + colW + colGap, cursorY);

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(margin, cursorY + 4, margin + 22, cursorY + 4);
  doc.line(margin + colW + colGap, cursorY + 4, margin + colW + colGap + 22, cursorY + 4);

  // Bill To — name + multi-line address
  doc.setFont(SERIF, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...deepInk);
  let bly = cursorY + 18;
  doc.text(data.clientName || "—", margin, bly);
  bly += 13;
  doc.setFont(SANS, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...subInk);
  if (data.clientAddress) {
    // Split on newlines OR commas if all on one line
    const raw = data.clientAddress.trim();
    const lines = raw.includes("\n")
      ? raw.split(/\r?\n/)
      : raw.split(/,\s*/);
    lines
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((t) => {
        const wrapped = doc.splitTextToSize(t, colW);
        wrapped.forEach((w: string) => {
          doc.text(w, margin, bly);
          bly += 11;
        });
      });
  }

  // References
  const rightColX = margin + colW + colGap;
  doc.setFont(SANS, "normal");
  doc.setFontSize(9);
  let rry = cursorY + 18;
  const refRows: [string, string][] = [];
  refRows.push(["Document", docType]);
  if (data.quotationRef) refRows.push(["Quote Ref", data.quotationRef]);
  if (data.company.csd_number) refRows.push(["CSD No.", data.company.csd_number]);
  if (data.company.vat_number) refRows.push(["VAT", data.company.vat_number]);
  if (data.company.registration_number) refRows.push(["Reg.", data.company.registration_number]);

  refRows.forEach(([k, v]) => {
    doc.setFont(SANS, "normal");
    doc.setTextColor(...muted);
    doc.text(k, rightColX, rry);
    doc.setFont(SANS, "bold");
    doc.setTextColor(...ink);
    const vw = doc.splitTextToSize(String(v), colW - 80);
    doc.text(vw, rightColX + 78, rry);
    rry += 12 + (vw.length - 1) * 11;
  });

  cursorY = Math.max(bly, rry) + (density === "ultra" || density === "veryDense" ? 10 : 18);

  // ========== TABLE ==========
  const body = data.items.map((it, i) => [
    String(i + 1).padStart(2, "0"),
    it.product,
    String(it.quantity),
    formatPdfAmount(it.unitPrice),
    formatPdfAmount(it.quantity * it.unitPrice),
  ]);

  const cellPadV =
    density === "ultra" ? 4 :
    density === "veryDense" ? 5.5 :
    density === "dense" ? 7.5 :
    density === "normal" ? 10 : 12;

  const tableFontSize =
    density === "ultra" ? 8 :
    density === "veryDense" ? 8.5 :
    density === "dense" ? 9 :
    density === "normal" ? 10 : 10.5;

  autoTable(doc, {
    head: [["No.", "DESCRIPTION", "QTY", "UNIT PRICE (R)", "AMOUNT (R)"]],
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
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: muted,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 6, right: 8, bottom: 8, left: 8 },
      lineColor: ink,
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 32, textColor: muted, fontStyle: "bold", halign: "left" },
      1: { textColor: deepInk, fontStyle: "bold" },
      2: { halign: "right", cellWidth: 42, textColor: subInk, overflow: "visible" },
      3: { halign: "right", cellWidth: 100, textColor: subInk, overflow: "visible" },
      4: { halign: "right", cellWidth: 108, fontStyle: "bold", textColor: deepInk, overflow: "visible" },
    },
    didParseCell: (d) => {
      if (d.column.index >= 2) d.cell.styles.halign = "right";
      else d.cell.styles.halign = "left";

      if (d.section === "body" && d.column.index >= 2) {
        d.cell.styles.font = d.column.index >= 3 ? MONO : SANS;
        d.cell.styles.fontStyle = d.column.index === 4 ? "bold" : "normal";
        d.cell.styles.cellPadding = { top: cellPadV, right: 10, bottom: cellPadV, left: 8 } as any;
      }
    },
    didDrawCell: (d) => {
      if (d.section === "head" && d.row.index === 0 && d.column.index === 0) {
        const y = d.cell.y + d.cell.height;
        doc.setDrawColor(...deepInk);
        doc.setLineWidth(0.8);
        doc.line(margin, y, pageW - margin, y);
      }
      if (d.section === "body" && d.column.index === 0) {
        const y = d.cell.y + d.cell.height;
        doc.setDrawColor(...hairline);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
      }
    },
    didDrawPage: () => {
      drawFrame();
    },
  });

  let lastY = (doc as any).lastAutoTable.finalY;

  // ========== TOTALS ==========
  // Align numbers to the same right edge as the table's AMOUNT column
  // (which ends at pageW - margin) and use the same MONO font + plain
  // formatting (no "R" prefix) so every digit and decimal lines up
  // perfectly with the rows above.
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  const totalsRightX = pageW - margin;
  const totalsLabelX = pageW - margin - 240;
  const totalsGap = density === "ultra" || density === "veryDense" ? 8 : density === "dense" ? 12 : 16;
  let ty = lastY + totalsGap;

  // Subtotal
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("SUBTOTAL", totalsLabelX, ty);
  doc.setFont(MONO, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...deepInk);
  doc.text(formatPdfAmount(totals.subtotal), totalsRightX, ty, { align: "right" });

  // VAT
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`VAT ${data.vatRate}%${data.vatInclusive ? " (INCL.)" : ""}`, totalsLabelX, ty + 16);
  doc.setFont(MONO, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...deepInk);
  doc.text(formatPdfAmount(totals.vatAmount), totalsRightX, ty + 16, { align: "right" });

  // Double rule across the totals area
  doc.setDrawColor(...deepInk);
  doc.setLineWidth(0.5);
  doc.line(totalsLabelX, ty + 26, totalsRightX, ty + 26);
  doc.line(totalsLabelX, ty + 28.5, totalsRightX, ty + 28.5);

  // Grand total
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("TOTAL DUE", totalsLabelX, ty + 44);

  doc.setFont(MONO, "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(formatPdfAmount(totals.grandTotal), totalsRightX, ty + 46, { align: "right" });

  lastY = ty + 60;
  const totalsW = 240;
  const totalsX = totalsLabelX;

  // ========== NOTES ==========
  let notesBottom = lastY;
  if (data.notes) {
    let ny = ty;
    doc.setFont(SANS, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accentText);
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

  // ========== BOTTOM BLOCK ==========
  const c = data.company;
  const bankRows: [string, string][] = [];
  if (c.bank_account_name) bankRows.push(["Account", c.bank_account_name]);
  if (c.bank_name) bankRows.push(["Bank", c.bank_name]);
  if (c.bank_account_number) bankRows.push(["Number", c.bank_account_number]);
  if (c.bank_branch_code) bankRows.push(["Branch", c.bank_branch_code]);
  if (c.bank_account_type) bankRows.push(["Type", c.bank_account_type]);
  if (c.bank_swift) bankRows.push(["SWIFT", c.bank_swift]);

  const tightBank = density === "ultra" || density === "veryDense";
  const padX = 12;
  const padY = tightBank ? 7 : 9;
  const titleHB = tightBank ? 11 : 13;
  const rowH = tightBank ? 10 : 11.5;
  const labelGapX = 10;
  const bankTitle = "BANKING DETAILS";

  // Layout: banking box (right-aligned, compact) ABOVE a signature/date row.
  // Sig sits on the left, Date sits on the right, both on the same baseline.
  const bankBoxW = Math.min(280, pageW - margin * 2 - 40);

  let bankBoxH = 0;
  let bankLabelColW = 0;
  let bankWrappedRows: [string, string[]][] = [];
  if (bankRows.length > 0) {
    doc.setFont(SANS, "normal");
    doc.setFontSize(8);
    bankRows.forEach(([k]) => {
      const w = doc.getTextWidth(k);
      if (w > bankLabelColW) bankLabelColW = w;
    });
    const valueW = bankBoxW - padX * 2 - bankLabelColW - labelGapX;
    bankWrappedRows = bankRows.map(([k, v]) => [k, doc.splitTextToSize(String(v), valueW)]);
    bankBoxH = padY + titleHB + bankWrappedRows.reduce((h, [, lines]) => h + Math.max(rowH, lines.length * rowH), 0) + padY;
  }

  const tight = density === "ultra" || density === "veryDense" || density === "dense";
  const sigRowH = tight ? 44 : 54;
  const footerBlockH = 16;
  const gapSigToFooter = tight ? 10 : 14;
  const gapBankToSig = tight ? 10 : 14;

  const bottomBlockH = bankBoxH + (bankBoxH > 0 ? gapBankToSig : 0) + sigRowH + gapSigToFooter + footerBlockH + 6;

  const minTopForBottomBlock = pageH - bottomBlockH - margin;
  const requiredGap = tight ? 10 : 18;
  if (lastY + requiredGap > minTopForBottomBlock) {
    doc.addPage();
    drawFrame();
  }

  const footerHairlineY = pageH - 34;
  const sigY = footerHairlineY - gapSigToFooter - 16;

  // Bank box sits above the signature/date row, right-aligned.
  // Anchor its bottom edge a comfortable gap above the sig/date baseline.
  const bankBoxBottom = sigY - 30 - gapBankToSig;
  const boxY = bankBoxBottom - bankBoxH;
  if (bankRows.length > 0) {
    const boxX = pageW - margin - bankBoxW;

    doc.setFillColor(...cream);
    doc.roundedRect(boxX, boxY, bankBoxW, bankBoxH, 7, 7, "F");
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.8);
    doc.roundedRect(boxX, boxY, bankBoxW, bankBoxH, 7, 7, "S");
    doc.setFillColor(...primary);
    doc.roundedRect(boxX, boxY, 2.5, bankBoxH, 1.2, 1.2, "F");

    doc.setFont(SANS, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accentText);
    doc.text(bankTitle, boxX + padX, boxY + padY + 4);

    doc.setFontSize(8);
    let bankY = boxY + padY + titleHB + 4;
    bankWrappedRows.forEach(([label, lines]) => {
      doc.setFont(SANS, "normal");
      doc.setTextColor(...muted);
      doc.text(label, boxX + padX, bankY);
      doc.setFont(SANS, "normal");
      doc.setTextColor(...ink);
      doc.text(lines, boxX + padX + bankLabelColW + labelGapX, bankY);
      bankY += Math.max(rowH, lines.length * rowH);
    });
  }

  // Signature line — left
  const sigLineW = 200;
  if (data.company.signature_url) {
    try {
      const sig = await loadImage(data.company.signature_url);
      const ratio = sig.width / sig.height;
      const h = density === "ultra" ? 26 : 32;
      const w = Math.min(h * ratio, sigLineW - 14);
      doc.addImage(sig, "PNG", margin, sigY - h - 6, w, h);
    } catch { /* skip */ }
  }
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.5);
  doc.line(margin, sigY, margin + sigLineW, sigY);
  doc.setFont(SANS, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("AUTHORISED SIGNATURE", margin, sigY + 12);

  // Date line — right, same baseline as signature
  const dateLineW = 180;
  const dateLineX = pageW - margin - dateLineW;
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.5);
  doc.line(dateLineX, sigY, dateLineX + dateLineW, sigY);
  doc.setFont(SANS, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  doc.text("DATE", dateLineX, sigY + 12);

  // Footer
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(margin, footerHairlineY, margin + 30, footerHairlineY);
  doc.line(pageW - margin - 30, footerHairlineY, pageW - margin, footerHairlineY);

  doc.setFont(SANS, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...muted);
  const footer = [
    data.company.name,
    data.company.website,
    data.company.contact_email,
    data.company.contact_phone,
  ].filter(Boolean).join("   ·   ");
  const footerLines = doc.splitTextToSize(footer, pageW - margin * 2 - 80);
  doc.text(footerLines.slice(0, 2), pageW / 2, footerHairlineY + 4, { align: "center" });

  doc.setFont(SANS, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);

  return doc.output("blob");
}
