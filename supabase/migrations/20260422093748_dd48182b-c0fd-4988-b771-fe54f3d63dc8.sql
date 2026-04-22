ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS quotation_ref text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS csd_number text;