import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { Prospect, nichoCategory } from "./types";

type StageTodos = Record<string, { id: string; label: string }[]>;

// ─── ESTÉTICA ────────────────────────────────────────────────────────────────
const ESTETICA: StageTodos = {
  novo: [
    { id: "pesq_fonte",        label: "Mapear clínica em: Google Maps, Instagram ou iFood Beleza" },
    { id: "pesq_instagram",    label: "Instagram: seguidores, frequência de posts antes/depois, stories ativos" },
    { id: "pesq_agendamento",  label: "Identificar sistema de agendamento: Booksy, Fresha, agenda própria ou só WhatsApp" },
    { id: "pesq_site",         label: "Verificar site: existe? tem botão de agendamento online?" },
    { id: "pesq_google",       label: "Google Business: nota e quantidade de avaliações (mín. 10 reviews)" },
    { id: "pesq_whatsapp",     label: "Testar WhatsApp da clínica: tempo de resposta e se há automação" },
    { id: "pesq_servicos",     label: "Identificar serviços principais: depilação, skincare, massagem, estética facial" },
    { id: "pesq_score",        label: "Pontuar ICP: Instagram ativo (+2), sem agendamento online (+2), >100 seg. (+1) — mín. 5pts para abordar" },
  ],
  abordado: [
    { id: "msg_script",        label: "Primeiro contato enviado (script de estética A, B ou C)" },
    { id: "msg_dado",          label: "Mensagem menciona dado real da clínica (seguidores, ausência de agendamento)" },
    { id: "horario_certo",     label: "Enviado seg-sex, janela 9-11h ou 15-17h (evitar horário de atendimento)" },
    { id: "followup_agendado", label: "Follow-up D+2 agendado no calendário" },
  ],
  em_cadencia: [
    { id: "fu1_enviado",   label: "FU1 D+2 — ângulo: clientes que saem sem reagendar (perda de receita recorrente)" },
    { id: "fu2_enviado",   label: "FU2 D+5 — ângulo: clínica concorrente da região já usa automação de agendamento" },
    { id: "fu3_enviado",   label: "FU3 D+10 — ângulo: encerramento + condição especial por tempo limitado" },
    { id: "sem_resposta",  label: "Sem resposta após D+10? Mover para Frio (reativar em 45 dias)" },
  ],
  respondeu: [
    { id: "objecao_mapeada",  label: "Objeção identificada: 'já tenho sistema' / 'não tenho tempo' / 'caro'" },
    { id: "reuniao_proposta", label: "Demo proposta com data e formato (WhatsApp vídeo ou presencial)" },
    { id: "resposta_objecao", label: "Resposta à objeção enviada (scripts de objeção para estética)" },
  ],
  call_agendada: [
    { id: "demo_preparada",    label: "Demo preparada com case de clínica estética similar na região" },
    { id: "lembrete_enviado",  label: "Lembrete enviado 1 dia antes (+ link se for online)" },
    { id: "roteiro_revisado",  label: "Roteiro 20min revisado: dor → demo → preço → próximo passo" },
    { id: "numeros_ok",        label: "Números atualizados: % redução de no-show, clientes recuperados via automação" },
  ],
  call_realizada: [
    { id: "dor_mapeada",       label: "Dor principal identificada: no-show? perda de lead? sem follow-up pós-procedimento?" },
    { id: "demo_feita",        label: "Demo ao vivo: IA respondendo agendamento, confirmação e lembrete automático" },
    { id: "preco_apresentado", label: "Preço apresentado vs. alternativas (R$1.497 vs. secretária + ferramenta separada)" },
    { id: "objecao_pos_call",  label: "Objeção pós-call identificada e registrada nas notas" },
    { id: "data_resposta",     label: "Data de resposta confirmada com o cliente (máx. 3 dias)" },
  ],
  proposta_enviada: [
    { id: "proposta_ok",      label: "Proposta enviada em até 2h (resumo visual + números do case)" },
    { id: "followup_24h",     label: "Follow-up de 24h enviado se sem resposta" },
    { id: "condicao_expira",  label: "Condição especial comunicada com data de expiração" },
    { id: "contrato_pronto",  label: "Contrato preparado para envio imediato no aceite" },
  ],
  quente: [
    { id: "urgencia_criada",   label: "Urgência criada: 'temos 2 vagas no seu bairro este mês'" },
    { id: "objecao_final",     label: "Última objeção respondida (preço, tempo ou confiança)" },
    { id: "contrato_enviado",  label: "Contrato enviado para assinatura digital" },
  ],
  fechado: [
    { id: "setup_pago",          label: "Setup recebido (R$3.500 ou condição especial acordada)" },
    { id: "onboarding_agendado", label: "Onboarding agendado (D+1 após setup)" },
    { id: "briefing_enviado",    label: "Briefing enviado: serviços, horários e tom de voz da clínica" },
    { id: "integracao_agenda",   label: "Integração com agenda atual configurada (Booksy, Fresha, Google Calendar)" },
    { id: "indicacao_pedida",    label: "Pedido de indicação enviado após 30 dias de uso" },
  ],
  frio: [
    { id: "reativ_45d",  label: "Reativação 45 dias: case de clínica similar na mesma cidade" },
    { id: "reativ_90d",  label: "Reativação 90 dias: nova funcionalidade ou sazonalidade (verão, datas especiais)" },
    { id: "reativ_135d", label: "Reativação 135 dias: clínica concorrente na mesma rua já usa o sistema" },
  ],
};

