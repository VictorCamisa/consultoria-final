-- Projetos/Entregas vinculados a clientes
CREATE TABLE public.consultoria_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.consultoria_clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'entrega',
  status text NOT NULL DEFAULT 'nao_iniciado',
  responsavel text DEFAULT 'victor',
  data_inicio timestamp with time zone,
  data_previsao timestamp with time zone,
  data_conclusao timestamp with time zone,
  prioridade text DEFAULT 'media',
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.consultoria_projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados" ON public.consultoria_projetos FOR ALL TO public USING (auth.role() = 'authenticated');

-- Tarefas vinculadas a projetos
CREATE TABLE public.consultoria_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.consultoria_projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'pendente',
  responsavel text DEFAULT 'victor',
  prazo timestamp with time zone,
  concluida_em timestamp with time zone,
  prioridade text DEFAULT 'media',
  ordem integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.consultoria_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados" ON public.consultoria_tarefas FOR ALL TO public USING (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at_projetos BEFORE UPDATE ON public.consultoria_projetos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_tarefas BEFORE UPDATE ON public.consultoria_tarefas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();