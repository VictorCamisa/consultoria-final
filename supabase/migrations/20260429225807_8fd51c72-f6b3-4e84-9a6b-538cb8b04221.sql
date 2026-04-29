ALTER TABLE public.consultoria_clientes 
  ADD COLUMN IF NOT EXISTS github_url text,
  ADD COLUMN IF NOT EXISTS projeto_legado text,
  ADD COLUMN IF NOT EXISTS legado boolean NOT NULL DEFAULT false;