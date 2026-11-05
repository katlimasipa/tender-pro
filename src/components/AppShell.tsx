import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Building2, LogOut, Plus, Menu, X, Printer } from "lucide-react";
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

  const isActive = (to: string) =>
    loc.pathname === to || (to !== "/dashboard" && loc.pathname.startsWith(to));

  const RailBody = (
    <>
      <div className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-soft">
        <Printer className="h-5 w-5" />
      </div>

      <Button
        onClick={() => { setOpen(false); navigate("/tenders/new"); }}
        size="icon"
        className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft"
        title="New Tender"
        aria-label="New Tender"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <div className="h-px w-8 bg-sidebar-border my-1" />

      <nav className="flex flex-col items-center gap-2">
        {nav.map(item => {
          const active = isActive(item.to);
          return (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "h-11 w-11 rounded-2xl grid place-items-center transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Button variant="ghost" size="icon"
          onClick={async () => { await signOut(); navigate("/"); }}
          title="Sign out"
          aria-label="Sign out"
          className="h-11 w-11 rounded-2xl text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/70"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </>
  );

  const DrawerBody = (
    <>
      <div className="flex items-center px-6 h-16 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
          <Printer className="h-5 w-5" />
        </div>
        <span className="ml-3 font-display text-lg">Tender Desk</span>
      </div>

      <div className="p-4">
        <Button onClick={() => { setOpen(false); navigate("/tenders/new"); }}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1.5" /> New Tender
        </Button>
      </div>

      <nav className="px-3 flex-1 space-y-1">
        {nav.map(item => {
          const active = isActive(item.to);
          return (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="px-2 pb-3">
          <div className="text-xs text-sidebar-foreground/60">Signed in</div>
          <div className="text-sm truncate">{user?.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/70">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 border-b border-border/70 bg-background/80 backdrop-blur">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <Printer className="h-4 w-4" />
          </div>
          <span className="font-display text-lg">Tender Desk</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Desktop floating icon rail */}
      <aside className="hidden md:flex fixed left-5 top-1/2 -translate-y-1/2 z-40 w-[76px] flex-col items-center gap-3 rounded-3xl bg-card border border-sidebar-border shadow-elevated py-4 px-2.5">
        {RailBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-primary/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85%] bg-card text-sidebar-foreground flex flex-col border-r border-sidebar-border shadow-elevated animate-in slide-in-from-left duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-sidebar-accent"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {DrawerBody}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 md:pl-[104px]">
        {/* Desktop top bar with pill tabs */}
        <header className="hidden md:flex items-center justify-between gap-4 px-8 pt-5">
          <div className="w-40" />
          <nav className="flex items-center gap-1 rounded-full bg-card border border-border/70 shadow-soft p-1.5">
            {nav.map(item => {
              const active = isActive(item.to);
              return (
                <Link key={item.to} to={item.to}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-foreground/70 hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="w-40 flex justify-end">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gradient-blush border border-border/60 grid place-items-center text-xs font-bold text-foreground shrink-0">
                {(user?.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[7rem]" title={user?.email}>
                {user?.email}
              </div>
            </div>
          </div>
        </header>

        <main className="pb-[env(safe-area-inset-bottom)]">
          {children}
          <footer className="py-6 text-center text-xs text-muted-foreground">
            Built by{" "}
            <a
              href="https://architeq.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium hover:text-accent transition"
            >
              Architeq Web Agency
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
