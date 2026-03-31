/**
 * Processa a fila de cadência automática.
 *
 * Pode ser chamado:
 *   1. Manualmente pelo front (botão "Processar Cadência")
 *   2. Por um cron externo a cada hora (ex: pg_cron, GitHub Actions, Render cron)
 *
 * Fluxo por prospect em `em_cadencia`:
 *   D1 → D3 → D7 → D14 → D30 → frio
 *
 * Variáveis de ambiente:
 *   EVOLUTION_API_URL, EVOLUTION_API_KEY (mesmas do send-whatsapp)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Sequência da cadência: dia atual → próximo dia → dias até o próximo
const CADENCIA: Array<{ dia: number; next: number | null; next_days: number }> = [
  { dia: 1, next: 3, next_days: 2 },
  { dia: 3, next: 7, next_days: 4 },
  { dia: 7, next: 14, next_days: 7 },
  { dia: 14, next: 30, next_days: 16 },
  { dia: 30, next: null, next_days: 0 },
];

function getMensagem(config: Record<string, string>, dia: number): string | null {
  const map: Record<number, string> = {
    1: config.followup_d1,
    3: config.followup_d3,
    7: config.followup_d7,
    14: config.followup_d14,
    30: config.followup_d30,
  };
  return map[dia] ?? null;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  const results: Array<{ prospect_id: string; nome: string; status: string; erro?: string }> = [];
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // Busca todos os prospects em cadência com próxima ação vencida
    const { data: prospects, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, nome_negocio, whatsapp, nicho, status, dia_cadencia, data_proxima_acao, responsavel")
      .eq("status", "em_cadencia")
      .not("dia_cadencia", "is", null)
      .or(`data_proxima_acao.is.null,data_proxima_acao.lte.${nowIso}`)
      .order("data_proxima_acao", { ascending: true, nullsFirst: true });

    if (pErr) throw pErr;
    if (!prospects || prospects.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processados: 0, message: "Nenhum prospect pendente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca todas as configs de uma vez
    const { data: configs } = await supabase
      .from("consultoria_config")
      .select("*");

    for (const prospect of prospects) {
      try {
        const config = configs?.find((c) => c.nicho === prospect.nicho);
        if (!config) {
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "skip", erro: "config não encontrada" });
          continue;
        }

        // Respeita janela de horário configurada
        const hora = now.getHours();
        if (hora < config.horario_inicio || hora >= config.horario_fim) {
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "skip", erro: "fora do horário" });
          continue;
        }

        const diaAtual = prospect.dia_cadencia ?? 1;
        const step = CADENCIA.find((s) => s.dia === diaAtual);

        if (!step) {
          // Dia desconhecido — move para frio
          await supabase
            .from("consultoria_prospects")
            .update({ status: "frio", updated_at: nowIso })
            .eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "frio" });
          continue;
        }

        const mensagem = getMensagem(config as Record<string, string>, diaAtual);
        if (!mensagem) {
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "skip", erro: `followup_d${diaAtual} vazio` });
          continue;
        }

        // Envia via Evolution API (se configurada)
        let messageId: string | null = null;
        let enviado = false;

        if (evolutionUrl && evolutionKey && config.instancia_evolution) {
          const rawPhone = prospect.whatsapp.replace(/\D/g, "");
          const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

          const evoRes = await fetch(
            `${evolutionUrl}/message/sendText/${config.instancia_evolution}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evolutionKey },
              body: JSON.stringify({ number: phone, text: mensagem }),
            }
          );

          if (evoRes.ok) {
            const evoData = await evoRes.json();
            messageId = evoData?.key?.id ?? null;
            enviado = true;
          } else {
            const errText = await evoRes.text();
            console.error(`Evolution error para ${prospect.nome_negocio}:`, errText);
          }
        }

        // Salva na conversa
        await supabase.from("consultoria_conversas").insert({
          prospect_id: prospect.id,
          direcao: "saida",
          conteudo: mensagem,
          message_id: messageId,
          processado_ia: false,
        });

        // Registra na tabela de cadência
        await supabase.from("consultoria_cadencia").insert({
          prospect_id: prospect.id,
          dia: diaAtual,
          status: enviado ? "enviado" : "pendente_envio",
          enviado_em: enviado ? nowIso : null,
          mensagem_enviada: mensagem,
          script_usado: `followup_d${diaAtual}`,
          agendado_para: nowIso,
        });

        // Avança o prospect na cadência
        if (step.next === null) {
          // Última etapa → move para frio
          await supabase
            .from("consultoria_prospects")
            .update({
              status: "frio",
              dia_cadencia: 30,
              data_ultima_interacao: nowIso,
              updated_at: nowIso,
            })
            .eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "frio" });
        } else {
          // Próxima etapa
          await supabase
            .from("consultoria_prospects")
            .update({
              dia_cadencia: step.next,
              data_proxima_acao: addDays(step.next_days),
              data_ultima_interacao: nowIso,
              updated_at: nowIso,
            })
            .eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: `enviado_d${diaAtual}→d${step.next}` });
        }
      } catch (prospectErr) {
        console.error(`Erro no prospect ${prospect.id}:`, prospectErr);
        results.push({
          prospect_id: prospect.id,
          nome: prospect.nome_negocio,
          status: "erro",
          erro: (prospectErr as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processados: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
