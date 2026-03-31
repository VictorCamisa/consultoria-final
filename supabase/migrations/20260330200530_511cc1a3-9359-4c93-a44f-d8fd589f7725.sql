
CREATE TABLE public.vendedor_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.vendedor_company_profiles(id) ON DELETE CASCADE,
  scenario_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'geral',
  title text NOT NULL,
  content text NOT NULL,
  source_evaluation jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendedor_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON public.vendedor_knowledge
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
