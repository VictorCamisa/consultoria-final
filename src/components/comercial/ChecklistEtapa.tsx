import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, ClipboardList, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Prospect, nichoCategory } from "./types";
import { Textarea } from "@/components/ui/textarea";

type StageTodos = Record<string, { id: string; label: string; placeholder?: string }[]>;

// ─── ESTÉTICA ────────────────────────────────────────────────────────────────
const ESTETICA: StageTodos = {
  novo: [
    { id: "pesq_fonte",        label: "Mapear clínica em: Google Maps, Instagram ou iFood Beleza",                           placeholder: "Link do Google Maps / Instagram encontrado..." },
    { id: "pesq_instagram",    label: "Instagram: seguidores, frequência de posts antes/depois, stories ativos",             placeholder: "Ex: 1.2k seguidores, posta 3x/semana, sem stories fixos" },
    { id: "pesq_agendamento",  label: "Identificar sistema de agendamento: Booksy, Fresha, agenda própria ou só WhatsApp",   placeholder: "Sistema identificado: " },
    { id: "pesq_site",         label: "Verificar site: existe? tem botão de agendamento online?",                            placeholder: "URL do site ou 'não possui'" },
    { id: "pesq_google",       label: "Google Business: nota e quantidade de avaliações (mín. 10 reviews)",                  placeholder: "Ex: 4.7⭐ com 38 avaliações" },
    { id: "pesq_whatsapp",     label: "Testar WhatsApp da clínica: tempo de resposta e se há automação",                     placeholder: "Respondeu em Xmin / não respondeu / tem bot" },
    { id: "pesq_servicos",     label: "Identificar serviços principais: depilação, skincare, massagem, estética facial",     placeholder: "Lista de serviços identificados" },
    { id: "pesq_score",        label: "Pontuar ICP: Instagram ativo (+2), sem agendamento online (+2), >100 seg. (+1)",      placeholder: "Pontuação: X/5 — decisão: abordar / descartar" },
  ],
  abordado: [
    { id: "msg_script",        label: "Primeiro contato enviado (script de estética A, B ou C)",           placeholder: "Script usado: A / B / C" },
    { id: "msg_dado",          label: "Mensagem menciona dado real da clínica",                             placeholder: "Dado personalizado usado na mensagem" },
    { id: "horario_certo",     label: "Enviado seg-sex, janela 9-11h ou 15-17h",                           placeholder: "Horário de envio: " },
    { id: "followup_agendado", label: "Follow-up D+2 agendado no calendário",                              placeholder: "Data/hora do follow-up agendado" },
  ],
  em_cadencia: [
    { id: "fu1_enviado",   label: "FU1 D+2 — ângulo: clientes que saem sem reagendar",  placeholder: "Observações do FU1" },
    { id: "fu2_enviado",   label: "FU2 D+5 — ângulo: concorrente da região já usa",     placeholder: "Observações do FU2" },
    { id: "fu3_enviado",   label: "FU3 D+10 — ângulo: encerramento + condição especial",placeholder: "Observações do FU3" },
    { id: "sem_resposta",  label: "Sem resposta após D+10? Mover para Frio",             placeholder: "Motivo / próxima reativação em: " },
  ],
  respondeu: [
    { id: "objecao_mapeada",  label: "Objeção identificada",              placeholder: "Objeção: 'já tenho sistema' / 'não tenho tempo' / 'caro' / outra" },
    { id: "reuniao_proposta", label: "Demo proposta com data e formato",   placeholder: "Data/hora proposta e formato (WhatsApp vídeo / presencial)" },
    { id: "resposta_objecao", label: "Resposta à objeção enviada",         placeholder: "Resumo da resposta dada" },
  ],
  call_agendada: [
    { id: "demo_preparada",    label: "Demo preparada com case de clínica similar",    placeholder: "Case usado na demo" },
    { id: "lembrete_enviado",  label: "Lembrete enviado 1 dia antes",                 placeholder: "Confirmou presença? Sim / Não" },
    { id: "roteiro_revisado",  label: "Roteiro 20min revisado: dor → demo → preço",   placeholder: "Ajustes feitos no roteiro" },
    { id: "numeros_ok",        label: "Números atualizados: % no-show, clientes recuperados", placeholder: "Números usados na apresentação" },
  ],
  call_realizada: [
    { id: "dor_mapeada",       label: "Dor principal identificada",        placeholder: "Dor: no-show / perda de lead / sem follow-up pós-procedimento" },
    { id: "demo_feita",        label: "Demo ao vivo realizada",            placeholder: "Reação do prospect à demo" },
    { id: "preco_apresentado", label: "Preço apresentado vs. alternativas",placeholder: "Como reagiu ao preço?" },
    { id: "objecao_pos_call",  label: "Objeção pós-call registrada",       placeholder: "Objeção levantada após a call" },
    { id: "data_resposta",     label: "Data de resposta confirmada",        placeholder: "Resposta prevista para: " },
  ],
  proposta_enviada: [
    { id: "proposta_ok",      label: "Proposta enviada em até 2h",            placeholder: "Link da proposta ou formato enviado" },
    { id: "followup_24h",     label: "Follow-up de 24h enviado se sem resposta", placeholder: "Resposta obtida no follow-up?" },
    { id: "condicao_expira",  label: "Condição especial com data de expiração", placeholder: "Condição e prazo comunicados" },
    { id: "contrato_pronto",  label: "Contrato preparado para envio imediato",  placeholder: "Status do contrato" },
  ],
  quente: [
    { id: "urgencia_criada",   label: "Urgência criada: 'temos 2 vagas no seu bairro'", placeholder: "Urgência usada" },
    { id: "objecao_final",     label: "Última objeção respondida",                       placeholder: "Objeção final e como foi respondida" },
    { id: "contrato_enviado",  label: "Contrato enviado para assinatura digital",         placeholder: "Plataforma de assinatura usada" },
  ],
  fechado: [
    { id: "setup_pago",          label: "Setup recebido",                     placeholder: "Valor recebido e forma de pagamento" },
    { id: "onboarding_agendado", label: "Onboarding agendado (D+1 após setup)", placeholder: "Data/hora do onboarding" },
    { id: "briefing_enviado",    label: "Briefing enviado: serviços, horários, tom de voz", placeholder: "Briefing enviado via: " },
    { id: "integracao_agenda",   label: "Integração com agenda configurada",  placeholder: "Sistema integrado: Booksy / Fresha / outro" },
    { id: "indicacao_pedida",    label: "Pedido de indicação após 30 dias",   placeholder: "Indicações obtidas" },
  ],
  frio: [
    { id: "reativ_45d",  label: "Reativação 45 dias: case de clínica similar na mesma cidade", placeholder: "Case usado na reativação" },
    { id: "reativ_90d",  label: "Reativação 90 dias: nova funcionalidade ou sazonalidade",     placeholder: "Ângulo usado" },
    { id: "reativ_135d", label: "Reativação 135 dias: clínica concorrente já usa o sistema",   placeholder: "Resultado obtido" },
  ],
};

