
CREATE TABLE public.vs_ideias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'produto', -- produto | comercial | marketing | processo | tech
  modulo text, -- comercial | gatekeeper | onboarding | telemetria | financeiro | governanca | outro
  autor text NOT NULL DEFAULT 'victor', -- victor | danilo | outro
  status text NOT NULL DEFAULT 'captura', -- captura | analise | priorizada | em_execucao | entregue | arquivada
  impacto integer NOT NULL DEFAULT 3 CHECK (impacto BETWEEN 1 AND 5),
  esforco integer NOT NULL DEFAULT 3 CHECK (esforco BETWEEN 1 AND 5),
  score numeric GENERATED ALWAYS AS (impacto::numeric / NULLIF(esforco, 0)::numeric) STORED,
  tags text[] DEFAULT '{}'::text[],
  link_origem text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vs_ideias_status ON public.vs_ideias(status);
CREATE INDEX idx_vs_ideias_categoria ON public.vs_ideias(categoria);
CREATE INDEX idx_vs_ideias_modulo ON public.vs_ideias(modulo);

ALTER TABLE public.vs_ideias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.vs_ideias
  FOR ALL TO public
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Trigger updated_at usando a função existente set_updated_at()
CREATE TRIGGER vs_ideias_set_updated_at
  BEFORE UPDATE ON public.vs_ideias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
