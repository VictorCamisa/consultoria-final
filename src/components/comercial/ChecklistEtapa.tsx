import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { Prospect } from "./types";

// To-dos do Playbook Comercial VS AUTO por estágio
const PLAYBOOK_TODOS: Record<string, { id: string; label: string }[]> = {
  novo: [
    { id: "pesq_estoque", label: "Verificar estoque no OLX/WebMotors (mín. 10 veículos)" },
    { id: "pesq_instagram", label: "Verificar Instagram da loja (frequência de posts)" },
    { id: "pesq_site", label: "Verificar se tem site e qualidade" },
    { id: "pesq_whatsapp", label: "Testar resposta do WhatsApp da loja" },
    { id: "pesq_sistema", label: "Identificar sistema atual (Autocerto, Revenda Mais, outro)" },
    { id: "pesq_score", label: "Pontuar ICP: mín. 5 pontos para abordar" },
  ],
  abordado: [
    { id: "msg_enviada", label: "Primeiro contato enviado (script A, B ou C)" },
    { id: "msg_personalizada", label: "Mensagem personalizada com dado específico da loja" },
    { id: "horario_certo", label: "Enviado em horário correto (ter-qui, 9-11h ou 14-16h)" },
    { id: "followup_agendado", label: "Follow-up D+2 agendado no calendário" },
  ],
  em_cadencia: [
    { id: "fu1_enviado", label: "Follow-up 1 (D+2) — ângulo: prova social" },
    { id: "fu2_enviado", label: "Follow-up 2 (D+5) — ângulo: custo de não agir" },
    { id: "fu3_enviado", label: "Follow-up 3 (D+10) — ângulo: escassez + encerramento" },
    { id: "reativacao_45d", label: "Se sem resposta: mover para reativação 45 dias" },
  ],
  respondeu: [
    { id: "objecao_mapeada", label: "Objeção principal identificada e registrada" },
    { id: "reuniao_proposta", label: "Reunião proposta com data e formato definidos" },
    { id: "resposta_objecao", label: "Resposta à objeção enviada (ver scripts)" },
  ],
  call_agendada: [
    { id: "demo_preparada", label: "Demo ao vivo preparada com case do Vale do Paraíba" },
    { id: "lembrete_enviado", label: "Lembrete de reunião enviado 1 dia antes" },
    { id: "roteiro_revisado", label: "Roteiro de 20 minutos revisado" },
    { id: "numeros_atualizados", label: "Números de prova social atualizados (60 carros, 65% custo)" },
  ],
  call_realizada: [
    { id: "dor_mapeada", label: "Dor principal do cliente mapeada durante a call" },
    { id: "demo_feita", label: "Demo ao vivo realizada com IA em funcionamento" },
    { id: "preco_apresentado", label: "Preço apresentado contra alternativas (R$1.497 vs R$6k+)" },
    { id: "objecao_pos_call", label: "Objeção pós-call identificada" },
    { id: "data_fechamento", label: "Data de resposta confirmada (máx. 3 dias)" },
  ],
  proposta_enviada: [
    { id: "proposta_enviada_ok", label: "Proposta resumida enviada em até 2h após reunião" },
    { id: "followup_24h", label: "Follow-up de 24h enviado se sem resposta" },
    { id: "condicao_expira", label: "Condição especial com data de expiração comunicada" },
    { id: "contrato_pronto", label: "Contrato preparado para envio imediato" },
  ],
  quente: [
    { id: "urgencia_criada", label: "Urgência criada (setup especial com data limite)" },
    { id: "objecao_final", label: "Última objeção respondida (preço, tempo, confiança)" },
    { id: "contrato_enviado", label: "Contrato enviado para assinatura" },
  ],
  fechado: [
    { id: "setup_pago", label: "Setup recebido (R$3.500 ou condição especial)" },
    { id: "onboarding_agendado", label: "Onboarding agendado (D+1)" },
    { id: "briefing_enviado", label: "Formulário de briefing enviado ao cliente" },
    { id: "indicacao_pedida", label: "Pedido de indicação enviado após 30 dias" },
  ],
  frio: [
    { id: "reativ_45d", label: "Reativação 45 dias: ângulo resultado recente" },
    { id: "reativ_90d", label: "Reativação 90 dias: ângulo mudança de contexto" },
    { id: "reativ_135d", label: "Reativação 135 dias: ângulo concorrente da região" },
  ],
};

const DEFAULT_TODOS = [
  { id: "verificar_dados", label: "Verificar dados de contato" },
  { id: "definir_proximo", label: "Definir próxima ação" },
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

  const stageKey = prospect.status;
  const stageTodos = PLAYBOOK_TODOS[stageKey] || DEFAULT_TODOS;

  const savedChecklist: ChecklistItem[] = (() => {
    try {
      const raw = (prospect as any).checklist_etapa;
      if (Array.isArray(raw)) return raw;
      return [];
    } catch {
      return [];
    }
  })();

  const items: ChecklistItem[] = stageTodos.map((todo) => {
    const saved = savedChecklist.find((s) => s.id === todo.id);
    return {
      id: todo.id,
      label: todo.label,
      done: saved?.done ?? false,
      stage: stageKey,
    };
  });

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const handleToggle = async (itemId: string, currentDone: boolean) => {
    setSaving(itemId);
    try {
      const otherStageItems = savedChecklist.filter((s) => s.stage !== stageKey);
      const updatedStageItems: ChecklistItem[] = items.map((item) => ({
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Checklist da Etapa
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
            <span
              className={`text-[11px] leading-relaxed ${
                item.done
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              }`}
            >
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
