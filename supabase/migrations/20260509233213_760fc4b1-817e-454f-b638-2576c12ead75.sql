
-- Fix: vs_users — restrict reads to own row only (by email), block writes from clients
DROP POLICY IF EXISTS "autenticados" ON public.vs_users;

CREATE POLICY "Users read own vs_users row"
ON public.vs_users
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Fix: imagery_logs — INSERT was open to public role with WITH CHECK true.
-- Restrict to authenticated (edge functions using service_role bypass RLS anyway).
DROP POLICY IF EXISTS "Service role inserts logs" ON public.imagery_logs;

CREATE POLICY "Authenticated insert imagery logs"
ON public.imagery_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.imagery_posts p
    WHERE p.id = imagery_logs.post_id AND p.user_id = auth.uid()
  )
);
