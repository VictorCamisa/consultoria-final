-- Adiciona campos para rastrear publicação no Instagram
ALTER TABLE public.imagery_posts
  ADD COLUMN IF NOT EXISTS ig_status text DEFAULT 'not_published',
  ADD COLUMN IF NOT EXISTS ig_media_id text,
  ADD COLUMN IF NOT EXISTS ig_permalink text,
  ADD COLUMN IF NOT EXISTS ig_published_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ig_caption text,
  ADD COLUMN IF NOT EXISTS ig_error text;

COMMENT ON COLUMN public.imagery_posts.ig_status IS 'not_published | publishing | published | failed';