// ─── REVENDAS / VS AUTO ───────────────────────────────────────────────────────
const REVENDAS: StageTodos = {
  novo: [
    { id: "pesq_fonte",    label: "Mapear loja em: OLX Autos, WebMotors, IcarroDB ou Instagram", placeholder: "Fonte e link da loja" },
    { id: "pesq_estoque",  label: "Contar estoque online: mín. 10 veículos para prosseguir",      placeholder: "Qtd de veículos no estoque online" },
    { id: "pesq_instagram",label: "Instagram: seguidores, frequência de posts, qualidade das fotos", placeholder: "Seguidores / freq. de posts" },
    { id: "pesq_site",     label: "Verificar site: existe? tem WhatsApp click? tem formulário?",  placeholder: "URL do site ou 'não possui'" },
    { id: "pesq_whatsapp", label: "Testar WhatsApp da loja: responde em < 30min? tem bot?",       placeholder: "Tempo de resposta / tem bot?" },
    { id: "pesq_sistema",  label: "Identificar sistema atual: Autocerto, Revenda Mais ou planilha", placeholder: "Sistema atual identificado" },
    { id: "pesq_portais",  label: "Quantos portais usa? (OLX, WebMotors, AutoLine, Volanty…)",   placeholder: "Portais utilizados" },
    { id: "pesq_score",    label: "Pontuar ICP — mín. 5pts para abordar",                         placeholder: "Pontuação: X/10 — decisão: abordar / descartar" },
  ],
  abordado: [
    { id: "msg_script",        label: "Primeiro contato enviado (Script A: frio / B: indicação / C: já tem sistema)", placeholder: "Script usado: A / B / C" },
    { id: "msg_personalizada", label: "Mensagem menciona dado real da loja",   placeholder: "Dado personalizado usado" },
    { id: "horario_certo",     label: "Enviado ter-qui, janela 9-11h ou 14-16h", placeholder: "Horário de envio" },
    { id: "followup_agendado", label: "Follow-up D+2 agendado no calendário",  placeholder: "Data do follow-up" },
  ],
  em_cadencia: [
    { id: "fu1_enviado",  label: "FU1 D+2 — case de loja da região",              placeholder: "Case usado" },
    { id: "fu2_enviado",  label: "FU2 D+5 — custo de perder lead fora do horário",placeholder: "Resultado" },
    { id: "fu3_enviado",  label: "FU3 D+10 — vagas limitadas na região",          placeholder: "Resultado" },
    { id: "sem_resposta", label: "Sem resposta após D+10? Mover para Frio",       placeholder: "Próxima reativação: " },
  ],
  respondeu: [
    { id: "objecao_mapeada",  label: "Objeção principal identificada",   placeholder: "Objeção: " },
    { id: "reuniao_proposta", label: "Reunião proposta com data e formato", placeholder: "Data / formato" },
    { id: "resposta_objecao", label: "Resposta à objeção enviada",        placeholder: "Resumo da resposta" },
  ],
  call_agendada: [
    { id: "demo_preparada",   label: "Demo ao vivo preparada com case do Vale do Paraíba", placeholder: "Ajustes na demo" },
    { id: "lembrete_enviado", label: "Lembrete enviado 1 dia antes da reunião",            placeholder: "Confirmou presença?" },
    { id: "roteiro_revisado", label: "Roteiro de 20 minutos revisado",                     placeholder: "Ajustes feitos" },
    { id: "numeros_ok",       label: "Números: 60+ carros atendidos, 65% redução custo",  placeholder: "Números usados" },
  ],
  call_realizada: [
    { id: "dor_mapeada",       label: "Dor principal mapeada",             placeholder: "Dor: leads fora do horário / dependência de vendedor / custo de mídia" },
    { id: "demo_feita",        label: "Demo ao vivo realizada",            placeholder: "Reação do prospect" },
    { id: "preco_apresentado", label: "Preço apresentado: R$1.497/mês vs. agência + vendedor", placeholder: "Como reagiu ao preço?" },
    { id: "objecao_pos_call",  label: "Objeção pós-call registrada",       placeholder: "Objeção" },
    { id: "data_fechamento",   label: "Data de resposta confirmada",        placeholder: "Resposta prevista para: " },
  ],
  proposta_enviada: [
    { id: "proposta_ok",     label: "Proposta enviada em até 2h (ROI calculado)",   placeholder: "Link / formato enviado" },
    { id: "followup_24h",    label: "Follow-up de 24h se sem resposta",              placeholder: "Resposta obtida?" },
    { id: "condicao_expira", label: "Condição especial com data de expiração",       placeholder: "Condição e prazo" },
    { id: "contrato_pronto", label: "Contrato pronto para envio imediato no aceite", placeholder: "Status" },
  ],
  quente: [
    { id: "urgencia_criada",  label: "Urgência criada: setup especial ou vaga exclusiva", placeholder: "Urgência usada" },
    { id: "objecao_final",    label: "Última objeção respondida",                         placeholder: "Objeção final e resposta" },
    { id: "contrato_enviado", label: "Contrato enviado para assinatura",                   placeholder: "Status da assinatura" },
  ],
  fechado: [
    { id: "setup_pago",          label: "Setup recebido",                     placeholder: "Valor e forma de pagamento" },
    { id: "onboarding_agendado", label: "Onboarding agendado (D+1 após setup)", placeholder: "Data/hora" },
    { id: "briefing_enviado",    label: "Briefing enviado: marcas, preço médio, diferenciais", placeholder: "Enviado via:" },
    { id: "indicacao_pedida",    label: "Pedido de indicação após 30 dias",    placeholder: "Indicações obtidas" },
  ],
  frio: [
    { id: "reativ_45d",  label: "Reativação 45 dias: resultado de loja similar na região", placeholder: "Case usado" },
    { id: "reativ_90d",  label: "Reativação 90 dias: mudança de contexto",                 placeholder: "Ângulo usado" },
    { id: "reativ_135d", label: "Reativação 135 dias: concorrente fechou com VS AUTO",      placeholder: "Resultado" },
  ],
};

