import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DOC_TYPE_PRESETS } from "@/lib/docTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  tenderId: string;
  value: string;
  onChanged: (next: string) => void;
}

/** Inline "convert this document into another type" control for list views. */
export default function DocTypeMenu({ tenderId, value, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const apply = async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === value) return;
    setSaving(true);
    const { error } = await supabase.from("tenders").update({ document_type: trimmed }).eq("id", tenderId);
    setSaving(false);
    if (error) return toast.error(error.message);
    onChanged(trimmed);
    toast.success(`Converted to ${trimmed}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition"
            title="Change document type"
          >
            {value || "Quotation"}
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Convert to</DropdownMenuLabel>
          {DOC_TYPE_PRESETS.map((t) => (
            <DropdownMenuItem key={t} onSelect={() => apply(t)} className="text-sm">
              <Check className={`h-3.5 w-3.5 mr-2 ${t === value ? "opacity-100" : "opacity-0"}`} />
              {t}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { setCustom(DOC_TYPE_PRESETS.includes(value as any) ? "" : value); setCustomOpen(true); }} className="text-sm">
            <span className="ml-[22px]">Custom type…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Custom document type</DialogTitle>
            <DialogDescription>This replaces the type shown on the document and its exports.</DialogDescription>
          </DialogHeader>
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Statement of Work" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => { await apply(custom); setCustomOpen(false); }}
              disabled={!custom.trim()}
            >
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
