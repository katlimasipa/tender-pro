import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { FileCheck2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }).max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  displayName: z.string().trim().min(1, "Name required").max(80).optional(),
});

const AuthPage = () => {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user, navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome aboard.");
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left — brand panel */}
      <div className="hidden lg:flex relative bg-gradient-velvet text-primary-foreground p-12 flex-col justify-between overflow-hidden grain">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="h-8 w-8 rounded-md bg-accent grid place-items-center">
            <FileCheck2 className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="font-display text-xl">Tender Desk</span>
        </Link>
        <div className="relative z-10">
          <h2 className="font-display text-5xl leading-tight text-balance">
            "Cut my tender prep from <em className="text-accent not-italic">two hours to twelve minutes.</em>"
          </h2>
          <p className="mt-6 text-primary-foreground/70 max-w-md">
            — Thandi M., Procurement Manager, Cape Town
          </p>
        </div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-8">
            <ArrowLeft className="h-3 w-3" /> Back home
          </Link>
          <h1 className="font-display text-4xl">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="text-muted-foreground mt-2">
            {mode === "signup" ? "Start building tender documents in minutes." : "Sign in to continue your tenders."}
          </p>

          <form onSubmit={handle} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Thandi Mthembu" className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.co.za" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90">
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground text-center">
            {mode === "signup" ? (
              <>Already have an account? <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">Sign in</button></>
            ) : (
              <>New here? <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">Create an account</button></>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