// ─── GENÉRICO ─────────────────────────────────────────────────────────────────
const GENERICO: StageTodos = {
  novo: [
    { id: "pesq_contato",  label: "Verificar e confirmar dados de contato", placeholder: "WhatsApp confirmado / email" },
    { id: "pesq_online",   label: "Verificar presença online",              placeholder: "Instagram / site / Google Business" },
    { id: "pesq_dor",      label: "Mapear dor provável do segmento",        placeholder: "Dor mapeada: " },
    { id: "pesq_score",    label: "Pontuar ICP e decidir se é viável abordar", placeholder: "Score: X — decisão: " },
  ],
  abordado: [
    { id: "msg_enviada",       label: "Primeiro contato enviado com mensagem personalizada", placeholder: "Dado personalizado usado" },
    { id: "followup_agendado", label: "Follow-up D+2 agendado",                             placeholder: "Data do follow-up" },
  ],
  em_cadencia: [
    { id: "fu1_enviado", label: "Follow-up 1 (D+2) enviado", placeholder: "Resultado" },
    { id: "fu2_enviado", label: "Follow-up 2 (D+5) enviado", placeholder: "Resultado" },
    { id: "fu3_enviado", label: "Follow-up 3 (D+10) enviado — encerrar se sem resposta", placeholder: "Decisão" },
  ],
  respondeu: [
    { id: "objecao_mapeada",  label: "Objeção principal identificada", placeholder: "Objeção: " },
    { id: "reuniao_proposta", label: "Reunião proposta com data definida", placeholder: "Data / formato" },
  ],
  call_agendada: [
    { id: "demo_preparada",   label: "Demo ou apresentação preparada", placeholder: "Ajustes feitos" },
    { id: "lembrete_enviado", label: "Lembrete enviado 1 dia antes",   placeholder: "Confirmou?" },
  ],
  call_realizada: [
    { id: "dor_mapeada",       label: "Dor principal mapeada",              placeholder: "Dor: " },
    { id: "preco_apresentado", label: "Preço e proposta de valor apresentados", placeholder: "Reação ao preço" },
    { id: "data_resposta",     label: "Data de resposta confirmada",          placeholder: "Resposta prevista para: " },
  ],
  proposta_enviada: [
    { id: "proposta_ok",  label: "Proposta enviada em até 2h",                      placeholder: "Formato enviado" },
    { id: "followup_24h", label: "Follow-up de 24h enviado se sem resposta",        placeholder: "Resultado" },
  ],
  quente: [
    { id: "urgencia_criada",  label: "Urgência ou condição especial comunicada", placeholder: "Urgência usada" },
    { id: "contrato_enviado", label: "Contrato enviado para assinatura",          placeholder: "Status" },
  ],
  fechado: [
    { id: "onboarding_agendado", label: "Onboarding agendado",                   placeholder: "Data/hora" },
    { id: "briefing_enviado",    label: "Briefing ou formulário de início enviado", placeholder: "Enviado via:" },
    { id: "indicacao_pedida",    label: "Pedido de indicação após 30 dias",       placeholder: "Indicações obtidas" },
  ],
  frio: [
    { id: "reativ_45d",  label: "Reativação 45 dias: novo ângulo ou resultado recente", placeholder: "Ângulo" },
    { id: "reativ_90d",  label: "Reativação 90 dias: mudança de contexto",              placeholder: "Ângulo" },
    { id: "reativ_135d", label: "Reativação 135 dias: última tentativa",                placeholder: "Resultado" },
  ],
};

