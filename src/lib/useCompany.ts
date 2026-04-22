import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  registration_number: string | null;
  vat_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  letterhead_url: string | null;
  website: string | null;
  logo_url: string | null;
  signature_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  csd_number: string | null;
}

export function useCompany() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle();
    setCompany(data as Company | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { company, loading, refresh };
}
