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

  let cursorY = margin;

  // Letterhead
  if (data.company.letterhead_url) {
    try {
      const img = await loadImage(data.company.letterhead_url);
      const maxW = pageW - margin * 2;
      const ratio = img.height / img.width;
      const w = Math.min(maxW, 480);
      const h = w * ratio;
      doc.addImage(img, "PNG", (pageW - w) / 2, cursorY, w, Math.min(h, 120));
      cursorY += Math.min(h, 120) + 16;
    } catch {
      // skip if letterhead fails
    }
  } else {
    // Fallback: company name banner
    doc.setFillColor(28, 56, 44); // velvet green
    doc.rect(0, 0, pageW, 80, "F");
    doc.setTextColor(245, 240, 225);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(data.company.name || "Company", margin, 50);
    cursorY = 100;
    doc.setTextColor(20, 24, 22);
  }

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 24, 22);
  doc.text(data.title || "Tender Document", margin, cursorY + 6);
  cursorY += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 95, 90);
  if (data.tenderNumber) doc.text(`Tender No: ${data.tenderNumber}`, margin, cursorY);
  doc.text(`Date: ${formatDate(new Date())}`, pageW - margin, cursorY, { align: "right" });
  cursorY += 24;

  // Parties
  doc.setTextColor(20, 24, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FROM", margin, cursorY);
  doc.text("TO", pageW / 2, cursorY);
  cursorY += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fromLines = [
    data.company.name,
    data.company.address,
    data.company.contact_email,
    data.company.contact_phone,
    data.company.vat_number ? `VAT: ${data.company.vat_number}` : null,
    data.company.registration_number ? `Reg: ${data.company.registration_number}` : null,
  ].filter(Boolean) as string[];
  const toLines = [data.clientName, data.clientAddress].filter(Boolean) as string[];
  fromLines.forEach((l, i) => doc.text(l, margin, cursorY + i * 12));
  toLines.forEach((l, i) => doc.text(l, pageW / 2, cursorY + i * 12));
  cursorY += Math.max(fromLines.length, toLines.length, 1) * 12 + 16;

  // Table
  const body = data.items.map((it, idx) => [
    String(idx + 1),
    it.product,
    String(it.quantity),
    formatZAR(it.unitPrice),
    formatZAR(it.quantity * it.unitPrice),
  ]);

  autoTable(doc, {
    head: [["No.", "Product / Description", "Qty", "Unit Price", "Total"]],
    body,
    startY: cursorY,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: [20, 24, 22] },
    headStyles: { fillColor: [28, 56, 44], textColor: [245, 240, 225], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 244, 234] },
    columnStyles: {
      0: { cellWidth: 36, halign: "center" },
      2: { halign: "right", cellWidth: 50 },
      3: { halign: "right", cellWidth: 90 },
      4: { halign: "right", cellWidth: 100 },
    },
  });

  const lastY = (doc as any).lastAutoTable.finalY + 16;
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);

  const labelX = pageW - margin - 200;
  const valueX = pageW - margin;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", labelX, lastY);
  doc.text(formatZAR(totals.subtotal), valueX, lastY, { align: "right" });
  doc.text(`VAT (${data.vatRate}%)${data.vatInclusive ? " incl." : ""}`, labelX, lastY + 16);
  doc.text(formatZAR(totals.vatAmount), valueX, lastY + 16, { align: "right" });

  doc.setDrawColor(28, 56, 44);
  doc.setLineWidth(0.8);
  doc.line(labelX, lastY + 24, valueX, lastY + 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Grand Total", labelX, lastY + 40);
  doc.text(formatZAR(totals.grandTotal), valueX, lastY + 40, { align: "right" });

  // Notes
  let notesY = lastY + 70;
  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes", margin, notesY);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(data.notes, pageW - margin * 2);
    doc.text(split, margin, notesY + 14);
    notesY += 14 + split.length * 12;
  }

  // Signature
  const sigY = Math.min(notesY + 40, pageH - 120);
  doc.setDrawColor(150, 150, 140);
  doc.line(margin, sigY, margin + 200, sigY);
  doc.line(pageW - margin - 200, sigY, pageW - margin, sigY);
  doc.setFontSize(9);
  doc.setTextColor(110, 115, 110);
  doc.text("Authorised Signature", margin, sigY + 12);
  doc.text("Date", pageW - margin - 200, sigY + 12);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 130);
  const footer = [data.company.name, data.company.contact_email, data.company.contact_phone]
    .filter(Boolean).join("  •  ");
  doc.text(footer, pageW / 2, pageH - 28, { align: "center" });

  return doc.output("blob");
}
