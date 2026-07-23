// Parse pasted table content (from Word, Excel, Google Sheets, or plain text)
// into TenderItem rows.

export interface ParsedRow {
  product: string;
  quantity: number;
  unitPrice: number;
}

const toNumber = (s: string): number => {
  if (!s) return 0;
  // Strip currency symbols, spaces, and thousands separators. Handle "1 234,56" and "1,234.56".
  let cleaned = s.replace(/[^\d,.\-]/g, "").trim();
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Comma is decimal separator
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const isSummaryRow = (cells: string[]): boolean => {
  const joined = cells.join(" ").toLowerCase();
  return /\b(subtotal|sub-total|total|vat|tax|grand total|amount due|balance)\b/.test(joined) &&
    cells.filter(c => c.trim()).length <= 3;
};

/**
 * Given a row of cells, decide which column is description / qty / unitPrice.
 * Heuristic:
 *  - Longest text cell = description.
 *  - Among remaining numeric cells: smaller integer-ish = quantity; larger = unit price.
 *  - If only 2 cols: [description, unitPrice] with qty = 1.
 *  - If only 1 col: description only, qty = 1, price = 0.
 */
const mapRow = (cells: string[]): ParsedRow | null => {
  const trimmed = cells.map(c => c.replace(/\s+/g, " ").trim());
  const nonEmpty = trimmed.filter(Boolean);
  if (nonEmpty.length === 0) return null;

  if (nonEmpty.length === 1) {
    return { product: nonEmpty[0], quantity: 1, unitPrice: 0 };
  }

  // Identify numeric-looking cells
  const numericIdx: number[] = [];
  trimmed.forEach((c, i) => {
    if (!c) return;
    if (/^[\-\d.,\s]*[\d][\-\d.,\s]*$/.test(c) || /^[R$€£]\s*[\d.,\s]+$/i.test(c)) {
      numericIdx.push(i);
    }
  });

  // Description = longest non-numeric cell, or first non-numeric
  let descIdx = -1;
  let descLen = -1;
  trimmed.forEach((c, i) => {
    if (numericIdx.includes(i)) return;
    if (c.length > descLen) { descLen = c.length; descIdx = i; }
  });
  if (descIdx === -1) descIdx = 0;

  const product = trimmed[descIdx] || nonEmpty[0];

  if (numericIdx.length === 0) {
    return { product, quantity: 1, unitPrice: 0 };
  }
  if (numericIdx.length === 1) {
    return { product, quantity: 1, unitPrice: toNumber(trimmed[numericIdx[0]]) };
  }
  // 2+ numeric cells: pick qty (smallest integer-like) and unit price (largest)
  const nums = numericIdx.map(i => ({ i, v: toNumber(trimmed[i]), raw: trimmed[i] }));
  // Heuristic: qty is typically the smaller value AND typically an integer
  const sorted = [...nums].sort((a, b) => a.v - b.v);
  const qty = sorted[0];
  const price = sorted[sorted.length - 1];
  // If qty appears after price column-wise, still fine; user can edit.
  return {
    product,
    quantity: qty.v || 1,
    unitPrice: price.v || 0,
  };
};

const looksLikeHeader = (cells: string[]): boolean => {
  const joined = cells.join(" ").toLowerCase();
  return /\b(description|item|product|qty|quantity|unit price|price|amount|rate|total)\b/.test(joined) &&
    !/\d{2,}/.test(joined);
};

export const parseHtmlTable = (html: string): ParsedRow[] => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const rows = Array.from(table.querySelectorAll("tr"));
  const parsed: ParsedRow[] = [];
  rows.forEach((tr, idx) => {
    const cells = Array.from(tr.querySelectorAll("th,td")).map(td =>
      (td.textContent || "").replace(/\s+/g, " ").trim()
    );
    if (cells.length === 0) return;
    if (idx === 0 && looksLikeHeader(cells)) return;
    if (isSummaryRow(cells)) return;
    const row = mapRow(cells);
    if (row && row.product) parsed.push(row);
  });
  return parsed;
};

export const parseDelimitedText = (text: string): ParsedRow[] => {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Prefer tab, else 2+ spaces, else comma, else single delimiter.
  const detect = (line: string): string | RegExp => {
    if (line.includes("\t")) return "\t";
    if (/ {2,}/.test(line)) return / {2,}/;
    if (line.includes("|")) return "|";
    if (line.includes(";")) return ";";
    if (line.includes(",")) return ",";
    return / {2,}/;
  };
  const delim = detect(lines[0]);
  const parsed: ParsedRow[] = [];
  lines.forEach((line, idx) => {
    const cells = (typeof delim === "string" ? line.split(delim) : line.split(delim)).map(c => c.trim());
    if (idx === 0 && looksLikeHeader(cells)) return;
    if (isSummaryRow(cells)) return;
    const row = mapRow(cells);
    if (row && row.product) parsed.push(row);
  });
  return parsed;
};

export const parseClipboard = (html: string, text: string): ParsedRow[] => {
  if (html && /<table[\s>]/i.test(html)) {
    const rows = parseHtmlTable(html);
    if (rows.length) return rows;
  }
  return parseDelimitedText(text || "");
};
