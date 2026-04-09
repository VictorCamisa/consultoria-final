
ALTER TABLE public.consultoria_prospects 
ADD COLUMN IF NOT EXISTS linked_instance text,
ADD COLUMN IF NOT EXISTS remote_jid text;

ALTER TABLE public.consultoria_conversas
ADD COLUMN IF NOT EXISTS origem text DEFAULT 'system_send',
ADD COLUMN IF NOT EXISTS instance_name text;
