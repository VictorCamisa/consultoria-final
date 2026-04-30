-- ─── Tabela: posts de marketing ───
CREATE TABLE public.vs_marketing_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'Instagram',
  caption text NOT NULL DEFAULT '',
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt text,
  image_url text,
  image_prompt text,
  status text NOT NULL DEFAULT 'rascunho',
  scheduled_for timestamptz,
  best_time text,
  nicho text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vs_marketing_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.vs_marketing_posts
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at_vs_marketing_posts
  BEFORE UPDATE ON public.vs_marketing_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_vs_marketing_posts_created ON public.vs_marketing_posts (created_at DESC);

-- ─── Tabela: ativos de marca ───
CREATE TABLE public.vs_brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'rule',
  title text NOT NULL,
  content text,
  file_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vs_brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.vs_brand_assets
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at_vs_brand_assets
  BEFORE UPDATE ON public.vs_brand_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Tabela: campanhas de e-mail ───
CREATE TABLE public.vs_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  channel text NOT NULL DEFAULT 'email',
  message_template text,
  subject text,
  segment_status text[] DEFAULT '{}',
  segment_nichos text[] DEFAULT '{}',
  segment_audience text NOT NULL DEFAULT 'prospects',
  status text NOT NULL DEFAULT 'rascunho',
  scheduled_for timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vs_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.vs_email_campaigns
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER set_updated_at_vs_email_campaigns
  BEFORE UPDATE ON public.vs_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Storage bucket ───
INSERT INTO storage.buckets (id, name, public)
VALUES ('vs-marketing', 'vs-marketing', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vs_marketing_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'vs-marketing');

CREATE POLICY "vs_marketing_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vs-marketing' AND auth.role() = 'authenticated');

CREATE POLICY "vs_marketing_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'vs-marketing' AND auth.role() = 'authenticated');

CREATE POLICY "vs_marketing_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'vs-marketing' AND auth.role() = 'authenticated');