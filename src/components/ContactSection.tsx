import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255),
  message: z.string().trim().min(1, "Message is required").max(2000, "Message must be under 2000 characters"),
});

const ContactSection = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      parsed.error.errors.forEach((err) => {
        const key = err.path[0] as keyof typeof form;
        if (key) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const { name, email, message } = parsed.data;
    const { error } = await supabase.from("contact_messages").insert([{ name, email, message }]);
    setSubmitting(false);

    if (error) {
      toast({
        title: "Couldn't send your message",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Message sent",
      description: "Thanks for reaching out — we'll be in touch shortly.",
    });
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <section id="contact" className="border-t border-border bg-background">
      <div className="container py-16 sm:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-sm text-accent font-medium uppercase tracking-widest">Get in touch</div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold mt-3 text-balance">
            Questions? <span className="italic text-primary">Let's talk.</span>
          </h2>
          <p className="text-muted-foreground mt-6 text-lg leading-relaxed max-w-md">
            Whether you're after a demo, custom onboarding, or just have a question about
            tenders — drop us a line and we'll get back to you within one business day.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 text-accent" />
            South African business hours · Mon–Fri
          </div>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-elevated space-y-5"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Thandi Nkosi"
              maxLength={100}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="[email protected]"
              maxLength={255}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Tell us a little about what you're looking for…"
              rows={5}
              maxLength={2000}
              aria-invalid={!!errors.message}
            />
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 h-12"
          >
            {submitting ? "Sending…" : (<>Send message <Send className="ml-2 h-4 w-4" /></>)}
          </Button>
        </motion.form>
      </div>
    </section>
  );
};

export default ContactSection;
