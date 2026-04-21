import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, TrendingUp, Receipt, ArrowRight, Building2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/useCompany";
import { formatZAR, formatDate } from "@/lib/format";

interface TenderRow {
  id: string; title: string; tender_number: string | null;
  grand_total: number; status: string; created_at: string; client_name: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("tenders").select("id,title,tender_number,grand_total,status,created_at,client_name")
      .eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      setTenders((data as TenderRow[]) || []);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!companyLoading && !company) navigate("/onboarding");
  }, [company, companyLoading, navigate]);

  const totalValue = tenders.reduce((s, t) => s + Number(t.grand_total), 0);
  const recent = tenders.slice(0, 5);

  return (
    <AppShell>
      <div className="p-8 md:p-12 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Welcome back</div>
              <h1 className="font-display text-4xl mt-1">{company?.name || "Your dashboard"}</h1>
            </div>
            <Button onClick={() => navigate("/tenders/new")} className="bg-primary hover:bg-primary/90 shadow-elevated">
              <Plus className="h-4 w-4 mr-1.5" /> Create New Tender
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              { label: "Total tenders", value: tenders.length, icon: FileText },
              { label: "Total value quoted", value: formatZAR(totalValue), icon: TrendingUp },
              { label: "Drafts", value: tenders.filter(t => t.status === "draft").length, icon: Receipt },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <s.icon className="h-4 w-4 text-accent" />
                </div>
                <div className="font-display text-3xl mt-3 tabular-nums">{s.value}</div>
              </motion.div>
            ))}
          </div>

          {/* Recent */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-2xl">Recent tenders</h2>
              <Link to="/tenders" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="text-muted-foreground py-12">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="font-display text-xl mt-4">No tenders yet</h3>
                <p className="text-muted-foreground mt-1">Create your first tender to get started.</p>
                <Button onClick={() => navigate("/tenders/new")} className="mt-6 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-1.5" /> Create your first tender
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-soft">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-muted-foreground text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">Title</th>
                      <th className="px-5 py-3 font-medium">Client</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(t => (
                      <tr key={t.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/tenders/${t.id}`)}>
                        <td className="px-5 py-4">
                          <div className="font-medium">{t.title}</div>
                          {t.tender_number && <div className="text-xs text-muted-foreground">{t.tender_number}</div>}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{t.client_name || "—"}</td>
                        <td className="px-5 py-4 text-muted-foreground">{formatDate(t.created_at)}</td>
                        <td className="px-5 py-4 text-right tabular-nums font-medium">{formatZAR(Number(t.grand_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="mt-12 grid md:grid-cols-2 gap-5">
            <Link to="/company" className="group bg-gradient-velvet text-primary-foreground rounded-xl p-7 flex items-center justify-between hover:shadow-elevated transition">
              <div>
                <Building2 className="h-5 w-5 text-accent" />
                <div className="font-display text-xl mt-3">Company profile</div>
                <div className="text-primary-foreground/70 text-sm mt-1">Update letterhead, VAT, contact details.</div>
              </div>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition" />
            </Link>
            <Link to="/tenders/new" className="group bg-card border border-border rounded-xl p-7 flex items-center justify-between hover:shadow-elevated transition">
              <div>
                <Plus className="h-5 w-5 text-accent" />
                <div className="font-display text-xl mt-3">New tender</div>
                <div className="text-muted-foreground text-sm mt-1">Build a fresh quote or tender submission.</div>
              </div>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition" />
            </Link>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