// ─── REVENDAS / VS AUTO ───────────────────────────────────────────────────────
const REVENDAS: StageTodos = {
  novo: [
    { id: "pesq_fonte",    label: "Mapear loja em: OLX Autos, WebMotors, IcarroDB ou Instagram" },
    { id: "pesq_estoque",  label: "Contar estoque online: mín. 10 veículos para prosseguir" },
    { id: "pesq_instagram",label: "Instagram: seguidores, frequência de posts, qualidade das fotos" },
    { id: "pesq_site",     label: "Verificar site: existe? tem WhatsApp click? tem formulário de contato?" },
    { id: "pesq_whatsapp", label: "Testar WhatsApp da loja: responde em < 30min? tem bot?" },
    { id: "pesq_sistema",  label: "Identificar sistema atual: Autocerto, Revenda Mais, Autoconf ou planilha" },
    { id: "pesq_portais",  label: "Quantos portais usa? (OLX, WebMotors, AutoLine, Volanty…)" },
    { id: "pesq_score",    label: "Pontuar ICP (ver critérios) — mín. 5pts para abordar" },
  ],
  abordado: [
    { id: "msg_script",        label: "Primeiro contato enviado (Script A: frio / B: indicação / C: já tem sistema)" },
    { id: "msg_personalizada", label: "Mensagem menciona dado real da loja (estoque específico, portal que usa)" },
    { id: "horario_certo",     label: "Enviado ter-qui, janela 9-11h ou 14-16h" },
    { id: "followup_agendado", label: "Follow-up D+2 agendado no calendário" },
  ],
  em_cadencia: [
    { id: "fu1_enviado",  label: "FU1 D+2 — ângulo: case de loja da região (prova social com números)" },
    { id: "fu2_enviado",  label: "FU2 D+5 — ângulo: custo de perder lead fora do horário comercial" },
    { id: "fu3_enviado",  label: "FU3 D+10 — ângulo: vagas limitadas na região + encerramento" },
    { id: "sem_resposta", label: "Sem resposta após D+10? Mover para Frio (reativar em 45 dias)" },
  ],
  respondeu: [
    { id: "objecao_mapeada",  label: "Objeção principal identificada e registrada nas notas" },
    { id: "reuniao_proposta", label: "Reunião proposta com data, horário e formato definidos" },
    { id: "resposta_objecao", label: "Resposta à objeção enviada (ver scripts VS AUTO)" },
  ],
  call_agendada: [
    { id: "demo_preparada",   label: "Demo ao vivo preparada com case do Vale do Paraíba" },
    { id: "lembrete_enviado", label: "Lembrete enviado 1 dia antes da reunião" },
    { id: "roteiro_revisado", label: "Roteiro de 20 minutos revisado" },
    { id: "numeros_ok",       label: "Números atualizados: 60+ carros atendidos, 65% redução custo por venda" },
  ],
  call_realizada: [
    { id: "dor_mapeada",       label: "Dor principal mapeada: leads fora do horário? dependência de vendedor? custo de mídia?" },
    { id: "demo_feita",        label: "Demo ao vivo realizada com IA respondendo e qualificando em tempo real" },
    { id: "preco_apresentado", label: "Preço apresentado: R$1.497/mês vs. agência (R$3-6k) + vendedor (R$3k+)" },
    { id: "objecao_pos_call",  label: "Objeção pós-call identificada e registrada" },
    { id: "data_fechamento",   label: "Data de resposta confirmada com o prospect (máx. 3 dias)" },
  ],
  proposta_enviada: [
    { id: "proposta_ok",     label: "Proposta enviada em até 2h após a reunião (resumo + ROI calculado)" },
    { id: "followup_24h",    label: "Follow-up de 24h enviado se sem resposta" },
    { id: "condicao_expira", label: "Condição especial com data de expiração comunicada" },
    { id: "contrato_pronto", label: "Contrato pronto para envio imediato no aceite" },
  ],
  quente: [
    { id: "urgencia_criada",  label: "Urgência criada: setup especial ou vaga exclusiva na região com data limite" },
    { id: "objecao_final",    label: "Última objeção respondida (preço, tempo de implantação ou confiança)" },
    { id: "contrato_enviado", label: "Contrato enviado para assinatura" },
  ],
  fechado: [
    { id: "setup_pago",          label: "Setup recebido (R$3.500 ou condição especial acordada)" },
    { id: "onboarding_agendado", label: "Onboarding agendado (D+1 após setup)" },
    { id: "briefing_enviado",    label: "Formulário de briefing enviado: marcas, preço médio, diferenciais" },
    { id: "indicacao_pedida",    label: "Pedido de indicação enviado após 30 dias de resultado" },
  ],
  frio: [
    { id: "reativ_45d",  label: "Reativação 45 dias: resultado recente de loja similar na região" },
    { id: "reativ_90d",  label: "Reativação 90 dias: mudança de contexto (novo vendedor, expansão, sazonalidade)" },
    { id: "reativ_135d", label: "Reativação 135 dias: concorrente direto da região fechou com a VS AUTO" },
  ],
};

