import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a copy of an existing tender owned by the current user.
 * Returns the new tender id.
 */
export async function duplicateTender(id: string): Promise<string> {
  const { data, error } = await supabase.from("tenders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Document not found");

  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    share_token: _s,
    title,
    ...rest
  } = data as any;

  const { data: inserted, error: insErr } = await supabase
    .from("tenders")
    .insert({ ...rest, title: `${title} (copy)`, status: "draft" })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return inserted.id;
}
