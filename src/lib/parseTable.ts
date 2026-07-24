// Parse pasted table content (from Word, Excel, Google Sheets, or plain text)
// into TenderItem rows, detecting header names when present.

export interface ParsedRow {
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface ParsedHeaders {
  description?: string;
  quantity?: string;
  unitPrice?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  headers: ParsedHeaders;
  /** True when the source table actually contained a unit-price column. */
  hasUnitPrice: boolean;
  /** True when the source table actually contained a quantity column. */
  hasQuantity: boolean;
}

const toNumber = (s: string): number => {
  if (!s) return 0;
  let cleaned = s.replace(/[^\d,.\-]/g, "").trim();
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
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

const looksLikeHeader = (cells: string[]): boolean => {
  const joined = cells.join(" ").toLowerCase();
  return /\b(description|item|product|service|qty|quantity|unit price|price|amount|rate|total|cost|no\.|#)\b/.test(joined) &&
    !/\d{2,}/.test(joined);
};

type ColRole = "description" | "quantity" | "unitPrice" | "amount" | "index" | "unknown";

const classifyHeader = (h: string): ColRole => {
  const s = h.toLowerCase().trim();
  if (!s) return "unknown";
  if (/^(#|no\.?|nr\.?|item\s*no|line)$/.test(s)) return "index";
  if (/(description|item|product|service|details?|particulars)/.test(s)) return "description";
  if (/(quantity|qty|units?|hours?|hrs?)/.test(s)) return "quantity";
  if (/(unit\s*price|unit\s*cost|rate|price|cost\/unit|price\s*per|cost)/.test(s)) return "unitPrice";
  if (/(amount|total|subtotal|line\s*total)/.test(s)) return "amount";
  return "unknown";
};

/** Map rows using an explicit header row. */
const mapWithHeaders = (
  headers: string[],
  dataRows: string[][],
): ParseResult => {
  const roles = headers.map(classifyHeader);
  let descIdx = roles.indexOf("description");
  let qtyIdx = roles.indexOf("quantity");
  let priceIdx = roles.indexOf("unitPrice");

  // Fallbacks: if no explicit description column, pick the first "unknown" or non-numeric column
  if (descIdx === -1) descIdx = roles.findIndex(r => r === "unknown");
  if (descIdx === -1) descIdx = 0;

  const rows: ParsedRow[] = [];
  for (const cells of dataRows) {
    if (!cells.some(c => c.trim())) continue;
    if (isSummaryRow(cells)) continue;

    const product = (cells[descIdx] || "").replace(/\s+/g, " ").trim();
    if (!product) continue;

    const quantity = qtyIdx >= 0 ? toNumber(cells[qtyIdx] || "") : 0;
    const unitPrice = priceIdx >= 0 ? toNumber(cells[priceIdx] || "") : 0;
    rows.push({ product, quantity, unitPrice });
  }

  return {
    rows,
    headers: {
      description: descIdx >= 0 ? headers[descIdx] : undefined,
      quantity: qtyIdx >= 0 ? headers[qtyIdx] : undefined,
      unitPrice: priceIdx >= 0 ? headers[priceIdx] : undefined,
    },
    hasQuantity: qtyIdx >= 0,
    hasUnitPrice: priceIdx >= 0,
  };
};

/** Heuristic mapping when no header row is present. */
const mapWithoutHeaders = (rows: string[][]): ParseResult => {
  const parsed: ParsedRow[] = [];
  let sawPrice = false;
  let sawQty = false;

  for (const cells of rows) {
    const trimmed = cells.map(c => c.replace(/\s+/g, " ").trim());
    const nonEmpty = trimmed.filter(Boolean);
    if (!nonEmpty.length) continue;
    if (isSummaryRow(trimmed)) continue;

    if (nonEmpty.length === 1) {
      parsed.push({ product: nonEmpty[0], quantity: 0, unitPrice: 0 });
      continue;
    }

    const numericIdx: number[] = [];
    trimmed.forEach((c, i) => {
      if (!c) return;
      if (/^[\-\d.,\s]*[\d][\-\d.,\s]*$/.test(c) || /^[R$€£]\s*[\d.,\s]+$/i.test(c)) {
        numericIdx.push(i);
      }
    });

    let descIdx = -1, descLen = -1;
    trimmed.forEach((c, i) => {
      if (numericIdx.includes(i)) return;
      if (c.length > descLen) { descLen = c.length; descIdx = i; }
    });
    if (descIdx === -1) descIdx = 0;

    const product = trimmed[descIdx] || nonEmpty[0];
    if (!product) continue;

    if (numericIdx.length === 0) {
      parsed.push({ product, quantity: 0, unitPrice: 0 });
    } else if (numericIdx.length === 1) {
      sawPrice = true;
      parsed.push({ product, quantity: 0, unitPrice: toNumber(trimmed[numericIdx[0]]) });
    } else {
      sawQty = true;
      sawPrice = true;
      const nums = numericIdx.map(i => ({ v: toNumber(trimmed[i]) }));
      const sorted = [...nums].sort((a, b) => a.v - b.v);
      parsed.push({
        product,
        quantity: sorted[0].v || 0,
        unitPrice: sorted[sorted.length - 1].v || 0,
      });
    }
  }

  return { rows: parsed, headers: {}, hasQuantity: sawQty, hasUnitPrice: sawPrice };
};

export const parseHtmlTable = (html: string): ParseResult => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return { rows: [], headers: {}, hasQuantity: false, hasUnitPrice: false };
  const trs = Array.from(table.querySelectorAll("tr"));
  const all = trs.map(tr => Array.from(tr.querySelectorAll("th,td")).map(td =>
    (td.textContent || "").replace(/\s+/g, " ").trim()
  )).filter(r => r.length);
  if (!all.length) return { rows: [], headers: {}, hasQuantity: false, hasUnitPrice: false };

  const firstRowIsHeader =
    trs[0].querySelector("th") !== null || looksLikeHeader(all[0]);

  if (firstRowIsHeader) {
    return mapWithHeaders(all[0], all.slice(1));
  }
  return mapWithoutHeaders(all);
};

export const parseDelimitedText = (text: string): ParseResult => {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim().length > 0);
  if (!lines.length) return { rows: [], headers: {}, hasQuantity: false, hasUnitPrice: false };
  const detect = (line: string): string | RegExp => {
    if (line.includes("\t")) return "\t";
    if (/ {2,}/.test(line)) return / {2,}/;
    if (line.includes("|")) return "|";
    if (line.includes(";")) return ";";
    if (line.includes(",")) return ",";
    return / {2,}/;
  };
  const delim = detect(lines[0]);
  const all = lines.map(line => (typeof delim === "string" ? line.split(delim) : line.split(delim)).map(c => c.trim()));

  if (looksLikeHeader(all[0])) {
    return mapWithHeaders(all[0], all.slice(1));
  }
  return mapWithoutHeaders(all);
};

export const parseClipboard = (html: string, text: string): ParseResult => {
  if (html && /<table[\s>]/i.test(html)) {
    const res = parseHtmlTable(html);
    if (res.rows.length) return res;
  }
  return parseDelimitedText(text || "");
};
