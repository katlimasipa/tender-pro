import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Building2, LogOut, FileCheck2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tenders", label: "Tenders", icon: FileText },
  { to: "/company", label: "Company", icon: Building2 },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary grid place-items-center">
            <FileCheck2 className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display text-lg">FillYourTender</span>
        </Link>

        <div className="p-4">
          <Button onClick={() => navigate("/tenders/new")} className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 shadow-ochre">
            <Plus className="h-4 w-4 mr-1.5" /> New Tender
          </Button>
        </div>

        <nav className="px-3 flex-1 space-y-0.5">
          {nav.map(item => {
            const active = loc.pathname === item.to || (item.to !== "/dashboard" && loc.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="px-2 pb-3">
            <div className="text-xs text-sidebar-foreground/50 uppercase tracking-wider">Signed in</div>
            <div className="text-sm truncate">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