const PLAYBOOKS: Record<string, StageTodos> = { estetica: ESTETICA, revendas: REVENDAS };

const DEFAULT_STAGE_TODOS = [
  { id: "verificar_dados", label: "Verificar dados de contato", placeholder: "Dados verificados" },
  { id: "definir_proximo", label: "Definir próxima ação",       placeholder: "Próxima ação: " },
];

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  stage: string;
  nota?: string;
}

interface Props {
  prospect: Prospect;
  onUpdate: (updated: Partial<Prospect>) => void;
  onClassifyICP?: () => void;
  loadingClassify?: boolean;
}

export function ChecklistEtapa({ prospect, onUpdate, onClassifyICP, loadingClassify }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notaTemp, setNotaTemp] = useState<Record<string, string>>({});

  const cat = nichoCategory(prospect.nicho ?? "");
  const playbook: StageTodos = cat && PLAYBOOKS[cat.key] ? PLAYBOOKS[cat.key] : GENERICO;
  const stageKey = prospect.status;
  const stageTodos = playbook[stageKey] ?? DEFAULT_STAGE_TODOS;

  const savedChecklist: ChecklistItem[] = (() => {
    try {
      const raw = (prospect as any).checklist_etapa;
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  const items: (ChecklistItem & { placeholder?: string })[] = stageTodos.map(todo => {
    const saved = savedChecklist.find(s => s.id === todo.id);
    return {
      id: todo.id,
      label: todo.label,
      placeholder: todo.placeholder,
      done: saved?.done ?? false,
      stage: stageKey,
      nota: saved?.nota ?? "",
    };
  });

  const doneCount = items.filter(i => i.done).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const persist = async (newChecklist: ChecklistItem[]) => {
    const { error } = await supabase
      .from("consultoria_prospects")
      .update({ checklist_etapa: newChecklist } as any)
      .eq("id", prospect.id);
    if (error) throw error;
    onUpdate({ checklist_etapa: newChecklist } as any);
  };

  const handleToggle = async (itemId: string, currentDone: boolean) => {
    setSaving(itemId);
    try {
      const otherStageItems = savedChecklist.filter(s => s.stage !== stageKey);
      const updatedStageItems = items.map(item => ({
        id: item.id, label: item.label, done: item.id === itemId ? !currentDone : item.done,
        stage: stageKey, nota: notaTemp[item.id] ?? item.nota ?? "",
      }));
      await persist([...otherStageItems, ...updatedStageItems]);
      // If marking done, expand to show nota field
      if (!currentDone) setExpanded(itemId);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveNota = async (itemId: string) => {
    setSaving(itemId);
    try {
      const otherStageItems = savedChecklist.filter(s => s.stage !== stageKey);
      const updatedStageItems = items.map(item => ({
        id: item.id, label: item.label, done: item.done, stage: stageKey,
        nota: item.id === itemId ? (notaTemp[itemId] ?? item.nota ?? "") : (notaTemp[item.id] ?? item.nota ?? ""),
      }));
      await persist([...otherStageItems, ...updatedStageItems]);
      setExpanded(null);
    } catch (err: any) {
      toast({ title: "Erro ao salvar nota", description: err.message, variant: "destructive" });
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
        <span className="text-[10px] text-muted-foreground">{doneCount}/{items.length}</span>
      </div>

      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-1">
        {items.map(item => {
          const isExpanded = expanded === item.id;
          const currentNota = notaTemp[item.id] ?? item.nota ?? "";
          return (
            <div key={item.id} className={`rounded-md transition-colors ${item.done ? "bg-success/5" : "hover:bg-secondary/40"}`}>
              {/* Row: checkbox + label + expand toggle */}
              <div className="flex items-start gap-2 p-2">
                <button
                  onClick={() => handleToggle(item.id, item.done)}
                  disabled={saving === item.id}
                  className="shrink-0 mt-0.5 group"
                >
                  {item.done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  }
                </button>

                <button
                  className="flex-1 text-left"
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                >
                  <span className={`text-[11px] leading-relaxed ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.label}
                  </span>
                  {currentNota && !isExpanded && (
                    <p className="text-[10px] text-primary/70 mt-0.5 italic truncate">{currentNota}</p>
                  )}
                </button>

                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="shrink-0 mt-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {isExpanded
                    ? <ChevronUp className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />
                  }
                </button>
              </div>

              {/* Expanded: nota capture */}
              {isExpanded && (
                <div className="px-2 pb-2 space-y-1.5">
                  {/* ICP: IA auto-score button */}
                  {item.id === "pesq_score" && onClassifyICP && (
                    <button
                      onClick={() => { onClassifyICP(); setExpanded(null); }}
                      disabled={loadingClassify}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] rounded-md border border-primary/40 bg-primary/10 text-primary px-2 py-1.5 hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {loadingClassify
                        ? <><Loader2 className="h-3 w-3 animate-spin" />Analisando ICP...</>
                        : <>✦ Calcular ICP com IA (recomendado)</>
                      }
                    </button>
                  )}
                  <Textarea
                    value={currentNota}
                    onChange={e => setNotaTemp(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder={item.placeholder ?? "Registre dados coletados nesta etapa..."}
                    rows={2}
                    className="text-[11px] resize-none bg-background/60"
                    autoFocus={item.id !== "pesq_score"}
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => setExpanded(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveNota(item.id)}
                      disabled={saving === item.id}
                      className="text-[10px] bg-primary text-primary-foreground px-2.5 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Salvar nota
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-3">Nenhum checklist para esta etapa.</p>
      )}
    </div>
  );
}