// ─── GENÉRICO (fallback) ──────────────────────────────────────────────────────
const GENERICO: StageTodos = {
  novo: [
    { id: "pesq_contato",  label: "Verificar e confirmar dados de contato (WhatsApp, e-mail)" },
    { id: "pesq_online",   label: "Verificar presença online: Instagram, site, Google Business" },
    { id: "pesq_dor",      label: "Mapear dor provável do segmento antes de abordar" },
    { id: "pesq_score",    label: "Pontuar ICP e decidir se é viável abordar" },
  ],
  abordado: [
    { id: "msg_enviada",       label: "Primeiro contato enviado com mensagem personalizada" },
    { id: "followup_agendado", label: "Follow-up D+2 agendado no calendário" },
  ],
  em_cadencia: [
    { id: "fu1_enviado", label: "Follow-up 1 (D+2) enviado" },
    { id: "fu2_enviado", label: "Follow-up 2 (D+5) enviado" },
    { id: "fu3_enviado", label: "Follow-up 3 (D+10) enviado — encerrar se sem resposta" },
  ],
  respondeu: [
    { id: "objecao_mapeada",  label: "Objeção principal identificada" },
    { id: "reuniao_proposta", label: "Reunião proposta com data definida" },
  ],
  call_agendada: [
    { id: "demo_preparada",   label: "Demo ou apresentação preparada" },
    { id: "lembrete_enviado", label: "Lembrete enviado 1 dia antes" },
  ],
  call_realizada: [
    { id: "dor_mapeada",       label: "Dor principal mapeada" },
    { id: "preco_apresentado", label: "Preço e proposta de valor apresentados" },
    { id: "data_resposta",     label: "Data de resposta confirmada" },
  ],
  proposta_enviada: [
    { id: "proposta_ok",  label: "Proposta enviada em até 2h" },
    { id: "followup_24h", label: "Follow-up de 24h enviado se sem resposta" },
  ],
  quente: [
    { id: "urgencia_criada",  label: "Urgência ou condição especial comunicada" },
    { id: "contrato_enviado", label: "Contrato enviado para assinatura" },
  ],
  fechado: [
    { id: "onboarding_agendado", label: "Onboarding agendado" },
    { id: "briefing_enviado",    label: "Briefing ou formulário de início enviado" },
    { id: "indicacao_pedida",    label: "Pedido de indicação após 30 dias" },
  ],
  frio: [
    { id: "reativ_45d",  label: "Reativação 45 dias: novo ângulo ou resultado recente" },
    { id: "reativ_90d",  label: "Reativação 90 dias: mudança de contexto" },
    { id: "reativ_135d", label: "Reativação 135 dias: última tentativa" },
  ],
};

