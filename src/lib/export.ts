import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, HeadingLevel, AlignmentType, BorderStyle, ImageRun } from "docx";
import { dataUrlToBytes } from "./rowImage";
import { PdfData, computeTotals } from "./pdf";
import { formatZAR } from "./format";

const measureImage = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const el = new Image();
    el.onload = () => resolve({ width: el.width || 1, height: el.height || 1 });
    el.onerror = () => resolve({ width: 0, height: 0 });
    el.src = src;
  });

export async function exportWord(data: PdfData) {
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);

  // Pre-measure row pictures so they can be embedded at the right aspect ratio
  const rowImages: Record<number, { bytes: Uint8Array; width: number; height: number }> = {};
  for (let i = 0; i < data.items.length; i++) {
    const src = data.items[i]?.image;
    if (!src) continue;
    try {
      const { width, height } = await measureImage(src);
      if (!width || !height) continue;
      const w = 200;
      const h = Math.round((height / width) * w);
      rowImages[i] = { bytes: dataUrlToBytes(src), width: w, height: h };
    } catch { /* skip */ }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: data.company.name, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: data.company.address }),
          new Paragraph({ text: `Email: ${data.company.contact_email || ""} | Phone: ${data.company.contact_phone || ""}` }),
          new Paragraph({ text: "" }),
          
          new Paragraph({ text: data.documentType.toUpperCase(), heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT }),
          new Paragraph({ text: data.title, alignment: AlignmentType.RIGHT }),
          new Paragraph({ text: `Date: ${new Date().toLocaleDateString()}`, alignment: AlignmentType.RIGHT }),
          ...(data.tenderNumber ? [new Paragraph({ text: `Doc No: ${data.tenderNumber}`, alignment: AlignmentType.RIGHT })] : []),
          ...(data.quotationRef ? [new Paragraph({ text: `Ref: ${data.quotationRef}`, alignment: AlignmentType.RIGHT })] : []),
          new Paragraph({ text: "" }),
          
          ...(data.clientName ? [
            new Paragraph({ text: "PREPARED FOR:", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: data.clientName }),
            ...(data.clientAddress ? [new Paragraph({ text: data.clientAddress.replace(/\n/g, ", ") })] : []),
            new Paragraph({ text: "" })
          ] : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "No.", alignment: AlignmentType.CENTER })], shading: { fill: "F3F3F3" } }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.desc || "Description", alignment: AlignmentType.LEFT })], shading: { fill: "F3F3F3" } }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.qty || "Quantity", alignment: AlignmentType.CENTER })], shading: { fill: "F3F3F3" } }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.price || "Unit Price", alignment: AlignmentType.CENTER })], shading: { fill: "F3F3F3" } }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.total || "Total", alignment: AlignmentType.CENTER })], shading: { fill: "F3F3F3" } }),
                ],
              }),
              ...data.items.map(
                (item, index) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: String(index + 1).padStart(2, "0"), alignment: AlignmentType.CENTER })] }),
                      new TableCell({
                        children: [
                          new Paragraph(item.product),
                          ...(rowImages[index]
                            ? [
                                new Paragraph({
                                  children: [
                                    new ImageRun({
                                      data: rowImages[index].bytes,
                                      transformation: { width: rowImages[index].width, height: rowImages[index].height },
                                    } as any),
                                  ],
                                }),
                              ]
                            : []),
                        ],
                      }),
                      new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: String(item.unitPrice), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: String(item.quantity * item.unitPrice), alignment: AlignmentType.RIGHT })] }),
                    ],
                  })
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `Subtotal: ${formatZAR(totals.subtotal)}`, alignment: AlignmentType.RIGHT }),
          ...(data.vatRate > 0 ? [new Paragraph({ text: `VAT (${data.vatRate}%): ${formatZAR(totals.vatAmount)}`, alignment: AlignmentType.RIGHT })] : []),
          new Paragraph({ text: `Grand Total: ${formatZAR(totals.grandTotal)}`, alignment: AlignmentType.RIGHT, heading: HeadingLevel.HEADING_3 }),
          
          ...(data.notes ? [
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Notes / Terms", heading: HeadingLevel.HEADING_3 }),
            new Paragraph({ text: data.notes })
          ] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.tenderNumber || data.title || "document").replace(/\s+/g, "-")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(data: PdfData) {
  const escapeCSV = (str: string) => `"${(str || "").replace(/"/g, '""')}"`;
  
  let csvContent = "";
  
  // Company Info
  csvContent += `${escapeCSV(data.company.name)}\n`;
  csvContent += `${escapeCSV(data.company.address.replace(/\n/g, ", "))}\n`;
  csvContent += `${escapeCSV(`Email: ${data.company.contact_email || ""} | Phone: ${data.company.contact_phone || ""}`)}\n\n`;
  
  // Document Info
  csvContent += `${escapeCSV(data.documentType.toUpperCase())},${escapeCSV(data.title)}\n`;
  csvContent += `Date:,${escapeCSV(new Date().toLocaleDateString())}\n`;
  if (data.tenderNumber) csvContent += `Doc No:,${escapeCSV(data.tenderNumber)}\n`;
  if (data.quotationRef) csvContent += `Ref:,${escapeCSV(data.quotationRef)}\n`;
  csvContent += "\n";

  // Client Info
  if (data.clientName) {
    csvContent += `PREPARED FOR:,${escapeCSV(data.clientName)}\n`;
    if (data.clientAddress) csvContent += `Client Address:,${escapeCSV(data.clientAddress.replace(/\n/g, ", "))}\n`;
    csvContent += "\n";
  }

  // Table Headers
  const hDesc = escapeCSV(data.columnNames?.desc || "Description");
  const hQty = escapeCSV(data.columnNames?.qty || "Quantity");
  const hPrice = escapeCSV(data.columnNames?.price || "Unit Price");
  const hTotal = escapeCSV(data.columnNames?.total || "Total");
  csvContent += `"No.",${hDesc},${hQty},${hPrice},${hTotal}\n`;
  
  // Table Rows
  data.items.forEach((item, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const total = item.quantity * item.unitPrice;
    const desc = item.image ? `${item.product} [image attached]` : item.product;
    csvContent += `"${num}",${escapeCSV(desc)},${item.quantity},${item.unitPrice},${total}\n`;
  });
  
  // Totals
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  csvContent += `\n,,,Subtotal,${totals.subtotal}\n`;
  if (data.vatRate > 0) csvContent += `,,,VAT (${data.vatRate}%),${totals.vatAmount}\n`;
  csvContent += `,,,Grand Total,${totals.grandTotal}\n`;

  // Notes
  if (data.notes) {
    csvContent += `\nNotes / Terms:\n${escapeCSV(data.notes)}\n`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.tenderNumber || data.title || "document").replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
