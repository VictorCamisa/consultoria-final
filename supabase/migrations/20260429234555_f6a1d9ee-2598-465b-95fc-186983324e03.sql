-- Add missing columns to consultoria_clientes
ALTER TABLE public.consultoria_clientes
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS segmento text,
  ADD COLUMN IF NOT EXISTS produto_vs text DEFAULT 'departamentos',
  ADD COLUMN IF NOT EXISTS data_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS data_prev_entrega timestamptz,
  ADD COLUMN IF NOT EXISTS obs_contrato text,
  ADD COLUMN IF NOT EXISTS obs_internas text,
  ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS proximo_checkin timestamptz,
  ADD COLUMN IF NOT EXISTS nps integer,
  ADD COLUMN IF NOT EXISTS potencial_upsell text DEFAULT 'medio',
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS origem_prospect_id uuid;

-- Allow data_fechamento nullable (legacy clients)
ALTER TABLE public.consultoria_clientes ALTER COLUMN data_fechamento DROP NOT NULL;

-- Create vs_produtos table
CREATE TABLE IF NOT EXISTS public.vs_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'geral',
  tipo text NOT NULL DEFAULT 'servico',
  preco numeric DEFAULT 0,
  nichos text[] DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vs_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.vs_produtos
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER vs_produtos_set_updated_at
  BEFORE UPDATE ON public.vs_produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();