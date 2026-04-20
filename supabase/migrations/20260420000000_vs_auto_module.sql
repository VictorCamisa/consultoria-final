-- VS AUTO Module: adicionar colunas ao pipeline comercial existente

-- 1. Checklist de etapa por prospect (to-dos do playbook comercial)
ALTER TABLE public.consultoria_prospects
  ADD COLUMN IF NOT EXISTS checklist_etapa jsonb DEFAULT '[]'::jsonb;

-- 2. Dados de inteligência prévia da loja (ICP VS AUTO)
ALTER TABLE public.consultoria_prospects
  ADD COLUMN IF NOT EXISTS icp_auto_data jsonb DEFAULT '{}'::jsonb;

-- 3. MRR estimado em negociação (padrão VS AUTO = 1497)
ALTER TABLE public.consultoria_prospects
  ADD COLUMN IF NOT EXISTS mrr_estimado numeric DEFAULT 1497;

-- 4. Flag de nicho VS AUTO para filtros rápidos
ALTER TABLE public.consultoria_prospects
  ADD COLUMN IF NOT EXISTS is_vs_auto boolean DEFAULT false;

-- 5. Índices de performance
CREATE INDEX IF NOT EXISTS idx_prospects_is_vs_auto
  ON public.consultoria_prospects(is_vs_auto)
  WHERE is_vs_auto = true;

CREATE INDEX IF NOT EXISTS idx_prospects_nicho_status
  ON public.consultoria_prospects(nicho, status);

COMMENT ON COLUMN public.consultoria_prospects.checklist_etapa IS
  'Array de objetos {id, label, done, stage} representando o checklist do playbook comercial VS AUTO';

COMMENT ON COLUMN public.consultoria_prospects.icp_auto_data IS
  'Dados de inteligência prévia: {estoque, portais, instagram_ativo, tem_site, sistema_atual, score_pontos}';

COMMENT ON COLUMN public.consultoria_prospects.mrr_estimado IS
  'MRR mensal estimado da oportunidade em R$. Padrão VS AUTO = 1497';
