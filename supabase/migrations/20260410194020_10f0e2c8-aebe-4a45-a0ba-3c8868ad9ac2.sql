
ALTER TABLE public.consultoria_prospects
ADD COLUMN whatsapp_valido boolean DEFAULT NULL;

UPDATE public.consultoria_prospects
SET whatsapp_valido = false
WHERE whatsapp IN ('12 3662-1090', '12 3662-1147', '12 9964-3568', '(12) 3662-1090', '(12) 3662-1147', '(12) 9964-3568');
