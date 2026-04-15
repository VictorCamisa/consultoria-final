CREATE TABLE public.consultoria_nichos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT 'bg-gray-500/15 border-gray-500/30 text-gray-400',
  dot text NOT NULL DEFAULT 'bg-gray-500',
  icon text DEFAULT '🏢',
  search_value text DEFAULT '',
  is_primary boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.consultoria_nichos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON public.consultoria_nichos FOR ALL USING (auth.role() = 'authenticated');

INSERT INTO public.consultoria_nichos (label, keywords, color, dot, icon, search_value, is_primary, ordem) VALUES
('Estética', '{estética,estetic,bem-estar,cirurgia plástica}', 'bg-pink-500/15 border-pink-500/30 text-pink-400', 'bg-pink-500', '💆', 'clínicas estéticas', true, 1),
('Odonto', '{odonto,odontológ}', 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400', 'bg-cyan-500', '🦷', 'clínicas odontológicas', true, 2),
('Advocacia', '{advoca,advocacia,advogado,direito,jurídic}', 'bg-amber-500/15 border-amber-500/30 text-amber-400', 'bg-amber-500', '⚖️', 'escritórios de advocacia', true, 3),
('Revendas', '{revenda,veículo,seminov,motors,auto}', 'bg-blue-500/15 border-blue-500/30 text-blue-400', 'bg-blue-500', '🚗', 'revendas de veículos seminovos usados', true, 4);