const PLAYBOOKS: Record<string, StageTodos> = {
  estetica: ESTETICA,
  revendas: REVENDAS,
};

const DEFAULT_STAGE_TODOS = [
  { id: "verificar_dados",   label: "Verificar dados de contato" },
  { id: "definir_proximo",   label: "Definir próxima ação" },
];

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  stage: string;
}

interface Props {
  prospect: Prospect;
  onUpdate: (updated: Partial<Prospect>) => void;
}

export function ChecklistEtapa({ prospect, onUpdate }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  const cat = nichoCategory(prospect.nicho ?? "");
  const playbook: StageTodos = (cat && PLAYBOOKS[cat.key]) ? PLAYBOOKS[cat.key] : GENERICO;
  const stageKey = prospect.status;
  const stageTodos = playbook[stageKey] ?? DEFAULT_STAGE_TODOS;

  const savedChecklist: ChecklistItem[] = (() => {
    try {
      const raw = (prospect as any).checklist_etapa;
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  })();

  const items: ChecklistItem[] = stageTodos.map((todo) => {
    const saved = savedChecklist.find((s) => s.id === todo.id);
    return { id: todo.id, label: todo.label, done: saved?.done ?? false, stage: stageKey };
  });

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const handleToggle = async (itemId: string, currentDone: boolean) => {
    setSaving(itemId);
    try {
      const otherStageItems = savedChecklist.filter((s) => s.stage !== stageKey);
      const updatedStageItems = items.map((item) => ({
        ...item,
        done: item.id === itemId ? !currentDone : item.done,
      }));
      const newChecklist = [...otherStageItems, ...updatedStageItems];

      const { error } = await supabase
        .from("consultoria_prospects")
        .update({ checklist_etapa: newChecklist } as any)
        .eq("id", prospect.id);

      if (error) throw error;
      onUpdate({ checklist_etapa: newChecklist } as any);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const nichoLabel = cat ? cat.label : "Geral";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Checklist — {nichoLabel}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {doneCount}/{items.length}
        </span>
      </div>

      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.id, item.done)}
            disabled={saving === item.id}
            className="w-full flex items-start gap-2.5 p-2 rounded-md hover:bg-secondary/50 transition-colors text-left group"
          >
            <div className="shrink-0 mt-0.5">
              {item.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>
            <span className={`text-[11px] leading-relaxed ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-3">
          Nenhum checklist para esta etapa.
        </p>
      )}
    </div>
  );
}
