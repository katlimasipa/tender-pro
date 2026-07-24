import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { PdfData, computeTotals } from "./pdf";
import { formatZAR } from "./format";

export async function exportWord(data: PdfData) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: data.title || "Tender Document", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: `Client: ${data.clientName || ""}` }),
          new Paragraph({ text: `Date: ${new Date().toLocaleDateString()}` }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.desc || "Description", alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.qty || "Quantity", alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.price || "Unit Price", alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: data.columnNames?.total || "Total", alignment: AlignmentType.CENTER })] }),
                ],
              }),
              ...data.items.map(
                (item) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(item.product)] }),
                      new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: String(item.unitPrice), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: String(item.quantity * item.unitPrice), alignment: AlignmentType.RIGHT })] }),
                    ],
                  })
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `Grand Total: ${formatZAR(computeTotals(data.items, data.vatRate, data.vatInclusive).grandTotal)}`, alignment: AlignmentType.RIGHT, heading: HeadingLevel.HEADING_3 }),
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
  const hDesc = (data.columnNames?.desc || "Description").replace(/"/g, '""');
  const hQty = (data.columnNames?.qty || "Quantity").replace(/"/g, '""');
  const hPrice = (data.columnNames?.price || "Unit Price").replace(/"/g, '""');
  const hTotal = (data.columnNames?.total || "Total").replace(/"/g, '""');
  let csvContent = `"${hDesc}","${hQty}","${hPrice}","${hTotal}"\n`;
  data.items.forEach(item => {
    const total = item.quantity * item.unitPrice;
    csvContent += `"${item.product.replace(/"/g, '""')}",${item.quantity},${item.unitPrice},${total}\n`;
  });
  const totals = computeTotals(data.items, data.vatRate, data.vatInclusive);
  csvContent += `\nSubtotal,,,${totals.subtotal}\n`;
  csvContent += `VAT,,,${totals.vatAmount}\n`;
  csvContent += `Grand Total,,,${totals.grandTotal}\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(data.tenderNumber || data.title || "document").replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
