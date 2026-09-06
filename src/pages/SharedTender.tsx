import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Save, Download, Loader2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";
import { computeTotals, generateTenderPDF, TenderItem } from "@/lib/pdf";
import { toast } from "sonner";
import logo from "@/assets/tender-desk-logo.svg";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/useCompany";

interface ItemWithId extends TenderItem { id: string }

const blankItem = (): ItemWithId => ({ id: crypto.randomUUID(), product: "", quantity: 0, unitPrice: 0, image: null });


export default function SharedTender() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { company: myCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);


  const [company, setCompany] = useState<any>(null);
  const [meta, setMeta] = useState<any>({});
  const [columns, setColumns] = useState({ desc: "Description", qty: "Quantity", price: "Unit Price (R)", total: "Total" });

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(15);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [items, setItems] = useState<ItemWithId[]>([blankItem()]);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_shared_tender", { p_token: token }).then(({ data, error }) => {
      setLoading(false);
      const payload: any = data;
      if (error || !payload?.tender) { setNotFound(true); return; }
      const t = payload.tender;
      setCompany(payload.company || null);
      setMeta(t);
      setTitle(t.title || "");
      setClientName(t.client_name || "");
      setClientAddress(t.client_address || "");
      setNotes(t.notes || "");
      setVatRate(Number(t.vat_rate ?? 15));
      setVatInclusive(!!t.vat_inclusive);
      const raw = t.items;
      let rows: any[] = [];
      if (Array.isArray(raw)) rows = raw;
      else if (raw?.rows) { rows = raw.rows; if (raw.columns) setColumns(raw.columns); }
      setItems(rows.length ? rows.map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })) : [blankItem()]);
    });
  }, [token]);

  const totals = useMemo(() => computeTotals(items, vatRate, vatInclusive), [items, vatRate, vatInclusive]);

  const updateItem = (i: number, patch: Partial<TenderItem>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i: number) =>
    setItems(prev => { const next = prev.filter((_, idx) => idx !== i); return next.length ? next : [blankItem()]; });

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("save_shared_tender", {
      p_token: token!,
      p_title: title,
      p_client_name: clientName || null,
      p_client_address: clientAddress || null,
      p_notes: notes || null,
      p_items: { columns, rows: items } as any,
      p_vat_rate: vatRate,
      p_vat_inclusive: vatInclusive,
      p_subtotal: totals.subtotal,
      p_vat_amount: totals.vatAmount,
      p_grand_total: totals.grandTotal,
    });
    setSaving(false);
    if (error || data === false) return toast.error(error?.message || "This link is no longer active");
    toast.success("Changes saved");
  };

  const saveToMyAccount = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setCopying(true);
    const { data, error } = await supabase
      .from("tenders")
      .insert({
        user_id: user.id,
        company_id: myCompany?.id ?? null,
        title: title || "Untitled document",
        document_type: meta.document_type || "Quotation",
        tender_number: meta.tender_number || null,
        quotation_ref: meta.quotation_ref || null,
        client_name: clientName || null,
        client_address: clientAddress || null,
        notes: notes || null,
        items: { columns, rows: items } as any,
        vat_rate: vatRate,
        vat_inclusive: vatInclusive,
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        grand_total: totals.grandTotal,
        status: "draft",
      } as any)
      .select("id")
      .single();
    setCopying(false);
    if (error) return toast.error(error.message);
    toast.success("Saved to your documents");
    navigate(`/tenders/${(data as any).id}`);
  };



  const exportPDF = async () => {
    if (!company) { toast.error("This document has no company details yet"); return; }
    setExporting(true);
    try {
      const blob = await generateTenderPDF({
        title,
        documentType: meta.document_type || "Quotation",
        tenderNumber: meta.tender_number || "",
        quotationRef: meta.quotation_ref || "",
        clientName, clientAddress, notes, vatInclusive, vatRate, items,
        company, includeBankingDetails: true, columnNames: columns,
      } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${(title || "document").replace(/\s+/g, "-")}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't create the PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <h1 className="font-display text-3xl">Link not available</h1>
          <p className="text-muted-foreground mt-2 max-w-md">
            This editing link has been turned off or doesn't exist. Ask the person who sent it for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="Tender Desk" className="h-7 w-auto" />
            <span className="text-sm text-muted-foreground hidden sm:inline">Shared document</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPDF} disabled={exporting}>
              <Download className="h-4 w-4 mr-1.5" /> {exporting ? "Creating…" : "PDF"}
            </Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="font-display text-3xl break-words">{title || "Untitled document"}</h1>
        <p className="text-muted-foreground text-sm mt-1">{meta.document_type || "Quotation"}{meta.tender_number ? ` · ${meta.tender_number}` : ""}</p>

        <div className="mt-8 bg-card border border-border rounded-xl p-5 sm:p-7 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Client name</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="md:col-span-2">
            <Label>Client address</Label>
            <Textarea value={clientAddress} onChange={e => setClientAddress(e.target.value)} rows={4} className="mt-1.5" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={vatInclusive} onCheckedChange={(v) => { setVatInclusive(v); if (!v) setVatRate(0); else setVatRate(15); }} />
            <span className="text-sm">Include VAT</span>
          </div>
          <div>
            <Label>VAT %</Label>
            <Input type="number" value={vatRate} disabled={!vatInclusive} onChange={e => setVatRate(Number(e.target.value) || 0)} className="mt-1.5" />
          </div>
        </div>

        <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-3 font-medium">{columns.desc}</th>
                <th className="px-3 py-3 font-medium w-24 text-right">{columns.qty}</th>
                <th className="px-3 py-3 font-medium w-32 text-right">{columns.price}</th>
                <th className="px-3 py-3 font-medium w-32 text-right">{columns.total}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <textarea
                      value={it.product}
                      onChange={e => updateItem(i, { product: e.target.value })}
                      rows={2}
                      className="w-full bg-transparent resize-y rounded-sm px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-pre-wrap"
                      placeholder="Item description"
                    />
                    {it.image && <img src={it.image} alt="" className="mt-2 max-h-24 rounded-md border border-border" />}
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={it.quantity === 0 ? "" : it.quantity} placeholder="0"
                      onChange={e => updateItem(i, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="text-right tabular-nums" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} step="0.01" value={it.unitPrice === 0 ? "" : it.unitPrice} placeholder="0.00"
                      onChange={e => updateItem(i, { unitPrice: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="text-right tabular-nums" />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {it.unitPrice > 0 ? formatZAR(it.quantity * it.unitPrice) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="pr-2">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setItems(prev => [...prev, blankItem()])}>
              <Plus className="h-4 w-4 mr-1.5" /> Add row
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="mt-1.5" />
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatZAR(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT ({vatRate}%)</span><span className="tabular-nums">{formatZAR(totals.vatAmount)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total due</span><span className="tabular-nums">{formatZAR(totals.grandTotal)}</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}
