-- Tabela principal de posts gerados
CREATE TABLE public.imagery_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('carrossel','feed_unico','story','reels_cover')),
  tema TEXT NOT NULL,
  nicho TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  n_slides INT NOT NULL DEFAULT 5,
  copy_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planning','generating','ready','failed')),
  error_message TEXT,
  custo_total_usd NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imagery_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own imagery posts"
  ON public.imagery_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own imagery posts"
  ON public.imagery_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own imagery posts"
  ON public.imagery_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own imagery posts"
  ON public.imagery_posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER imagery_posts_updated_at
  BEFORE UPDATE ON public.imagery_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Slides individuais
CREATE TABLE public.imagery_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.imagery_posts(id) ON DELETE CASCADE,
  slide_n INT NOT NULL,
  template_id TEXT NOT NULL,
  needs_image BOOLEAN NOT NULL DEFAULT true,
  image_brief TEXT,
  image_type TEXT CHECK (image_type IN ('founder','dashboard','vertical','abstract','product')),
  raw_image_url TEXT,
  treated_image_url TEXT,
  final_png_url TEXT,
  validation_score JSONB,
  copy_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','validating','treating','composing','ready','failed')),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imagery_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own imagery slides"
  ON public.imagery_slides FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.imagery_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE POLICY "Users insert own imagery slides"
  ON public.imagery_slides FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.imagery_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE POLICY "Users update own imagery slides"
  ON public.imagery_slides FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.imagery_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE POLICY "Users delete own imagery slides"
  ON public.imagery_slides FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.imagery_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE TRIGGER imagery_slides_updated_at
  BEFORE UPDATE ON public.imagery_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_imagery_slides_post ON public.imagery_slides(post_id, slide_n);

-- Logs de geração
CREATE TABLE public.imagery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID REFERENCES public.imagery_slides(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.imagery_posts(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  prompt_excerpt TEXT,
  response_summary JSONB,
  custo_usd NUMERIC(10,5) DEFAULT 0,
  duracao_ms INT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imagery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own imagery logs"
  ON public.imagery_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.imagery_posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- Service role insere logs livremente (edge functions)
CREATE POLICY "Service role inserts logs"
  ON public.imagery_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_imagery_logs_post ON public.imagery_logs(post_id);
CREATE INDEX idx_imagery_logs_slide ON public.imagery_logs(slide_id);

-- Bucket público para imagens geradas
INSERT INTO storage.buckets (id, name, public) VALUES ('imagery', 'imagery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read imagery"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'imagery');

CREATE POLICY "Authenticated write imagery"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'imagery' AND auth.role() = 'authenticated');

CREATE POLICY "Service role writes imagery"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'imagery');