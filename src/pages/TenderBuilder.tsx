import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Trash2, Download, Save, ArrowLeft, FileText } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/useCompany";
import { formatZAR } from "@/lib/format";
import { computeTotals, generateTenderPDF, TenderItem } from "@/lib/pdf";
import { toast } from "sonner";

const blankItem = (): TenderItem => ({ product: "", quantity: 1, unitPrice: 0 });

export default function TenderBuilder() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const { user } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [tenderNumber, setTenderNumber] = useState("");
  const [quotationRef, setQuotationRef] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(15);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [items, setItems] = useState<TenderItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load existing
  useEffect(() => {
    if (isNew) {
      setTenderNumber(`TEN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
      return;
    }
    supabase.from("tenders").select("*").eq("id", id!).maybeSingle().then(({ data }) => {
      if (!data) return;
      setTitle(data.title); setTenderNumber(data.tender_number || "");
      setQuotationRef((data as any).quotation_ref || "");
      setClientName(data.client_name || ""); setClientAddress(data.client_address || "");
      setNotes(data.notes || ""); setVatRate(Number(data.vat_rate));
      setVatInclusive(data.vat_inclusive); setItems((data.items as any) || [blankItem()]);
    });
  }, [id, isNew]);

  const totals = useMemo(() => computeTotals(items, vatRate, vatInclusive), [items, vatRate, vatInclusive]);

  const updateItem = (i: number, patch: Partial<TenderItem>) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const save = async (): Promise<string | null> => {
    if (!user) return null;
    if (!title.trim()) { toast.error("Add a title"); return null; }
    setSaving(true);
    const payload = {
      user_id: user.id,
      company_id: company?.id || null,
      title: title.trim(),
      tender_number: tenderNumber || null,
      quotation_ref: quotationRef || null,
      client_name: clientName || null,
      client_address: clientAddress || null,
      notes: notes || null,
      vat_rate: vatRate,
      vat_inclusive: vatInclusive,
      items: items as any,
      subtotal: totals.subtotal,
      vat_amount: totals.vatAmount,
      grand_total: totals.grandTotal,
      status: "draft",
    };
    let result;
    if (isNew) {
      result = await supabase.from("tenders").insert(payload).select().single();
    } else {
      result = await supabase.from("tenders").update(payload).eq("id", id!).select().single();
    }
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return null; }
    toast.success("Tender saved");
    if (isNew) navigate(`/tenders/${result.data.id}`, { replace: true });
    return result.data.id;
  };

  const exportPDF = async () => {
    if (!company) { toast.error("Set up your company first"); return; }
    setExporting(true);
    try {
      await save();
      const blob = await generateTenderPDF({
        title, tenderNumber, quotationRef, clientName, clientAddress, notes,
        vatInclusive, vatRate, items, company,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${(tenderNumber || title || "tender").replace(/\s+/g, "-")}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("PDF generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8 md:p-12 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/tenders")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="h-3 w-3" /> Back to tenders
          </button>

          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{isNew ? "New" : "Editing"} tender</div>
              <h1 className="font-display text-4xl mt-1">{title || "Untitled tender"}</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={save} disabled={saving}>
                <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save draft"}
              </Button>
              <Button onClick={exportPDF} disabled={exporting} className="bg-primary hover:bg-primary/90 shadow-elevated">
                <Download className="h-4 w-4 mr-1.5" /> {exporting ? "Generating…" : "Export PDF"}
              </Button>
            </div>
          </div>

          {/* Header card */}
          <div className="mt-8 bg-card border border-border rounded-xl p-7 shadow-soft grid md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Label>Tender title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5" placeholder="Supply of construction materials — Phase 2" />
            </div>
            <div>
              <Label>Quotation No.</Label>
              <Input value={tenderNumber} onChange={e => setTenderNumber(e.target.value)} className="mt-1.5" placeholder="KGL2026/015" />
            </div>
            <div>
              <Label>Quotation Ref.</Label>
              <Input value={quotationRef} onChange={e => setQuotationRef(e.target.value)} className="mt-1.5" placeholder="RFQJW03SN25" />
            </div>
            <div>
              <Label>Client name</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} className="mt-1.5" placeholder="City of Cape Town" />
            </div>
            <div>
              <Label>Client address</Label>
              <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {/* Line items */}
          <div className="mt-6 bg-card border border-border rounded-xl shadow-soft overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-display text-xl">Line items</h2>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1.5" /> Add row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-muted-foreground text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium w-28 text-right">Qty</th>
                    <th className="px-4 py-3 font-medium w-40 text-right">Unit Price (R)</th>
                    <th className="px-4 py-3 font-medium w-40 text-right">Total</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-2">
                        <Input value={it.product} onChange={e => updateItem(i, { product: e.target.value })} placeholder="Item description" className="border-0 bg-transparent focus-visible:bg-secondary/40" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} value={it.quantity} onChange={e => updateItem(i, { quantity: Number(e.target.value) })} className="text-right tabular-nums border-0 bg-transparent focus-visible:bg-secondary/40" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} step="0.01" value={it.unitPrice} onChange={e => updateItem(i, { unitPrice: Number(e.target.value) })} className="text-right tabular-nums border-0 bg-transparent focus-visible:bg-secondary/40" />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatZAR(it.quantity * it.unitPrice)}
                      </td>
                      <td className="pr-3">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="p-6 border-t border-border bg-secondary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch checked={vatInclusive} onCheckedChange={setVatInclusive} id="vat-inc" />
                  <Label htmlFor="vat-inc" className="cursor-pointer">VAT inclusive pricing</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="vat-rate" className="text-sm">VAT %</Label>
                  <Input id="vat-rate" type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} className="w-20" />
                </div>
              </div>
              <div className="w-full md:w-72 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatZAR(totals.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>VAT ({vatRate}%){vatInclusive ? " incl." : ""}</span><span className="tabular-nums">{formatZAR(totals.vatAmount)}</span></div>
                <div className="flex justify-between font-display text-xl pt-2 border-t border-primary"><span>Grand Total</span><span className="tabular-nums">{formatZAR(totals.grandTotal)}</span></div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6 bg-card border border-border rounded-xl p-7 shadow-soft">
            <Label>Notes / Terms</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-1.5" placeholder="Payment terms, delivery schedule, validity period…" />
          </div>

          {!company && (
            <div className="mt-6 rounded-xl border border-accent/40 bg-accent/10 p-5 flex items-start gap-3">
              <FileText className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <div className="font-medium">Set up your company first</div>
                <div className="text-sm text-muted-foreground">Add company details and a letterhead to enable PDF export. <button onClick={() => navigate("/company")} className="text-primary hover:underline">Go to company profile</button></div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
