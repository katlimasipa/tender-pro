import { useEffect, useState } from "react";
import { Share2, Copy, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tenderId: string;
  variant?: "button" | "icon";
}

const makeToken = () =>
  (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);

export default function ShareMenu({ tenderId, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("tenders")
      .select("share_token")
      .eq("id", tenderId)
      .maybeSingle()
      .then(({ data }) => setToken((data as any)?.share_token ?? null));
  }, [open, tenderId]);

  const link = token ? `${window.location.origin}/shared/${token}` : "";

  const createLink = async () => {
    setBusy(true);
    const next = makeToken();
    const { error } = await supabase.from("tenders").update({ share_token: next } as any).eq("id", tenderId);
    setBusy(false);
    if (error) return toast.error(error.message);
    setToken(next);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/shared/${next}`);
      toast.success("Editing link created and copied");
    } catch {
      toast.success("Editing link created");
    }
  };

  const revoke = async () => {
    setBusy(true);
    const { error } = await supabase.from("tenders").update({ share_token: null } as any).eq("id", tenderId);
    setBusy(false);
    if (error) return toast.error(error.message);
    setToken(null);
    toast.success("Link turned off");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          title="Share for editing"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Share2 className="h-4 w-4 mr-1.5" /> Share
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share for editing</DialogTitle>
            <DialogDescription>
              Anyone with this link can open the document and change it — no account needed. Only share it with people you trust.
            </DialogDescription>
          </DialogHeader>

          {token ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /></Button>
              </div>
              <Button variant="ghost" onClick={revoke} disabled={busy} className="text-muted-foreground hover:text-destructive px-0">
                <Link2Off className="h-4 w-4 mr-1.5" /> Turn off this link
              </Button>
            </div>
          ) : (
            <Button onClick={createLink} disabled={busy} className="bg-primary hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Share2 className="h-4 w-4 mr-1.5" />}
              Create editing link
            </Button>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
