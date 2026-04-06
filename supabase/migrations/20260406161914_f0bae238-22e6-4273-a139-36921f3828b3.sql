
-- Etapa 2: Máquina de Estados
CREATE TABLE public.prospect_execution_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.consultoria_prospects(id) ON DELETE CASCADE,
  current_step text NOT NULL DEFAULT 'research',
  completed_steps text[] NOT NULL DEFAULT '{}',
  context_snapshot jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prospect_id)
);

ALTER TABLE public.prospect_execution_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados" ON public.prospect_execution_state FOR ALL USING (auth.role() = 'authenticated');

-- Etapa 4: Session Memory
CREATE TABLE public.prospect_session_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.consultoria_prospects(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.5,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  source_message_id text
);

ALTER TABLE public.prospect_session_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados" ON public.prospect_session_memory FOR ALL USING (auth.role() = 'authenticated');
CREATE INDEX idx_session_memory_prospect ON public.prospect_session_memory(prospect_id);

-- Etapa 5: MEDDIC
CREATE TABLE public.prospect_meddic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.consultoria_prospects(id) ON DELETE CASCADE,
  pilar text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  evidencia_citacao text,
  confianca numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prospect_id, pilar)
);

ALTER TABLE public.prospect_meddic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados" ON public.prospect_meddic FOR ALL USING (auth.role() = 'authenticated');
CREATE INDEX idx_meddic_prospect ON public.prospect_meddic(prospect_id);

-- Etapa 7: HITL - Add handoff fields to prospects
ALTER TABLE public.consultoria_prospects 
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz;
