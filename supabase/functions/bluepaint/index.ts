import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callClaude } from '../_shared/ai-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error('prospect_id obrigatório');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: prospect, error } = await supabase
      .from('consultoria_prospects')
      .select('*, prospect_meddic(*), prospect_session_memory(*)')
      .eq('id', prospect_id)
      .single();

    if (error || !prospect) throw new Error('Prospect não encontrado');

    const dores = (prospect.prospect_session_memory as any[])?.[0]?.fatos_extraidos
      ? JSON.stringify((prospect.prospect_session_memory as any[])[0].fatos_extraidos).slice(0, 400)
      : 'não mapeadas';

    const prompt = `Você é um especialista em vendas da VS Soluções.
Gere um kit de vendas personalizado para o prospect abaixo.

PROSPECT:
- Empresa: ${prospect.nome_negocio}
- Nicho: ${prospect.nicho ?? 'não informado'}
- Cidade: ${prospect.cidade ?? 'não informada'}
- MRR estimado: R$${prospect.mrr_estimado ?? 800}
- Score MEDDIC: ${prospect.score_qualificacao ?? 0}/100
- Dores identificadas: ${dores}

GERE (em JSON):
{
  "headline": "frase de abertura personalizada para este nicho (max 80 chars)",
  "confronto_financeiro": "argumento de custo humano vs VS para este caso específico (2-3 frases)",
  "objecoes": [
    {"objecao": "objeção provável 1", "resposta": "rebuttal direto 1"},
    {"objecao": "objeção provável 2", "resposta": "rebuttal direto 2"},
    {"objecao": "objeção provável 3", "resposta": "rebuttal direto 3"}
  ],
  "proximo_passo": "CTA recomendado baseado no score MEDDIC (1 frase)",
  "script_whatsapp": "mensagem pronta para enviar agora, 3-5 linhas, tom consultivo"
}

Responda APENAS com o JSON válido, sem markdown, sem texto extra.`;

    const result = await callClaude({
      system: 'Você é especialista em vendas B2B de soluções de IA. Responda sempre em JSON válido.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
    });

    const text = result.text ?? '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Resposta inválida da IA');

    const kit = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    return new Response(JSON.stringify({ success: true, kit }), {
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
