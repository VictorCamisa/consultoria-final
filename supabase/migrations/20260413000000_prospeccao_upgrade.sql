-- Feedback loop: rastrear se lead virou cliente
ALTER TABLE public.consultoria_prospects
ADD COLUMN IF NOT EXISTS converted boolean DEFAULT NULL;

COMMENT ON COLUMN public.consultoria_prospects.converted IS
  'NULL = não avaliado, TRUE = virou cliente, FALSE = perdido definitivamente';

-- Índices de performance ausentes
CREATE INDEX IF NOT EXISTS idx_leads_raw_status ON public.leads_raw(status);
CREATE INDEX IF NOT EXISTS idx_leads_raw_phone ON public.leads_raw(phone);
CREATE INDEX IF NOT EXISTS idx_leads_raw_email ON public.leads_raw(email);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.consultoria_prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_converted ON public.consultoria_prospects(converted);
CREATE INDEX IF NOT EXISTS idx_prospects_icp ON public.consultoria_prospects(icp_score DESC NULLS LAST);
