// Extract line items from a table screenshot using Lovable AI (Gemini vision)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageDataUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You extract tabular line items from images of tables (invoices, quotations, spreadsheets).
Return ONLY valid JSON of the shape:
{
  "headers": { "description": string | null, "quantity": string | null, "unitPrice": string | null },
  "hasQuantity": boolean,
  "hasUnitPrice": boolean,
  "items": [{ "product": string, "quantity": number, "unitPrice": number }]
}
Rules:
- headers: copy the EXACT column header text used in the source image for the description, quantity and unit-price columns. Use null for any column that isn't present.
- hasQuantity / hasUnitPrice: true only if that column actually exists in the source table.
- product: full description text for the row.
- quantity: numeric quantity from the row. If the table has no quantity column, set 0.
- unitPrice: numeric unit price in the row's currency, no symbols, dot as decimal separator. If the table has no unit-price column, set 0. Do NOT invent or compute prices.
- Ignore total/subtotal/VAT summary rows. Only include line items.
- If a numeric value is missing on a specific row, use 0.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the line items and the exact column header names from this table image." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`AI gateway failed [${response.status}]:`, errorBody);
      return new Response(
        JSON.stringify({ error: "AI extraction failed", status: response.status, details: errorBody }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const cleaned = items.map((it: any) => ({
      product: String(it.product ?? "").trim(),
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
    })).filter((it: any) => it.product);

    const rawHeaders = parsed.headers || {};
    const headers = {
      description: rawHeaders.description ? String(rawHeaders.description).trim() : null,
      quantity: rawHeaders.quantity ? String(rawHeaders.quantity).trim() : null,
      unitPrice: rawHeaders.unitPrice ? String(rawHeaders.unitPrice).trim() : null,
    };
    const hasQuantity = typeof parsed.hasQuantity === "boolean"
      ? parsed.hasQuantity
      : !!headers.quantity || cleaned.some((it: any) => it.quantity > 0);
    const hasUnitPrice = typeof parsed.hasUnitPrice === "boolean"
      ? parsed.hasUnitPrice
      : !!headers.unitPrice || cleaned.some((it: any) => it.unitPrice > 0);

    return new Response(JSON.stringify({ items: cleaned, headers, hasQuantity, hasUnitPrice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-table-image error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
