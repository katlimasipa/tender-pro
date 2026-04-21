
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_number TEXT,
  vat_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  letterhead_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their company"
  ON public.companies FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert their company"
  ON public.companies FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their company"
  ON public.companies FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their company"
  ON public.companies FOR DELETE USING (auth.uid() = owner_id);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tenders
CREATE TABLE public.tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  tender_number TEXT,
  client_name TEXT,
  client_address TEXT,
  notes TEXT,
  vat_inclusive BOOLEAN NOT NULL DEFAULT false,
  vat_rate NUMERIC NOT NULL DEFAULT 15,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenders"
  ON public.tenders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tenders"
  ON public.tenders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tenders"
  ON public.tenders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tenders"
  ON public.tenders FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenders_updated_at BEFORE UPDATE ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for letterheads
INSERT INTO storage.buckets (id, name, public) VALUES ('letterheads', 'letterheads', false);

CREATE POLICY "Users can view their own letterheads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own letterheads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own letterheads"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own letterheads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'letterheads' AND auth.uid()::text = (storage.foldername(name))[1]);
