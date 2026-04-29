import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LeadPayload {
  nome: string;
  empresa: string;
  nicho: 'estetica' | 'odonto' | 'advocacia' | 'revendas' | 'outro';
  whatsapp: string;
  mensagem?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload: LeadPayload = await req.json();

    if (!payload.nome || !payload.empresa || !payload.nicho || !payload.whatsapp) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: insertError } = await supabase.from('leads_raw').insert({
      nome: payload.nome,
      empresa: payload.empresa,
      nicho: payload.nicho,
      whatsapp: payload.whatsapp,
      mensagem: payload.mensagem ?? null,
      source: 'landing_page',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertError) throw new Error(insertError.message);

    // Send welcome WhatsApp message via Evolution API
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

    if (evolutionUrl && evolutionKey) {
      const welcomeMsg =
        `Olá ${payload.nome}! 👋\n\n` +
        `Recebemos seu contato pela VS Soluções!\n\n` +
        `Em até 2 horas úteis um especialista vai entrar em contato com você para um diagnóstico gratuito de 30 minutos.\n\n` +
        `Enquanto isso, você pode conhecer mais sobre nossos resultados em nosso site.\n\n` +
        `Equipe VS Soluções 🚀`;

      await fetch(`${evolutionUrl}/message/sendText/victorcomercial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: payload.whatsapp,
          text: welcomeMsg,
        }),
      }).catch(() => {
        // Silently ignore Evolution API errors — lead is already saved
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
