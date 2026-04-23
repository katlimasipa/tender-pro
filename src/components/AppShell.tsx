import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Building2, LogOut, FileCheck2, Plus, Menu, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  const SidebarBody = (
    <>
      <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-md bg-sidebar-primary grid place-items-center">
          <FileCheck2 className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-display text-lg">FillYourTender</span>
      </Link>

      <div className="p-4">
        <Button onClick={() => { setOpen(false); navigate("/tenders/new"); }} className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 shadow-ochre">
          <Plus className="h-4 w-4 mr-1.5" /> New Tender
        </Button>
      </div>

      <nav className="px-3 flex-1 space-y-0.5">
        {nav.map(item => {
          const active = loc.pathname === item.to || (item.to !== "/dashboard" && loc.pathname.startsWith(item.to));
          return (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-background/90 backdrop-blur">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary grid place-items-center">
            <FileCheck2 className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-base">FillYourTender</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85%] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-md hover:bg-sidebar-accent/60"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarBody}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
