/**
 * Processa cadência automática com máquina de estados e validador anti-eco.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone, resolveSendInstance } from "../_shared/instance-resolver.ts";

const CADENCIA: Array<{ dia: number; next: number | null; next_days: number }> = [
  { dia: 1, next: 3, next_days: 2 },
  { dia: 3, next: 7, next_days: 4 },
  { dia: 7, next: 14, next_days: 7 },
  { dia: 14, next: 30, next_days: 16 },
  { dia: 30, next: null, next_days: 0 },
];

function getMensagem(config: Record<string, string>, dia: number): string | null {
  const map: Record<number, string> = {
    1: config.followup_d1, 3: config.followup_d3, 7: config.followup_d7,
    14: config.followup_d14, 30: config.followup_d30,
  };
  return map[dia] ?? null;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function findConfigForNicho(configs: Record<string, unknown>[], nicho: string): Record<string, unknown> | null {
  const nichoLower = nicho.toLowerCase().trim();
  const exact = configs.find(c => (c.nicho as string).toLowerCase().trim() === nichoLower);
  if (exact) return exact;
  const partial = configs.find(c => {
    const cn = (c.nicho as string).toLowerCase().trim();
    return nichoLower.includes(cn) || cn.includes(nichoLower);
  });
  return partial ?? null;
}

function antiBlockDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 5000));
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
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const results: Array<{ prospect_id: string; nome: string; status: string; erro?: string }> = [];
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const { data: prospects, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, nome_negocio, whatsapp, nicho, status, dia_cadencia, data_proxima_acao, decisor, cidade, linked_instance, responsavel")
      .eq("status", "em_cadencia")
      .not("dia_cadencia", "is", null)
      .or(`data_proxima_acao.is.null,data_proxima_acao.lte.${nowIso}`)
      .order("data_proxima_acao", { ascending: true, nullsFirst: true });

    if (pErr) throw pErr;
    if (!prospects?.length) {
      return new Response(
        JSON.stringify({ success: true, processados: 0, message: "Nenhum prospect pendente" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configs } = await supabase.from("consultoria_config").select("*");
    let sendCount = 0;

    for (const prospect of prospects) {
      try {
        const config = configs?.length ? findConfigForNicho(configs as Record<string, unknown>[], prospect.nicho) : null;
        if (!config) {
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "skip", erro: `config não encontrada para "${prospect.nicho}"` });
          continue;
        }

        const hora = now.getHours();
        if (hora < (config.horario_inicio as number) || hora >= (config.horario_fim as number)) {
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "skip", erro: "fora do horário" });
          continue;
        }

        // Double-check se respondeu
        const { data: lastMsg } = await supabase
          .from("consultoria_conversas")
          .select("direcao")
          .eq("prospect_id", prospect.id)
          .eq("direcao", "entrada")
          .order("created_at", { ascending: false })
          .limit(1);

        if (lastMsg?.length) {
          await supabase.from("consultoria_prospects").update({ status: "respondeu", updated_at: nowIso }).eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "respondeu (parou cadência)" });
          continue;
        }

        const diaAtual = prospect.dia_cadencia ?? 1;
        const step = CADENCIA.find(s => s.dia === diaAtual);
        if (!step) {
          await supabase.from("consultoria_prospects").update({ status: "frio", updated_at: nowIso }).eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "frio" });
          continue;
        }

        let mensagem = getMensagem(config as Record<string, string>, diaAtual);
        if (!mensagem) {
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "skip", erro: `followup_d${diaAtual} vazio` });
          continue;
        }

        mensagem = mensagem
          .replace(/\{\{nome\}\}/gi, prospect.nome_negocio)
          .replace(/\{\{decisor\}\}/gi, prospect.decisor ?? prospect.nome_negocio)
          .replace(/\{\{cidade\}\}/gi, prospect.cidade ?? "");

        // Validação anti-eco
        try {
          const validateRes = await fetch(`${baseUrl}/functions/v1/validate-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ prospect_id: prospect.id, mensagem }),
          });
          if (validateRes.ok) {
            const validation = await validateRes.json();
            if (!validation.approved && validation.revised_message) {
              mensagem = validation.revised_message;
            }
          }
        } catch (e) {
          console.warn("[cadencia] Validador indisponível:", e);
        }

        if (sendCount > 0) await antiBlockDelay();

        let messageId: string | null = null;
        let enviado = false;

        // Use centralized instance resolver
        const instancia = await resolveSendInstance(supabase, {
          id: prospect.id, whatsapp: prospect.whatsapp,
          responsavel: null, nicho: prospect.nicho,
        });

        if (evolutionUrl && evolutionKey && instancia) {
          const phone = normalizePhone(prospect.whatsapp);

          const evoRes = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
            body: JSON.stringify({ number: phone, text: mensagem }),
          });

          if (evoRes.ok) {
            const evoData = await evoRes.json();
            messageId = evoData?.key?.id ?? null;
            enviado = true;
            sendCount++;
          } else {
            console.error(`[cadencia] Evolution error para ${prospect.nome_negocio}:`, await evoRes.text());
          }
        }

        await supabase.from("consultoria_conversas").insert({
          prospect_id: prospect.id, direcao: "saida", conteudo: mensagem, message_id: messageId, processado_ia: false,
          origem: "system_send", instance_name: instancia || null,
        });

        await supabase.from("consultoria_cadencia").insert({
          prospect_id: prospect.id, dia: diaAtual, status: enviado ? "enviado" : "pendente_envio",
          enviado_em: enviado ? nowIso : null, mensagem_enviada: mensagem,
          script_usado: `followup_d${diaAtual}`, agendado_para: nowIso,
        });

        // Atualiza estado
        await supabase.from("prospect_execution_state").upsert({
          prospect_id: prospect.id,
          current_step: step.next ? "await_reply" : "completed",
          completed_steps: ["draft", "validate", "send"],
          status: step.next ? "in_progress" : "completed",
          context_snapshot: { dia: diaAtual, enviado, next_dia: step.next },
          updated_at: nowIso,
        }, { onConflict: "prospect_id" });

        if (step.next === null) {
          await supabase.from("consultoria_prospects").update({
            status: "frio", dia_cadencia: 30, data_ultima_interacao: nowIso, updated_at: nowIso,
          }).eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "frio" });
        } else {
          await supabase.from("consultoria_prospects").update({
            dia_cadencia: step.next, data_proxima_acao: addDays(step.next_days),
            data_ultima_interacao: nowIso, updated_at: nowIso,
          }).eq("id", prospect.id);
          results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: `d${diaAtual}→d${step.next} (${config.nicho})` });
        }
      } catch (prospectErr) {
        console.error(`[cadencia] Erro no prospect ${prospect.id}:`, prospectErr);
        results.push({ prospect_id: prospect.id, nome: prospect.nome_negocio, status: "erro", erro: (prospectErr as Error).message });
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
