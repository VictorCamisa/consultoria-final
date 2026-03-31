
-- Company profiles for "Meu Vendedor"
CREATE TABLE public.vendedor_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  segment text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  target_audience text NOT NULL DEFAULT '',
  tone_of_voice text NOT NULL DEFAULT 'profissional',
  products_services text NOT NULL DEFAULT '',
  differentials text NOT NULL DEFAULT '',
  common_objections text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendedor_company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access" ON public.vendedor_company_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI scenarios
CREATE TABLE public.vendedor_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.vendedor_company_profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  customer_persona text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medio',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendedor_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_via_profile" ON public.vendedor_scenarios FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendedor_company_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendedor_company_profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER set_vendedor_company_profiles_updated_at
  BEFORE UPDATE ON public.vendedor_company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
