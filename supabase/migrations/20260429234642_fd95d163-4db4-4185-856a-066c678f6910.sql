ALTER TABLE public.consultoria_clientes
  ADD COLUMN IF NOT EXISTS descricao_negocio text,
  ADD COLUMN IF NOT EXISTS dores_mapeadas text,
  ADD COLUMN IF NOT EXISTS sistemas_atuais text,
  ADD COLUMN IF NOT EXISTS equipe_info text,
  ADD COLUMN IF NOT EXISTS faturamento_est text,
  ADD COLUMN IF NOT EXISTS historico text,
  ADD COLUMN IF NOT EXISTS resultados text,
  ADD COLUMN IF NOT EXISTS metricas_antes_depois text,
  ADD COLUMN IF NOT EXISTS depoimento text;