import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatZAR, formatDate } from "@/lib/format";
import { toast } from "sonner";

interface Row {
  id: string; title: string; tender_number: string | null;
  grand_total: number; status: string; created_at: string; client_name: string | null;
}

export default function TendersList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tenders")
      .select("id,title,tender_number,grand_total,status,created_at,client_name")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = rows.filter(r =>
    !q || r.title.toLowerCase().includes(q.toLowerCase()) ||
    (r.client_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (r.tender_number || "").toLowerCase().includes(q.toLowerCase())
  );

  const remove = async (id: string) => {
    if (!confirm("Delete this tender?")) return;
    const { error } = await supabase.from("tenders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <AppShell>
      <div className="p-8 md:p-12 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Documents</div>
              <h1 className="font-display text-4xl mt-1">Tenders</h1>
            </div>
            <Button onClick={() => navigate("/tenders/new")} className="bg-primary hover:bg-primary/90 shadow-elevated">
              <Plus className="h-4 w-4 mr-1.5" /> New Tender
            </Button>
          </div>

          <div className="mt-8 max-w-md">
            <Input placeholder="Search by title, client or number…" value={q} onChange={e => setQ(e.target.value)} />
          </div>

          {loading ? (
            <div className="mt-12 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="mt-12 bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-display text-xl mt-4">No tenders found</h3>
              <p className="text-muted-foreground mt-1">{rows.length === 0 ? "Create your first tender to get started." : "Try a different search."}</p>
              {rows.length === 0 && (
                <Button onClick={() => navigate("/tenders/new")} className="mt-6 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-1.5" /> New Tender
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-8 bg-card border border-border rounded-xl overflow-hidden shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-muted-foreground text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Title</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium text-right">Total</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-t border-border hover:bg-secondary/30 group">
                      <td className="px-5 py-4 cursor-pointer" onClick={() => navigate(`/tenders/${t.id}`)}>
                        <div className="font-medium">{t.title}</div>
                        {t.tender_number && <div className="text-xs text-muted-foreground">{t.tender_number}</div>}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground cursor-pointer" onClick={() => navigate(`/tenders/${t.id}`)}>{t.client_name || "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground cursor-pointer" onClick={() => navigate(`/tenders/${t.id}`)}>{formatDate(t.created_at)}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-medium cursor-pointer" onClick={() => navigate(`/tenders/${t.id}`)}>{formatZAR(Number(t.grand_total))}</td>
                      <td className="pr-3">
                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
