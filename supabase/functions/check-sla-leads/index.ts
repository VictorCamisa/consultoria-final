import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DANILO_PHONE = Deno.env.get('DANILO_WHATSAPP') ?? '';
const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL') ?? '';
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';
const INSTANCE = 'victorcomercial';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: vencidos, error } = await supabase
      .from('consultoria_prospects')
      .select('id, nome_negocio, nicho, cidade, sla_expires_at, data_ultima_interacao')
      .lt('sla_expires_at', new Date().toISOString())
      .eq('sla_alerted', false)
      .not('status', 'in', '("fechado","perdido","convertido","blacklist")');

    if (error) throw error;
    if (!vencidos?.length) {
      return new Response(JSON.stringify({ alertas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let enviados = 0;

    for (const p of vencidos) {
      const expiredAt = new Date(p.sla_expires_at);
      const horasVencido = Math.round((Date.now() - expiredAt.getTime()) / 3_600_000);
      const diasLabel = horasVencido >= 24 ? `${Math.floor(horasVencido / 24)} dias` : `${horasVencido}h`;

      const mensagem =
        `🔴 *SLA VENCIDO*\n\n` +
        `*${p.nome_negocio}*\n` +
        `Nicho: ${p.nicho ?? '—'} · ${p.cidade ?? '—'}\n` +
        `Sem contato há: *${diasLabel}*\n\n` +
        `⚡ Ataque agora — acesse o sistema para agir.`;

      if (EVOLUTION_URL && EVOLUTION_KEY && DANILO_PHONE) {
        await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
          body: JSON.stringify({ number: DANILO_PHONE, text: mensagem }),
        }).catch(() => {});
      }

      await supabase
        .from('consultoria_prospects')
        .update({ sla_alerted: true })
        .eq('id', p.id);

      enviados++;
    }

    return new Response(JSON.stringify({ alertas: enviados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
