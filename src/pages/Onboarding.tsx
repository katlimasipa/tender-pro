import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(150),
  registration_number: z.string().trim().max(80).optional().or(z.literal("")),
  vat_number: z.string().trim().max(40).optional().or(z.literal("")),
  contact_email: z.string().trim().email("Valid email required").max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", registration_number: "", vat_number: "",
    contact_email: user?.email || "", contact_phone: "", address: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("companies").insert({
      owner_id: user.id,
      name: parsed.data.name,
      registration_number: parsed.data.registration_number || null,
      vat_number: parsed.data.vat_number || null,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      address: parsed.data.address || null,
    }).select().single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    await supabase.from("profiles").update({ company_id: data.id }).eq("user_id", user.id);
    toast.success("Company set up. Let's build your first tender.");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background grain">
      <div className="container max-w-2xl py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-md bg-gradient-velvet grid place-items-center">
              <FileCheck2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl">FillYourTender</span>
          </div>

          <div className="text-sm text-accent font-medium uppercase tracking-widest">Step 1 of 1</div>
          <h1 className="font-display text-4xl mt-2">Tell us about your company</h1>
          <p className="text-muted-foreground mt-2">This appears on every tender PDF you generate. You can change it anytime.</p>

          <form onSubmit={submit} className="mt-10 space-y-5 bg-card border border-border rounded-xl p-8 shadow-soft">
            <div>
              <Label>Company name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5" placeholder="Mthembu Construction (Pty) Ltd" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Registration number</Label>
                <Input value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} className="mt-1.5" placeholder="2019/123456/07" />
              </div>
              <div>
                <Label>VAT number</Label>
                <Input value={form.vat_number} onChange={e => setForm({ ...form, vat_number: e.target.value })} className="mt-1.5" placeholder="4123456789" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Contact email</Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Contact phone</Label>
                <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="mt-1.5" placeholder="+27 21 555 0100" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1.5" rows={3} placeholder="123 Long Street, Cape Town, 8001" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90">
              {loading ? "Saving…" : "Continue to dashboard"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
