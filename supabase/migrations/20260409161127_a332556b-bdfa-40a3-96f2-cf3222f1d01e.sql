
CREATE TABLE public.prospect_notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.consultoria_prospects(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota',
  autor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.prospect_notas
  FOR ALL TO public
  USING (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prospect_notas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
