-- 1) Restrictive policies: deny all client INSERT/UPDATE/DELETE on user_roles.
-- Only the service role (which bypasses RLS) can manage roles.
CREATE POLICY "No client inserts on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "No client deletes on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);

-- 2) Harden has_role: prevent cross-user role lookups.
-- Returns false unless the caller is checking their own roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND _user_id = auth.uid()
  )
$function$;