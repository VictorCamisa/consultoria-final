-- vs_produtos: catálogo de produtos/serviços VS
CREATE TABLE IF NOT EXISTS vs_produtos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome         TEXT NOT NULL,
  descricao    TEXT,
  categoria    TEXT NOT NULL DEFAULT 'servico',  -- 'servico' | 'produto'
  tipo         TEXT NOT NULL DEFAULT 'recorrente', -- 'unico' | 'recorrente'
  preco_min    NUMERIC(10,2),
  preco_max    NUMERIC(10,2),
  preco_fixo   NUMERIC(10,2),
  nichos       TEXT[] DEFAULT '{}',
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  destaque     BOOLEAN NOT NULL DEFAULT FALSE,
  ordem        INTEGER NOT NULL DEFAULT 0,
  obs          TEXT
);

ALTER TABLE vs_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vs_produtos"
  ON vs_produtos FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_vs_produtos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vs_produtos_updated_at ON vs_produtos;
CREATE TRIGGER trg_vs_produtos_updated_at
  BEFORE UPDATE ON vs_produtos
  FOR EACH ROW EXECUTE FUNCTION update_vs_produtos_updated_at();

-- Produtos iniciais VS
INSERT INTO vs_produtos (nome, descricao, categoria, tipo, preco_min, preco_max, nichos, destaque, ordem) VALUES
  ('Diagnóstico Estratégico',   'Imersão + Diagnóstico completo do negócio: mapeamento de processos, gargalos e oportunidades de IA',    'servico', 'unico',      2500, 4500,  '{}', false, 1),
  ('Ecossistema IA — Estética', 'Automação completa para clínicas de estética: atendimento, agendamento e follow-up via IA',             'servico', 'recorrente', 1200, 1800,  '{"Estética"}', true, 2),
  ('VS AUTO',                   'Ecossistema IA para revendas: qualificação de leads, atendimento 24h e integração com portais de venda', 'servico', 'recorrente', 1497, 3500,  '{"Revendas"}', true, 3),
  ('Ecossistema IA — Odonto',   'Automação para clínicas odontológicas: confirmação de consultas, reativação e NPS automático',          'servico', 'recorrente', 1200, 2000,  '{"Odonto"}', true, 4),
  ('Ecossistema IA — Advocacia','Automação para escritórios de advocacia: triagem de clientes, agendamentos e follow-up processual',     'servico', 'recorrente', 1500, 3000,  '{"Advocacia"}', true, 5),
  ('Acompanhamento Mensal',     'Relatórios, ajustes de IA, reuniões de performance e expansão de automações existentes',                'servico', 'recorrente', 500,  1200,  '{}', false, 6)
ON CONFLICT DO NOTHING;
