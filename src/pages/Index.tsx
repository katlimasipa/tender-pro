import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Calculator, Sparkles, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/tender-desk-logo.svg";
import ContactSection from "@/components/ContactSection";

const features = [
  { icon: Calculator, title: "ZAR & VAT, sorted", desc: "Automatic 15% VAT, inclusive or exclusive. Currency formatted in Rands. No spreadsheets." },
  { icon: FileText, title: "Print-ready PDFs", desc: "A4, government-tender ready. Your letterhead, your branding, every time." },
  { icon: Building2, title: "Built for SA workflows", desc: "Reg numbers, VAT numbers, compliance details — designed for South African business." },
  { icon: ShieldCheck, title: "Your data, secure", desc: "Bank-grade authentication. Your tenders only visible to you and your team." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background grain">
      {/* Nav */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between gap-2">
          <Link to="/" className="flex items-center shrink-0">
            <img src={logo} alt="Tender Desk" className="h-8 sm:h-9 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#contact" className="hover:text-foreground transition">Contact</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Button asChild variant="ghost" size="sm" className="hidden xs:inline-flex sm:inline-flex"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90"><Link to="/auth?mode=signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-paper opacity-60 pointer-events-none" />
        <div className="container relative py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-accent" /> Built in South Africa, for South African businesses
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[0.95] text-balance">
              Tender documents,<br/>
              <span className="italic text-primary">beautifully</span> done.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty">
              Stop wrestling with Excel. Tender Desk turns your line items into compliant,
              branded PDFs — VAT, totals, and letterheads handled automatically.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 shadow-elevated h-12 px-6">
                <Link to="/auth?mode=signup">Start creating tenders <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                <Link to="/auth">Generate your first PDF</Link>
              </Button>
            </div>
          </motion.div>

          {/* Decorative document mock */}
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }}
            className="mt-20 mx-auto max-w-4xl"
          >
            <div className="relative rounded-xl bg-card shadow-elevated border border-border overflow-hidden">
              <div className="bg-gradient-velvet px-8 py-5 flex items-center justify-between text-primary-foreground">
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-70">Tender</div>
                  <div className="font-display text-xl">Mthembu Construction (Pty) Ltd</div>
                </div>
                <div className="text-right text-xs opacity-80">
                  <div>TEN-2026-0142</div>
                  <div>21 Apr 2026</div>
                </div>
              </div>
              <div className="p-8">
                <table className="w-full text-sm">
                  <thead className="text-left border-b border-border">
                    <tr className="text-muted-foreground"><th className="py-2 font-medium">No.</th><th className="font-medium">Product</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Unit</th><th className="text-right font-medium">Total</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ["1", "Reinforced concrete supply (40MPa)", "120", "R 1,850.00", "R 222,000.00"],
                      ["2", "Site preparation & excavation", "1", "R 48,500.00", "R 48,500.00"],
                      ["3", "Steel rebar — Y12 grade", "850", "R 92.40", "R 78,540.00"],
                    ].map(r => (
                      <tr key={r[0]} className="border-b border-border/50">
                        {r.map((c, i) => <td key={i} className={`py-3 ${i >= 2 ? "text-right tabular-nums" : ""}`}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-6 flex justify-end">
                  <div className="w-72 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">R 349,040.00</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>VAT (15%)</span><span className="tabular-nums">R 52,356.00</span></div>
                    <div className="flex justify-between font-display text-lg pt-2 border-t border-primary"><span>Grand Total</span><span className="tabular-nums">R 401,396.00</span></div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24 border-t border-border">
        <div className="max-w-2xl">
          <div className="text-sm text-accent font-medium uppercase tracking-widest">Why Tender Desk</div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold mt-3 text-balance">Less paperwork. More winning bids.</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-8 hover:bg-secondary/40 transition">
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="font-display text-xl mt-4">{f.title}</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-secondary/40 border-y border-border">
        <div className="container py-24">
          <h2 className="font-display text-4xl md:text-5xl font-semibold max-w-2xl text-balance">Three steps. One polished tender.</h2>
          <div className="mt-14 grid md:grid-cols-3 gap-8">
            {[
              { n: "01", t: "Set up your company", d: "Add your registration, VAT number, and upload your letterhead — once." },
              { n: "02", t: "Build your tender", d: "Add line items. Watch totals and VAT calculate in real time." },
              { n: "03", t: "Export & send", d: "One click for a print-ready, branded PDF. Saved to your dashboard." },
            ].map((s) => (
              <div key={s.n}>
                <div className="font-display text-6xl text-accent">{s.n}</div>
                <div className="font-display text-2xl mt-2">{s.t}</div>
                <p className="text-muted-foreground mt-2 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-sm text-accent font-medium uppercase tracking-widest">Pricing</div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold mt-3">Start free. Scale when you're ready.</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { name: "Free", price: "R0", per: "forever", features: ["3 tenders / month", "PDF export", "1 letterhead"], cta: "Start free" },
            { name: "Pro", price: "R249", per: "per month", features: ["Unlimited tenders", "Templates library", "Priority support"], cta: "Go Pro", featured: true },
            { name: "Enterprise", price: "Custom", per: "talk to us", features: ["Multi-user team", "Custom compliance presets", "Dedicated onboarding"], cta: "Contact sales" },
          ].map((p) => (
            <div key={p.name} className={`rounded-xl border p-8 ${p.featured ? "border-primary bg-card shadow-elevated" : "border-border bg-card/60"}`}>
              {p.featured && <div className="text-xs text-accent font-medium uppercase tracking-widest mb-2">Most popular</div>}
              <div className="font-display text-2xl">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl">{p.price}</span>
                <span className="text-muted-foreground text-sm">/ {p.per}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map(ft => <li key={ft} className="flex gap-2"><span className="text-accent">✓</span>{ft}</li>)}
              </ul>
              <Button asChild className={`mt-6 w-full ${p.featured ? "bg-primary hover:bg-primary/90" : ""}`} variant={p.featured ? "default" : "outline"}>
                <Link to="/auth?mode=signup">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <ContactSection />

      <footer className="border-t border-border bg-secondary/30">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Tender Desk" className="h-6 w-auto" />
            <span>· Made in South Africa</span>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center">
            <div>© {new Date().getFullYear()} Tender Desk. All rights reserved.</div>
            <div>
              Built by{" "}
              <a
                href="https://architeq.co.za"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium hover:text-accent transition"
              >
                Architeq Web Agency
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
