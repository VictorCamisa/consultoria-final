
ALTER TABLE public.vs_produtos
  ADD COLUMN IF NOT EXISTS preco_min numeric,
  ADD COLUMN IF NOT EXISTS preco_max numeric,
  ADD COLUMN IF NOT EXISTS preco_fixo numeric,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS obs text;

INSERT INTO public.vs_produtos
  (nome, descricao, categoria, tipo, preco_min, preco_max, preco_fixo, tier, destaque, ordem, ativo, nichos)
VALUES
  (
    'VS Tools',
    'Microferramentas pontuais (qualificador, follow-up automatizado, calculadora de ROI). Porta de entrada da esteira VS — entrega rápida, baixa fricção.',
    'servico', 'recorrente',
    89, 397, NULL,
    'vs_tools', false, 1, true,
    ARRAY['Estética','Odonto','Advocacia','VS AUTO']
  ),
  (
    'VS Departamentos',
    'Substitui UM departamento da empresa (comercial OU atendimento OU pré-venda) com IA + processo. Gatekeeper responde em <1min, 98,9% assertividade.',
    'servico', 'recorrente',
    NULL, 3000, NULL,
    'departamentos', false, 2, true,
    ARRAY['Estética','Odonto','Advocacia','VS AUTO']
  ),
  (
    'VS 360',
    'Operação comercial completa terceirizada: pipeline + prospecção + IA + dashboards + acompanhamento semanal do time VS. Para quem quer dominar o nicho.',
    'servico', 'recorrente',
    NULL, 12000, NULL,
    'vs_360', true, 3, true,
    ARRAY['Estética','Odonto','Advocacia','VS AUTO']
  ),
  (
    'VS Custom',
    'Projeto sob medida high-ticket. Setup + operação dedicada para empresa que quer arquitetura proprietária e domínio total do nicho. Escopo e investimento sob consulta.',
    'servico', 'unico',
    NULL, NULL, NULL,
    'vs_custom', false, 4, true,
    ARRAY['Estética','Odonto','Advocacia','VS AUTO']
  );
