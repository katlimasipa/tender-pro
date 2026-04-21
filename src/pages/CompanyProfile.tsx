import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/useCompany";
import { toast } from "sonner";

export default function CompanyProfile() {
  const { user } = useAuth();
  const { company, refresh, loading } = useCompany();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (company) setForm(company); }, [company]);

  const save = async () => {
    if (!company) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      name: form.name, registration_number: form.registration_number || null,
      vat_number: form.vat_number || null, contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null, address: form.address || null,
    }).eq("id", company.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company updated");
    refresh();
  };

  const uploadLetterhead = async (file: File) => {
    if (!user || !company) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/letterhead-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("letterheads").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data } = await supabase.storage.from("letterheads").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = data?.signedUrl;
    await supabase.from("companies").update({ letterhead_url: url }).eq("id", company.id);
    setUploading(false);
    toast.success("Letterhead uploaded");
    refresh();
  };

  if (loading) return <AppShell><div className="p-12 text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="p-8 md:p-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-sm text-muted-foreground">Settings</div>
          <h1 className="font-display text-4xl mt-1">Company profile</h1>
          <p className="text-muted-foreground mt-2">These details appear on every tender you export.</p>

          {/* Letterhead */}
          <div className="mt-10 bg-card border border-border rounded-xl p-7 shadow-soft">
            <h2 className="font-display text-xl">Letterhead</h2>
            <p className="text-sm text-muted-foreground mt-1">Upload an image (PNG/JPG). It will appear at the top of every PDF.</p>
            <div className="mt-5 flex items-center gap-4">
              {company?.letterhead_url ? (
                <img src={company.letterhead_url} alt="Letterhead" className="h-24 max-w-sm object-contain bg-secondary/40 rounded-md border border-border" />
              ) : (
                <div className="h-24 w-full max-w-sm bg-secondary/40 rounded-md border border-dashed border-border grid place-items-center text-muted-foreground text-sm">
                  No letterhead uploaded
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <label className="inline-flex">
                <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadLetterhead(e.target.files[0])} />
                <Button asChild variant="outline"><span><Upload className="h-4 w-4 mr-1.5" /> {uploading ? "Uploading…" : "Upload"}</span></Button>
              </label>
              {company?.letterhead_url && (
                <Button variant="ghost" onClick={async () => {
                  await supabase.from("companies").update({ letterhead_url: null }).eq("id", company.id);
                  refresh(); toast.success("Removed");
                }}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Remove
                </Button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="mt-6 bg-card border border-border rounded-xl p-7 shadow-soft space-y-5">
            <h2 className="font-display text-xl">Details</h2>
            <div>
              <Label>Company name</Label>
              <Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Registration number</Label>
                <Input value={form.registration_number || ""} onChange={e => setForm({ ...form, registration_number: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>VAT number</Label>
                <Input value={form.vat_number || ""} onChange={e => setForm({ ...form, vat_number: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Contact email</Label>
                <Input type="email" value={form.contact_email || ""} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Contact phone</Label>
                <Input value={form.contact_phone || ""} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1.5" rows={3} />
            </div>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
