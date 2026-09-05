ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

CREATE OR REPLACE FUNCTION public.get_shared_tender(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tender', to_jsonb(t) - 'user_id' - 'share_token',
    'company', to_jsonb(c) - 'owner_id'
  )
  FROM public.tenders t
  LEFT JOIN public.companies c ON c.id = t.company_id
  WHERE t.share_token = p_token AND p_token IS NOT NULL AND length(p_token) > 10
$$;

CREATE OR REPLACE FUNCTION public.save_shared_tender(
  p_token text,
  p_title text,
  p_client_name text,
  p_client_address text,
  p_notes text,
  p_items jsonb,
  p_vat_rate numeric,
  p_vat_inclusive boolean,
  p_subtotal numeric,
  p_vat_amount numeric,
  p_grand_total numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN
    RETURN false;
  END IF;
  UPDATE public.tenders SET
    title = COALESCE(NULLIF(btrim(p_title), ''), title),
    client_name = p_client_name,
    client_address = p_client_address,
    notes = p_notes,
    items = p_items,
    vat_rate = p_vat_rate,
    vat_inclusive = p_vat_inclusive,
    subtotal = p_subtotal,
    vat_amount = p_vat_amount,
    grand_total = p_grand_total,
    updated_at = now()
  WHERE share_token = p_token;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_tender(text) FROM public;
REVOKE ALL ON FUNCTION public.save_shared_tender(text, text, text, text, text, jsonb, numeric, boolean, numeric, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_tender(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_shared_tender(text, text, text, text, text, jsonb, numeric, boolean, numeric, numeric, numeric) TO anon, authenticated, service_role;