import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Trash2, ImageIcon, PenLine } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/useCompany";
import { toast } from "sonner";

type UploadKind = "letterhead" | "logo" | "signature";

const BUCKETS: Record<UploadKind, string> = {
  letterhead: "letterheads",
  logo: "logos",
  signature: "signatures",
};

const COL: Record<UploadKind, "letterhead_url" | "logo_url" | "signature_url"> = {
  letterhead: "letterhead_url",
  logo: "logo_url",
  signature: "signature_url",
};

export default function CompanyProfile() {
  const { user } = useAuth();
  const { company, refresh, loading } = useCompany();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<UploadKind | null>(null);

  useEffect(() => { if (company) setForm(company); }, [company]);

  const save = async () => {
    if (!company) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      name: form.name,
      registration_number: form.registration_number || null,
      vat_number: form.vat_number || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      address: form.address || null,
      website: form.website || null,
      csd_number: form.csd_number || null,
      primary_color: form.primary_color || "#1C382C",
      accent_color: form.accent_color || "#C8932B",
    }).eq("id", company.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company updated");
    refresh();
  };

  const uploadAsset = async (kind: UploadKind, file: File) => {
    if (!user || !company) return;
    setBusy(kind);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKETS[kind]).upload(path, file, { upsert: true });
    if (upErr) { setBusy(null); return toast.error(upErr.message); }
    const { data } = await supabase.storage.from(BUCKETS[kind]).createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = data?.signedUrl;
    await supabase.from("companies").update({ [COL[kind]]: url } as any).eq("id", company.id);
    setBusy(null);
    toast.success(`${kind[0].toUpperCase()}${kind.slice(1)} uploaded`);
    refresh();
  };

  const removeAsset = async (kind: UploadKind) => {
    if (!company) return;
    await supabase.from("companies").update({ [COL[kind]]: null } as any).eq("id", company.id);
    refresh();
    toast.success("Removed");
  };

  if (loading) return <AppShell><div className="p-12 text-muted-foreground">Loading…</div></AppShell>;

  const AssetCard = ({ kind, label, hint, currentUrl, icon }: {
    kind: UploadKind; label: string; hint: string; currentUrl?: string | null; icon: React.ReactNode;
  }) => (
    <div className="bg-card border border-border rounded-xl p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-secondary grid place-items-center text-primary">{icon}</div>
        <div className="flex-1">
          <h3 className="font-display text-lg leading-tight">{label}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>
        </div>
      </div>
      <div className="mt-4">
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="h-20 max-w-full object-contain bg-secondary/40 rounded-md border border-border p-2" />
        ) : (
          <div className="h-20 bg-secondary/30 rounded-md border border-dashed border-border grid place-items-center text-muted-foreground text-sm">
            None uploaded
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <label className="inline-flex">
          <input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && uploadAsset(kind, e.target.files[0])} />
          <Button asChild variant="outline" size="sm"><span><Upload className="h-3.5 w-3.5 mr-1.5" />{busy === kind ? "Uploading…" : "Upload"}</span></Button>
        </label>
        {currentUrl && (
          <Button variant="ghost" size="sm" onClick={() => removeAsset(kind)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="p-8 md:p-12 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-sm text-muted-foreground">Settings</div>
          <h1 className="font-display text-4xl mt-1">Company profile</h1>
          <p className="text-muted-foreground mt-2">These details and brand assets appear on every tender PDF you export.</p>

          {/* Brand assets grid */}
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            <AssetCard
              kind="logo"
              label="Logo"
              hint="Shown top-left of every PDF."
              currentUrl={company?.logo_url}
              icon={<ImageIcon className="h-4 w-4" />}
            />
            <AssetCard
              kind="signature"
              label="Signature"
              hint="Auto-placed above signature line."
              currentUrl={company?.signature_url}
              icon={<PenLine className="h-4 w-4" />}
            />
            <AssetCard
              kind="letterhead"
              label="Letterhead (legacy)"
              hint="Optional — overrides header band."
              currentUrl={company?.letterhead_url}
              icon={<ImageIcon className="h-4 w-4" />}
            />
          </div>

          {/* Brand colours */}
          <div className="mt-6 bg-card border border-border rounded-xl p-7 shadow-soft">
            <h2 className="font-display text-xl">Brand colours</h2>
            <p className="text-sm text-muted-foreground mt-1">Used for the header band, table header, and totals on every PDF.</p>
            <div className="mt-5 grid sm:grid-cols-2 gap-5">
              <div>
                <Label>Primary colour</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary_color || "#1C382C"}
                    onChange={e => setForm({ ...form, primary_color: e.target.value })}
                    className="h-11 w-14 rounded-md border border-border cursor-pointer bg-transparent"
                  />
                  <Input value={form.primary_color || "#1C382C"} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="font-mono uppercase" />
                </div>
              </div>
              <div>
                <Label>Accent colour</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.accent_color || "#C8932B"}
                    onChange={e => setForm({ ...form, accent_color: e.target.value })}
                    className="h-11 w-14 rounded-md border border-border cursor-pointer bg-transparent"
                  />
                  <Input value={form.accent_color || "#C8932B"} onChange={e => setForm({ ...form, accent_color: e.target.value })} className="font-mono uppercase" />
                </div>
              </div>
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
                <Label>CSD number</Label>
                <Input value={form.csd_number || ""} onChange={e => setForm({ ...form, csd_number: e.target.value })} className="mt-1.5" placeholder="MAAA0893252" />
              </div>
              <div />
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
              <Label>Website</Label>
              <Input value={form.website || ""} onChange={e => setForm({ ...form, website: e.target.value })} className="mt-1.5" placeholder="www.yourcompany.co.za" />
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
