import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Trash2, Download, Save, ArrowLeft, FileText, GripVertical, ClipboardPaste, Image as ImageIcon, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/useCompany";
import { formatZAR } from "@/lib/format";
import { computeTotals, generateTenderPDF, TenderItem } from "@/lib/pdf";
import { exportWord, exportCSV } from "@/lib/export";
import { parseClipboard, ParsedRow } from "@/lib/parseTable";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ItemWithId extends TenderItem {
  id: string;
}

const blankItem = (): ItemWithId => ({ id: crypto.randomUUID(), product: "", quantity: 0, unitPrice: 0 });

const SortableTableRow = ({ id, it, index, updateItem, removeItem, itemsLength }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [descFocused, setDescFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height on focus or when content changes while focused
  useEffect(() => {
    if (descFocused && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [descFocused, it.product]);

  return (
    <tr ref={setNodeRef} style={style} className="border-t border-border bg-card align-top">
      <td className="px-2 py-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pt-3" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </td>
      <td className="px-2 py-2">
        <textarea
          ref={textareaRef}
          value={it.product}
          onChange={e => updateItem(index, { product: e.target.value })}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
          placeholder="Item description"
          rows={descFocused ? undefined : 1}
          className="flex w-full rounded-sm bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-secondary/40 border-0 resize-none overflow-hidden"
          style={!descFocused ? { height: "36px", whiteSpace: "nowrap", textOverflow: "ellipsis" } : {}}
        />
      </td>
      <td className="px-2 py-2">
        <Input type="number" min={0} value={it.quantity === 0 ? "" : it.quantity} placeholder="0" onChange={e => updateItem(index, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })} className="text-right tabular-nums border-0 bg-transparent focus-visible:bg-secondary/40" />
      </td>
      <td className="px-2 py-2">
        <Input type="number" min={0} step="0.01" value={it.unitPrice === 0 ? "" : it.unitPrice} placeholder="0.00" onChange={e => updateItem(index, { unitPrice: e.target.value === "" ? 0 : Number(e.target.value) })} className="text-right tabular-nums border-0 bg-transparent focus-visible:bg-secondary/40" />
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">
        {formatZAR(it.quantity * it.unitPrice)}
      </td>
      <td className="pr-3">
        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={itemsLength === 1} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
};

export default function TenderBuilder() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const { user } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("Quotation");
  const [customDocType, setCustomDocType] = useState("");
  const [tenderNumber, setTenderNumber] = useState("");
  const [quotationRef, setQuotationRef] = useState("");
  const [clientName, setClientName] = useState("");
  
  const [clientAddressLine1, setClientAddressLine1] = useState("");
  const [clientAddressLine2, setClientAddressLine2] = useState("");
  const [clientSuburb, setClientSuburb] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientPostalCode, setClientPostalCode] = useState("");
  
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(15);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [includeBankingDetails, setIncludeBankingDetails] = useState(true);
  const [items, setItems] = useState<ItemWithId[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteMode, setPasteMode] = useState<"append" | "replace">("append");
  const [extractingImage, setExtractingImage] = useState(false);
  const pasteRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load existing
  useEffect(() => {
    if (isNew) {
      return;
    }
    supabase.from("tenders").select("*").eq("id", id!).maybeSingle().then(({ data }) => {
      if (!data) return;
      setTitle(data.title); setTenderNumber(data.tender_number || "");
      const dt = (data as any).document_type || "Quotation";
      const presets = ["Quotation", "Specification", "Invoice", "Proposal", "Estimate"];
      if (presets.includes(dt)) { setDocumentType(dt); setCustomDocType(""); }
      else { setDocumentType("Other"); setCustomDocType(dt); }
      setQuotationRef((data as any).quotation_ref || "");
      setClientName(data.client_name || ""); 
      
      const addr = data.client_address || "";
      const addrLines = addr.split('\n');
      setClientAddressLine1(addrLines[0] || "");
      setClientAddressLine2(addrLines[1] || "");
      setClientSuburb(addrLines[2] || "");
      setClientCity(addrLines[3] || "");
      setClientPostalCode(addrLines[4] || "");
      
      setNotes(data.notes || ""); setVatRate(Number(data.vat_rate));
      setVatInclusive(data.vat_inclusive); 
      
      const loadedItems = (data.items as any) || [blankItem()];
      setItems(loadedItems.map((it: any) => ({ ...it, id: it.id || crypto.randomUUID() })));
    });
  }, [id, isNew]);

  const effectiveDocType = documentType === "Other" ? (customDocType.trim() || "Document") : documentType;
  const composedAddress = [clientAddressLine1, clientAddressLine2, clientSuburb, clientCity, clientPostalCode].filter(Boolean).join('\n');

  // Debounced PDF preview
  useEffect(() => {
    if (!company) return;
    const timeout = setTimeout(async () => {
      try {
        const blob = await generateTenderPDF({
          title, documentType: effectiveDocType, tenderNumber, quotationRef, clientName, clientAddress: composedAddress, notes,
          vatInclusive, vatRate, items, company, includeBankingDetails
        });
        const url = URL.createObjectURL(blob);
        setPdfUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        console.error(e);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [title, documentType, customDocType, tenderNumber, quotationRef, clientName, clientAddressLine1, clientAddressLine2, clientSuburb, clientCity, clientPostalCode, notes, vatInclusive, vatRate, items, company, includeBankingDetails]);


  const totals = useMemo(() => computeTotals(items, vatRate, vatInclusive), [items, vatRate, vatInclusive]);

  const updateItem = (i: number, patch: Partial<TenderItem>) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((it) => it.id === active.id);
        const newIndex = items.findIndex((it) => it.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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
      client_address: composedAddress || null,
      document_type: effectiveDocType,
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

  const exportAsPDF = async () => {
    if (!company) { toast.error("Set up your company first"); return; }
    setExporting(true);
    try {
      await save();
      const blob = await generateTenderPDF({
        title, documentType: effectiveDocType, tenderNumber, quotationRef, clientName, clientAddress: composedAddress, notes,
        vatInclusive, vatRate, items, company, includeBankingDetails
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${(title || tenderNumber || "tender").replace(/\s+/g, "-")}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("PDF generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportAsWord = async () => {
    if (!company) { toast.error("Set up your company first"); return; }
    await save();
    await exportWord({ title, documentType: effectiveDocType, tenderNumber, quotationRef, clientName, clientAddress: composedAddress, notes, vatInclusive, vatRate, items, company, includeBankingDetails });
    toast.success("Word document generated");
  };

  const exportAsCSV = async () => {
    await save();
    exportCSV({ title, documentType: effectiveDocType, tenderNumber, quotationRef, clientName, clientAddress: composedAddress, notes, vatInclusive, vatRate, items, company: company as any, includeBankingDetails });
    toast.success("CSV generated");
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-8 md:p-12 max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-[1fr_500px] gap-8 items-start">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 xl:h-[calc(100vh-96px)] xl:overflow-y-auto xl:pr-4">
          <button onClick={() => navigate("/tenders")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="h-3 w-3" /> Back to tenders
          </button>

          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">{isNew ? "New" : "Editing"} tender</div>
              <h1 className="font-display text-3xl sm:text-4xl mt-1 break-words">{title || "Untitled tender"}</h1>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={save} disabled={saving} className="flex-1 sm:flex-none">
                <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Save"}
              </Button>
              <Button onClick={exportAsWord} variant="outline" title="Export Word">
                <FileText className="h-4 w-4 mr-1.5" /> Word
              </Button>
              <Button onClick={exportAsCSV} variant="outline" title="Export CSV">
                <FileText className="h-4 w-4 mr-1.5" /> CSV
              </Button>
              <Button onClick={exportAsPDF} disabled={exporting} className="bg-primary hover:bg-primary/90 shadow-elevated flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-1.5" /> {exporting ? "Generating…" : "Export PDF"}
              </Button>
            </div>
          </div>

          {/* Header card */}
          <div className="mt-6 sm:mt-8 bg-card border border-border rounded-xl p-5 sm:p-7 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Label>Document title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5" placeholder="Supply of construction materials — Phase 2" />
            </div>
            <div>
              <Label>Document type</Label>
              <select
                value={documentType}
                onChange={e => setDocumentType(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option>Quotation</option>
                <option>Specification</option>
                <option>Invoice</option>
                <option>Proposal</option>
                <option>Estimate</option>
                <option value="Other">Other (custom)…</option>
              </select>
              {documentType === "Other" && (
                <Input
                  value={customDocType}
                  onChange={e => setCustomDocType(e.target.value)}
                  className="mt-2"
                  placeholder="e.g. Statement of Work"
                />
              )}
            </div>
            <div>
              <Label>Document No. <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={tenderNumber} onChange={e => setTenderNumber(e.target.value)} className="mt-1.5" placeholder="KGL2026/015" />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={quotationRef} onChange={e => setQuotationRef(e.target.value)} className="mt-1.5" placeholder="RFQJW03SN25" />
            </div>
            <div>
              <Label>Client name</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} className="mt-1.5" placeholder="City of Cape Town" />
            </div>
            <div className="md:col-span-2 space-y-4">
              <Label className="text-base">Client address</Label>
              <div>
                <Label className="text-xs text-muted-foreground">Street address</Label>
                <Input value={clientAddressLine1} onChange={e => setClientAddressLine1(e.target.value)} className="mt-1.5" placeholder="123 Main Street" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Address line 2 (optional)</Label>
                <Input value={clientAddressLine2} onChange={e => setClientAddressLine2(e.target.value)} className="mt-1.5" placeholder="Suite, unit, building…" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Suburb</Label>
                  <Input value={clientSuburb} onChange={e => setClientSuburb(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={clientCity} onChange={e => setClientCity(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Postal code</Label>
                  <Input value={clientPostalCode} onChange={e => setClientPostalCode(e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="mt-6 bg-card border border-border rounded-xl shadow-soft overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
              <h2 className="font-display text-lg sm:text-xl">Line items</h2>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1.5" /> Add row
              </Button>
            </div>

            {/* Table */}
            <div className="block overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-secondary/50 text-muted-foreground text-left">
                  <tr>
                    <th className="w-8"></th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium w-28 text-right">Quantity</th>
                    <th className="px-4 py-3 font-medium w-40 text-right">Unit Price (R)</th>
                    <th className="px-4 py-3 font-medium w-40 text-right">Total</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <tbody>
                    <SortableContext items={items.map(it => it.id)} strategy={verticalListSortingStrategy}>
                      {items.map((it, i) => (
                        <SortableTableRow key={it.id} id={it.id} it={it} index={i} updateItem={updateItem} removeItem={removeItem} itemsLength={items.length} />
                      ))}
                    </SortableContext>
                  </tbody>
                </DndContext>
              </table>
            </div>

            {/* Totals */}
            <div className="p-4 sm:p-6 border-t border-border bg-secondary/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 sm:flex-wrap">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={vatInclusive}
                    onCheckedChange={(on) => {
                      setVatInclusive(on);
                      setVatRate(on ? (vatRate || 15) : 0);
                    }}
                    id="vat-inc"
                  />
                  <Label htmlFor="vat-inc" className="cursor-pointer text-sm">VAT inclusive</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="vat-rate" className={`text-sm ${!vatInclusive ? "text-muted-foreground/50" : ""}`}>VAT %</Label>
                  <Input id="vat-rate" type="number" inputMode="decimal" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} className="w-20" disabled={!vatInclusive} />
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
          <div className="mt-6 bg-card border border-border rounded-xl p-5 sm:p-7 shadow-soft">
            <Label>Notes / Terms</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-1.5" placeholder="Payment terms, delivery schedule, validity period…" />
            
            <div className="mt-6 pt-6 border-t border-border flex items-center gap-3">
              <Switch
                checked={includeBankingDetails}
                onCheckedChange={setIncludeBankingDetails}
                id="bank-inc"
              />
              <Label htmlFor="bank-inc" className="cursor-pointer text-sm">Include company banking details on PDF</Label>
            </div>
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
        
        {/* Live Preview */}
        <div className="hidden xl:block h-[calc(100vh-96px)] rounded-xl border border-border shadow-soft overflow-hidden bg-secondary">
          <div className="p-3 border-b border-border bg-card flex items-center justify-between">
            <h3 className="font-display text-sm">Live Preview</h3>
          </div>
          {pdfUrl ? (
            <iframe src={`${pdfUrl}#toolbar=0`} className="w-full h-full" title="PDF Preview" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Generating preview...
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
