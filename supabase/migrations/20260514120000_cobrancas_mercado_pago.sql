CREATE TABLE IF NOT EXISTS public.consultoria_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.consultoria_clientes(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  razao text NOT NULL,
  descricao text,
  metodos_pagamento text[] NOT NULL DEFAULT ARRAY['pix','credit_card','bolbradesco']::text[],
  status text NOT NULL DEFAULT 'pendente',
  mp_preference_id text,
  mp_init_point text,
  mp_payment_id text,
  whatsapp_enviado boolean NOT NULL DEFAULT false,
  whatsapp_enviado_em timestamptz,
  pago_em timestamptz,
  expira_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON public.consultoria_cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON public.consultoria_cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_created ON public.consultoria_cobrancas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cobrancas_mp_preference ON public.consultoria_cobrancas(mp_preference_id);

ALTER TABLE public.consultoria_cobrancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobrancas_select_authenticated" ON public.consultoria_cobrancas;
CREATE POLICY "cobrancas_select_authenticated" ON public.consultoria_cobrancas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cobrancas_insert_authenticated" ON public.consultoria_cobrancas;
CREATE POLICY "cobrancas_insert_authenticated" ON public.consultoria_cobrancas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cobrancas_update_authenticated" ON public.consultoria_cobrancas;
CREATE POLICY "cobrancas_update_authenticated" ON public.consultoria_cobrancas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cobrancas_delete_authenticated" ON public.consultoria_cobrancas;
CREATE POLICY "cobrancas_delete_authenticated" ON public.consultoria_cobrancas
  FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.tg_cobrancas_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobrancas_updated_at ON public.consultoria_cobrancas;
CREATE TRIGGER trg_cobrancas_updated_at
  BEFORE UPDATE ON public.consultoria_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.tg_cobrancas_updated_at();
