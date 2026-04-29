-- B4: Expand consultoria_clientes with full lifecycle fields
ALTER TABLE public.consultoria_clientes
  ADD COLUMN IF NOT EXISTS email              TEXT,
  ADD COLUMN IF NOT EXISTS instagram          TEXT,
  ADD COLUMN IF NOT EXISTS produto_vs         TEXT DEFAULT 'departamentos',
  ADD COLUMN IF NOT EXISTS data_inicio        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_prev_entrega  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS obs_contrato       TEXT,
  ADD COLUMN IF NOT EXISTS descricao_negocio  TEXT,
  ADD COLUMN IF NOT EXISTS dores_mapeadas     TEXT,
  ADD COLUMN IF NOT EXISTS sistemas_atuais    TEXT,
  ADD COLUMN IF NOT EXISTS equipe_info        TEXT,
  ADD COLUMN IF NOT EXISTS faturamento_est    TEXT,
  ADD COLUMN IF NOT EXISTS historico          TEXT,
  ADD COLUMN IF NOT EXISTS responsavel        TEXT DEFAULT 'victor',
  ADD COLUMN IF NOT EXISTS health_score       INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS proximo_checkin    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS obs_internas       TEXT,
  ADD COLUMN IF NOT EXISTS resultados         TEXT,
  ADD COLUMN IF NOT EXISTS metricas_antes_depois TEXT,
  ADD COLUMN IF NOT EXISTS depoimento         TEXT,
  ADD COLUMN IF NOT EXISTS nps                INTEGER,
  ADD COLUMN IF NOT EXISTS potencial_upsell   TEXT DEFAULT 'medio';

-- B2: FK para rastreabilidade de origem
ALTER TABLE public.consultoria_clientes
  ADD COLUMN IF NOT EXISTS origem_prospect_id UUID
    REFERENCES public.consultoria_prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_origem_prospect
  ON public.consultoria_clientes(origem_prospect_id);

-- B1: SLA automático em consultoria_prospects
ALTER TABLE public.consultoria_prospects
  ADD COLUMN IF NOT EXISTS sla_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_alerted    BOOLEAN DEFAULT FALSE;

-- Trigger: ao inserir prospect novo, define SLA para 72h
CREATE OR REPLACE FUNCTION set_sla_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_expires_at IS NULL THEN
    NEW.sla_expires_at := NOW() + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sla_expires_at ON public.consultoria_prospects;
CREATE TRIGGER trg_sla_expires_at
  BEFORE INSERT ON public.consultoria_prospects
  FOR EACH ROW EXECUTE FUNCTION set_sla_expires_at();

-- Trigger: resetar SLA quando status muda para ativo
CREATE OR REPLACE FUNCTION reset_sla_on_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('abordado','respondeu','quente','em_cadencia') THEN
    NEW.sla_expires_at := NOW() + INTERVAL '72 hours';
    NEW.sla_alerted := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_sla ON public.consultoria_prospects;
CREATE TRIGGER trg_reset_sla
  BEFORE UPDATE ON public.consultoria_prospects
  FOR EACH ROW EXECUTE FUNCTION reset_sla_on_contact();
