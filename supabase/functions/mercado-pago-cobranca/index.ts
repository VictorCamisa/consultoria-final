/**
 * Cria uma cobrança no Mercado Pago (Checkout Pro / Preferences) para um cliente
 * e, opcionalmente, envia o link de pagamento via WhatsApp (Evolution API).
 *
 * Body:
 *   {
 *     cliente_id: string,
 *     valor: number,
 *     razao: string,
 *     descricao?: string,
 *     metodos: string[],          // ex: ["pix", "credit_card", "bolbradesco"]
 *     enviar_whatsapp: boolean,
 *     mensagem_personalizada?: string,
 *     expira_em_dias?: number
 *   }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone } from "../_shared/instance-resolver.ts";

const MP_API = "https://api.mercadopago.com";

// Mapeia métodos amigáveis -> excluded_payment_types do MP (excluimos os NÃO escolhidos).
const ALL_TYPES = ["credit_card", "debit_card", "ticket", "bank_transfer", "atm"] as const;

function buildPaymentMethods(metodos: string[]) {
  const set = new Set(metodos);
  const wantsPix = set.has("pix");
  const wantsCredit = set.has("credit_card");
  const wantsDebit = set.has("debit_card");
  const wantsBoleto = set.has("bolbradesco") || set.has("boleto");

  const excluded_payment_types: { id: string }[] = [];
  if (!wantsCredit) excluded_payment_types.push({ id: "credit_card" });
  if (!wantsDebit) excluded_payment_types.push({ id: "debit_card" });
  if (!wantsBoleto) excluded_payment_types.push({ id: "ticket" });
  if (!wantsPix) excluded_payment_types.push({ id: "bank_transfer" });

  return {
    excluded_payment_types,
    installments: wantsCredit ? 12 : 1,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      cliente_id,
      valor,
      razao,
      descricao,
      metodos,
      enviar_whatsapp = true,
      mensagem_personalizada,
      expira_em_dias = 7,
    } = body ?? {};

    if (!cliente_id || !valor || !razao || !Array.isArray(metodos) || metodos.length === 0) {
      throw new Error("Campos obrigatórios: cliente_id, valor, razao, metodos[]");
    }

    const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado nas secrets.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca cliente
    const { data: cliente, error: cErr } = await supabase
      .from("consultoria_clientes")
      .select("id, nome_negocio, decisor, whatsapp, email, prospect_id")
      .eq("id", cliente_id)
      .single();
    if (cErr || !cliente) throw new Error(`Cliente não encontrado: ${cErr?.message}`);

    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) throw new Error("Valor inválido");

    const expira = new Date();
    expira.setDate(expira.getDate() + Number(expira_em_dias || 7));

    const payment_methods = buildPaymentMethods(metodos);

    // Cria preference no Mercado Pago
    const preferencePayload: Record<string, unknown> = {
      items: [
        {
          title: razao,
          description: descricao || razao,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(valorNum.toFixed(2)),
        },
      ],
      payer: {
        name: cliente.decisor || cliente.nome_negocio,
        email: cliente.email || undefined,
      },
      payment_methods,
      external_reference: `cliente:${cliente.id}`,
      statement_descriptor: "VS CONSULTORIA",
      expires: true,
      expiration_date_to: expira.toISOString(),
      metadata: {
        cliente_id: cliente.id,
        razao,
      },
    };

    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      throw new Error(`Mercado Pago (${mpRes.status}): ${errText}`);
    }
    const mp = await mpRes.json();
    const initPoint: string = mp.init_point || mp.sandbox_init_point;

    // Insere cobrança
    const { data: cobranca, error: insErr } = await supabase
      .from("consultoria_cobrancas")
      .insert({
        cliente_id: cliente.id,
        valor: valorNum,
        razao,
        descricao: descricao ?? null,
        metodos_pagamento: metodos,
        status: "pendente",
        mp_preference_id: mp.id,
        mp_init_point: initPoint,
        expira_em: expira.toISOString(),
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // Envia WhatsApp (opcional)
    let whatsappStatus: { ok: boolean; error?: string } = { ok: false };
    if (enviar_whatsapp && cliente.whatsapp) {
      try {
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
        if (!evolutionUrl || !evolutionKey) {
          throw new Error("Evolution API não configurada");
        }

        let instancia: string | null = null;
        if (cliente.prospect_id) {
          const { data: prosp } = await supabase
            .from("consultoria_prospects")
            .select("linked_instance")
            .eq("id", cliente.prospect_id)
            .maybeSingle();
          if (prosp?.linked_instance) {
            const { data: inst } = await supabase
              .from("evolution_instances")
              .select("instance_name")
              .eq("instance_name", prosp.linked_instance)
              .eq("state", "open")
              .maybeSingle();
            if (inst) instancia = inst.instance_name;
          }
        }
        if (!instancia) {
          const { data: anyInst } = await supabase
            .from("evolution_instances")
            .select("instance_name")
            .eq("state", "open")
            .limit(1)
            .maybeSingle();
          instancia = anyInst?.instance_name ?? null;
        }
        if (!instancia) throw new Error("Nenhuma instância Evolution disponível");

        const valorFmt = valorNum.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const vence = expira.toLocaleDateString("pt-BR");
        const metodosLabel: Record<string, string> = {
          pix: "PIX",
          credit_card: "Cartão de crédito (até 12x)",
          debit_card: "Cartão de débito",
          bolbradesco: "Boleto bancário",
          boleto: "Boleto bancário",
        };
        const metodosTxt = metodos.map((m) => `• ${metodosLabel[m] ?? m}`).join("\n");
        const saudacao = cliente.decisor ? `Olá, ${cliente.decisor}!` : `Olá!`;

        const texto =
          mensagem_personalizada?.trim()
            ? `${mensagem_personalizada.trim()}\n\n💰 *Valor:* ${valorFmt}\n📅 *Vence em:* ${vence}\n\n*Formas de pagamento disponíveis:*\n${metodosTxt}\n\n🔗 *Link para pagamento:*\n${initPoint}\n\nQualquer dúvida estou à disposição.\n— VS Consultoria`
            : `${saudacao}\n\nSegue a cobrança referente a: *${razao}*.\n\n${descricao ? descricao + "\n\n" : ""}💰 *Valor:* ${valorFmt}\n📅 *Vence em:* ${vence}\n\n*Formas de pagamento disponíveis:*\n${metodosTxt}\n\n🔗 *Link para pagamento (Mercado Pago):*\n${initPoint}\n\nO link é seguro e processado pelo Mercado Pago. Após o pagamento, a confirmação chega automaticamente.\n\nQualquer dúvida estou à disposição.\n— VS Consultoria`;

        const phone = normalizePhone(cliente.whatsapp);
        const evoRes = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: phone, text: texto }),
        });
        if (!evoRes.ok) {
          const t = await evoRes.text();
          throw new Error(`Evolution ${evoRes.status}: ${t}`);
        }

        // Loga conversa se houver prospect_id
        if (cliente.prospect_id) {
          await supabase.from("consultoria_conversas").insert({
            prospect_id: cliente.prospect_id,
            direcao: "saida",
            conteudo: texto,
            processado_ia: false,
            origem: "cobranca_mp",
            instance_name: instancia,
          });
        }

        await supabase
          .from("consultoria_cobrancas")
          .update({
            whatsapp_enviado: true,
            whatsapp_enviado_em: new Date().toISOString(),
          })
          .eq("id", cobranca.id);

        whatsappStatus = { ok: true };
      } catch (e) {
        whatsappStatus = { ok: false, error: (e as Error).message };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cobranca: { ...cobranca, whatsapp_enviado: whatsappStatus.ok },
        init_point: initPoint,
        whatsapp: whatsappStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
