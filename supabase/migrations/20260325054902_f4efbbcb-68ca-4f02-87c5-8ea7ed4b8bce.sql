
-- Tabela de leads prospectados (adaptada do VS SALES, sem org_id)
CREATE TABLE public.leads_raw (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text,
  phone text,
  email text,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  tags text[] DEFAULT '{}',
  enrichment_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.leads_raw
  FOR ALL TO public
  USING (auth.role() = 'authenticated');

-- Tabela para rastrear instâncias Evolution API
CREATE TABLE public.evolution_instances (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  instance_name text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  state text DEFAULT 'unknown',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.evolution_instances
  FOR ALL TO public
  USING (auth.role() = 'authenticated');
