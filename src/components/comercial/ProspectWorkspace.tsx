import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Send, Sparkles, Loader2, BrainCircuit, CheckCircle2, XCircle,
  X, Phone, MapPin, Instagram, Globe, User,
  Megaphone, PlayCircle, RotateCcw, ChevronRight, Copy,
  AlertTriangle, Target, Lightbulb, ArrowRight, Zap, MessageSquare, RefreshCw,
} from "lucide-react";
import { StickyNote, Plus, Trash2, Clock } from "lucide-react";
import { Prospect, PIPELINE_STAGES, classificacaoConfig, scoreColor, timeAgo } from "./types";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  prospect: Prospect | null;
  onClose: () => void;
  onProspectUpdate: (updated: Partial<Prospect>) => void;
  onAbordar?: (prospect: Prospect) => Promise<void>;
  onCadencia?: (prospect: Prospect) => Promise<void>;
  onReativar?: (prospect: Prospect) => Promise<void>;
  loadingAbordar?: boolean;
  loadingCadencia?: boolean;
  loadingReativar?: boolean;
}

interface AiCoaching {
  sugestao: string;
  intent: string;
  phase: string;
  phase_label: string;
  phase_desc: string;
  active_script: string;
  script_content: string;
  insights: string[];
  proximo_passo: string;
  alerta: string;
  tom_recomendado: string;
}

export function ProspectWorkspace({
  prospect, onClose, onProspectUpdate,
  onAbordar, onCadencia, onReativar,
  loadingAbordar, loadingCadencia, loadingReativar,
}: Props) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [mensagem, setMensagem] = useState("");
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingClassify, setLoadingClassify] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [coaching, setCoaching] = useState<AiCoaching | null>(null);
  const [lastInboundId, setLastInboundId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "ai" | "acoes">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSyncedProspectRef = useRef<string | null>(null);
  const [novaNota, setNovaNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  const { data: conversas, refetch: refetchConversas } = useQuery({
    queryKey: ["conversas", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_conversas").select("*")
        .eq("prospect_id", prospect!.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: cadenciaHistory } = useQuery({
    queryKey: ["cadencia-history", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_cadencia").select("*")
        .eq("prospect_id", prospect!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sessionMemory } = useQuery({
    queryKey: ["session-memory", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_session_memory").select("*")
        .eq("prospect_id", prospect!.id).order("extracted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: meddic } = useQuery({
    queryKey: ["meddic", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_meddic").select("*")
        .eq("prospect_id", prospect!.id).order("pilar");
      if (error) throw error;
      return data;
    },
  });

  const { data: notas, refetch: refetchNotas } = useQuery({
    queryKey: ["prospect-notas", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_notas" as any).select("*")
        .eq("prospect_id", prospect!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleAddNota = async () => {
    if (!prospect || !novaNota.trim()) return;
    setSavingNota(true);
    try {
      const { error } = await supabase.from("prospect_notas" as any).insert({
        prospect_id: prospect.id,
        conteudo: novaNota.trim(),
        tipo: "nota",
        autor: null,
      } as any);
      if (error) throw error;
      setNovaNota("");
      refetchNotas();
      toast({ title: "Nota salva" });
    } catch (err: unknown) {
      toast({ title: "Erro ao salvar nota", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSavingNota(false);
    }
  };

  const handleDeleteNota = async (notaId: string) => {
    const { error } = await supabase.from("prospect_notas" as any).delete().eq("id", notaId);
    if (!error) {
      refetchNotas();
      toast({ title: "Nota removida" });
    }
  };

  // Auto-suggest with rate-limit retry
  const suggestRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerAutoSuggest = useCallback(async (retryCount = 0) => {
    if (!prospect) return;
    if (suggestRetryRef.current) { clearTimeout(suggestRetryRef.current); suggestRetryRef.current = null; }
    setLoadingSuggest(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-reply", {
        body: { prospect_id: prospect.id },
      });
      if (error) {
        const status = (error as any)?.status;
        if (status === 429) throw { status: 429 };
        if (status === 402) throw { status: 402 };
        throw error;
      }
      if (data?.error) {
        if (data.error.includes?.("Rate limit")) throw { status: 429 };
        if (data.error.includes?.("Créditos") || data.error.includes?.("402")) throw { status: 402 };
      }
      if (data?.sugestao) {
        setCoaching({
          sugestao: data.sugestao,
          intent: data.intent ?? "padrao",
          phase: data.phase ?? "unknown",
          phase_label: data.phase_label ?? "—",
          phase_desc: data.phase_desc ?? "",
          active_script: data.active_script ?? "",
          script_content: data.script_content ?? "",
          insights: data.insights ?? [],
          proximo_passo: data.proximo_passo ?? "",
          alerta: data.alerta ?? "",
          tom_recomendado: data.tom_recomendado ?? "",
        });
      }
    } catch (err: any) {
      if (err?.status === 402) {
        toast({ title: "Créditos de IA esgotados", description: "Adicione créditos em Settings > Workspace > Usage.", variant: "destructive" });
      } else if (err?.status === 429 && retryCount < 2) {
        const delay = (retryCount + 1) * 5000;
        toast({ title: "IA ocupada", description: `Tentando novamente em ${delay / 1000}s...` });
        suggestRetryRef.current = setTimeout(() => triggerAutoSuggest(retryCount + 1), delay);
        return;
      } else if (err?.status === 429) {
        toast({ title: "Limite de requisições atingido", description: "Aguarde alguns segundos e tente novamente.", variant: "destructive" });
      }
    } finally {
      setLoadingSuggest(false);
    }
  }, [prospect]);

  // Realtime — auto-suggest on new inbound
  useEffect(() => {
    if (!prospect?.id) return;
    const channel = supabase
      .channel(`conversas:${prospect.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "consultoria_conversas",
        filter: `prospect_id=eq.${prospect.id}`,
      }, (payload) => {
        refetchConversas();
        queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
        const newMsg = payload.new as { direcao?: string; id?: string };
        if (newMsg.direcao === "entrada" && newMsg.id !== lastInboundId) {
          setLastInboundId(newMsg.id ?? null);
          triggerAutoSuggest();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prospect?.id, refetchConversas, queryClient, triggerAutoSuggest, lastInboundId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversas]);

  // Mark as read
  useEffect(() => {
    if (!prospect?.id) return;
    supabase.from("consultoria_conversas")
      .update({ processado_ia: true })
      .eq("prospect_id", prospect.id)
      .eq("direcao", "entrada")
      .eq("processado_ia", false)
      .then(() => queryClient.invalidateQueries({ queryKey: ["unread-counts"] }));
  }, [prospect?.id, queryClient]);

  // ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Initial auto-suggest
  useEffect(() => {
    if (!prospect?.id || !conversas) return;
    const lastInbound = [...conversas].reverse().find(m => m.direcao === "entrada");
    if (lastInbound && !coaching && !loadingSuggest) {
      triggerAutoSuggest();
    }
  }, [prospect?.id, conversas?.length, coaching, loadingSuggest, triggerAutoSuggest]);

  useEffect(() => {
    if (!prospect?.id) return;
    if (lastSyncedProspectRef.current === prospect.id) return;
    lastSyncedProspectRef.current = prospect.id;
    handleSyncMessages(false);
  }, [prospect?.id]);

  const handleSuggestReply = async () => {
    triggerAutoSuggest(0);
  };

  const handleUseSuggestion = () => {
    if (coaching) {
      setMensagem(coaching.sugestao);
    }
  };

  const handleClassify = async () => {
    if (!prospect) return;
    setLoadingClassify(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-prospect", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      if (data?.result) {
        queryClient.invalidateQueries({ queryKey: ["prospects"] });
        onProspectUpdate({
          classificacao_ia: data.result.classificacao,
          score_qualificacao: data.result.score,
          resumo_conversa: data.result.resumo,
        });
        toast({ title: `${data.result.classificacao.toUpperCase()} — Score ${data.result.score}/100`, description: data.result.motivo });
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao classificar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingClassify(false);
    }
  };

  const handleSendMessage = async () => {
    if (!prospect || !mensagem.trim()) return;
    setLoadingSend(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { prospect_id: prospect.id, mensagem: mensagem.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        setMensagem("");
        refetchConversas();
        toast({ title: "Mensagem enviada!" });
        setTimeout(triggerAutoSuggest, 2000);
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao enviar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingSend(false);
    }
  };

  const handleSyncMessages = async (showToast = true) => {
    if (!prospect?.id) return;
    setLoadingSync(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-whatsapp-messages", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      await refetchConversas();
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
      if (showToast) {
        toast({ title: `Sincronização concluída`, description: `${data?.synced ?? 0} mensagens importadas.` });
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao sincronizar WhatsApp", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingSync(false);
    }
  };

  const handleMoveStatus = async (status: string) => {
    if (!prospect) return;
    const { error } = await supabase.from("consultoria_prospects").update({ status }).eq("id", prospect.id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      onProspectUpdate({ status });
      toast({ title: `Movido para ${PIPELINE_STAGES.find(s => s.key === status)?.label}` });
    }
  };

  if (!prospect) return null;

  const classif = classificacaoConfig(prospect.classificacao_ia);
  const stageObj = PIPELINE_STAGES.find(s => s.key === prospect.status);

  const INTENT_LABELS: Record<string, string> = {
    preco: "💰 Preço", concorrente: "🏢 Concorrente", ceticismo: "🤔 Ceticismo",
    objecao: "🛑 Objeção", interesse: "🟢 Interesse", padrao: "💬 Padrão",
  };

  const PHASE_ICONS: Record<string, React.ReactNode> = {
    abordagem: <Megaphone className="h-3.5 w-3.5" />,
    abertura: <Send className="h-3.5 w-3.5" />,
    diagnostico: <BrainCircuit className="h-3.5 w-3.5" />,
    proposta: <Target className="h-3.5 w-3.5" />,
    pre_call: <Phone className="h-3.5 w-3.5" />,
    fechamento: <CheckCircle2 className="h-3.5 w-3.5" />,
    follow_up: <ArrowRight className="h-3.5 w-3.5" />,
    reativacao: <RotateCcw className="h-3.5 w-3.5" />,
    ultimo_contato: <XCircle className="h-3.5 w-3.5" />,
  };

  // ─── Render ────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-in fade-in-0 duration-200">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{prospect.nome_negocio.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{prospect.nome_negocio}</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />{prospect.cidade}
              <span className="hidden sm:inline opacity-30">·</span>
              <span className="hidden sm:inline">{prospect.nicho}</span>
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {prospect.classificacao_ia && (
            <Badge className={`text-[10px] ${classif.bg}`}>{classif.icon} {classif.label}</Badge>
          )}
          {prospect.score_qualificacao !== null && (
            <span className={`text-xs font-bold tabular ${scoreColor(prospect.score_qualificacao)}`}>{prospect.score_qualificacao}/100</span>
          )}
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${stageObj?.color}`} />
            <span className="text-[10px] font-medium">{stageObj?.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-muted-foreground" onClick={() => handleSyncMessages(true)} disabled={loadingSync}>
            {loadingSync ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
          <a href={`https://wa.me/${prospect.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
            <Phone className="h-3.5 w-3.5" /><span className="hidden sm:inline">WhatsApp</span>
          </a>
          <div className="h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Mobile tab switcher */}
      {isMobile && (
        <div className="flex border-b border-border bg-card/50 shrink-0">
          {[
            { key: "chat" as const, label: "Chat", icon: <MessageSquare className="h-3.5 w-3.5" /> },
            { key: "ai" as const, label: "IA Coach", icon: <Sparkles className="h-3.5 w-3.5" /> },
            { key: "acoes" as const, label: "Ações", icon: <Zap className="h-3.5 w-3.5" /> },
          ].map(t => (
            <button key={t.key} onClick={() => setMobileTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                mobileTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}>
              {t.icon}{t.label}
              {t.key === "ai" && loadingSuggest && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
          ))}
        </div>
      )}

      {/* ── Main: 3 columns on desktop ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Chat (always visible on desktop, tab on mobile) */}
        <div className={`flex-1 flex flex-col border-r border-border min-w-0 min-h-0 ${isMobile && mobileTab !== "chat" ? "hidden" : ""}`}>
          <ScrollArea className="flex-1 px-3 sm:px-5 py-3" ref={scrollRef}>
            <div className="max-w-2xl mx-auto space-y-3">
              {conversas?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <MessageBubbleEmpty />
                  <p className="text-sm mt-3">Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1">Inicie a conversa com uma abordagem ou mensagem manual</p>
                </div>
              )}
              {conversas?.map(msg => (
                <div key={msg.id} className={`flex ${msg.direcao === "saida" ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] sm:max-w-[75%] ${
                    msg.direcao === "saida"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  }`}>
                    <p className="text-[10px] opacity-50 mb-1">
                      {msg.direcao === "saida" ? "Você" : prospect.nome_negocio} · {new Date(msg.created_at!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                  </div>
                </div>
              ))}
              {(loadingSuggest || loadingSend) && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border px-3 sm:px-5 py-2.5 bg-card/50 shrink-0">
            <div className="max-w-2xl mx-auto space-y-2">
              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Digite uma mensagem... (Ctrl+Enter para enviar)"
                className="min-h-[56px] max-h-[100px] resize-none text-sm bg-background"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="text-xs h-8 flex-1" onClick={handleSuggestReply} disabled={loadingSuggest}>
                  {loadingSuggest ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Atualizar IA
                </Button>
                <Button className="text-xs h-8 flex-1" onClick={handleSendMessage} disabled={loadingSend || !mensagem.trim()}>
                  {loadingSend ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: AI Copilot Panel */}
        <div className={`w-full md:w-[340px] lg:w-[380px] shrink-0 flex flex-col min-h-0 overflow-hidden border-r border-border bg-gradient-to-b from-primary/[0.02] to-transparent ${isMobile && mobileTab !== "ai" ? "hidden" : ""}`}>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Phase indicator */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  {PHASE_ICONS[coaching?.phase ?? ""] ?? <ArrowRight className="h-3.5 w-3.5" />}
                  <span className="text-xs font-semibold text-primary">{coaching?.phase_label ?? "Analisando..."}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {coaching?.phase_desc ?? "Clique em 'Atualizar IA' para iniciar o coaching em tempo real."}
                </p>
              </div>

              {/* Active script */}
              {coaching?.active_script && (
                <div className="rounded-xl border border-border p-3.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Megaphone className="h-3 w-3" />Script Ativo
                  </h4>
                  <p className="text-xs font-medium text-foreground mb-1">{coaching.active_script}</p>
                  {coaching.script_content && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
                      {coaching.script_content.replace(/^(Scripts|Follow-up \w+):\n?/, "")}
                    </p>
                  )}
                </div>
              )}

              {/* Intent + Tone */}
              {coaching && (
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-border p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Intenção</p>
                    <p className="text-xs font-medium">{INTENT_LABELS[coaching.intent] ?? coaching.intent}</p>
                  </div>
                  {coaching.tom_recomendado && (
                    <div className="flex-1 rounded-lg border border-border p-2.5 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Tom</p>
                      <p className="text-[11px] font-medium truncate">{coaching.tom_recomendado}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Alert */}
              {coaching?.alerta && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">{coaching.alerta}</p>
                </div>
              )}

              {/* Insights */}
              {coaching?.insights && coaching.insights.length > 0 && (
                <div className="rounded-xl border border-border p-3.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3" />Insights
                  </h4>
                  <div className="space-y-1.5">
                    {coaching.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        <p className="text-[11px] text-foreground/80 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next step */}
              {coaching?.proximo_passo && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3.5">
                  <h4 className="text-[11px] font-semibold text-green-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Target className="h-3 w-3" />Próximo Passo
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">{coaching.proximo_passo}</p>
                </div>
              )}

              {/* Suggested message */}
              {coaching?.sugestao && (
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />Mensagem Sugerida
                    </h4>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleSuggestReply} disabled={loadingSuggest}>
                      {loadingSuggest ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    </Button>
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed mb-3">
                    {coaching.sugestao}
                  </p>
                  <Button size="sm" className="w-full text-xs h-8 gap-1.5" onClick={handleUseSuggestion}>
                    <Copy className="h-3 w-3" />Usar esta mensagem
                  </Button>
                </div>
              )}

              {/* Loading state */}
              {loadingSuggest && !coaching && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm font-medium">Analisando conversa...</p>
                  <p className="text-xs mt-1">A IA está preparando o coaching</p>
                </div>
              )}

              {/* Empty state */}
              {!coaching && !loadingSuggest && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BrainCircuit className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">IA Coach</p>
                  <p className="text-xs mt-1 text-center px-4">
                    O coaching será ativado automaticamente quando o lead responder, ou clique em "Atualizar IA"
                  </p>
                  <Button size="sm" variant="outline" className="mt-3 text-xs gap-1.5" onClick={handleSuggestReply}>
                    <Sparkles className="h-3.5 w-3.5" />Ativar Coaching
                  </Button>
                </div>
              )}

              {/* MEDDIC mini */}
              {meddic && meddic.length > 0 && (
                <div className="rounded-xl border border-border p-3.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">MEDDIC</h4>
                  <div className="space-y-1.5">
                    {meddic.map(m => (
                      <div key={m.id} className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground uppercase">{m.pilar}</span>
                        <span className={`text-[11px] font-bold tabular ${m.score >= 7 ? "text-green-400" : m.score >= 4 ? "text-amber-400" : "text-red-400"}`}>
                          {m.score}/10
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Session memory mini */}
              {sessionMemory && sessionMemory.length > 0 && (
                <div className="rounded-xl border border-border p-3.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fatos Extraídos</h4>
                  <div className="space-y-1">
                    {sessionMemory.slice(0, 6).map(f => (
                      <div key={f.id} className="flex items-start gap-1.5">
                        <ChevronRight className="h-2.5 w-2.5 text-primary mt-1 shrink-0" />
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">{f.fact_key}:</span> {f.fact_value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Actions Panel */}
        <div className={`w-full md:w-[300px] lg:w-[320px] shrink-0 flex flex-col min-h-0 overflow-hidden bg-card/30 ${isMobile && mobileTab !== "acoes" ? "hidden" : ""}`}>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Quick Actions */}
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações Rápidas</h3>
                <div className="space-y-1.5">
                  {prospect.status === "novo" && onAbordar && (
                    <ActionButton icon={<Megaphone className="h-4 w-4" />} label="Enviar Abordagem" desc="Script automático via WhatsApp" loading={loadingAbordar} onClick={() => onAbordar(prospect)} />
                  )}
                  {["abordado", "respondeu"].includes(prospect.status) && onCadencia && (
                    <ActionButton icon={<PlayCircle className="h-4 w-4" />} label="Iniciar Cadência" desc="Sequência de follow-ups" loading={loadingCadencia} onClick={() => onCadencia(prospect)} />
                  )}
                  {prospect.status === "frio" && onReativar && (
                    <ActionButton icon={<RotateCcw className="h-4 w-4" />} label="Reativar Lead" desc="Volta para cadência D1" loading={loadingReativar} onClick={() => onReativar(prospect)} />
                  )}
                  <ActionButton icon={<BrainCircuit className="h-4 w-4" />} label="Classificar com IA" desc="Analisa e classifica o lead" loading={loadingClassify} onClick={handleClassify} />
                </div>
              </div>

              {/* Move Stage */}
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mover Etapa</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {PIPELINE_STAGES.map(s => (
                    <button key={s.key} onClick={() => handleMoveStatus(s.key)} disabled={s.key === prospect.status}
                      className={`flex items-center gap-2 text-xs text-left rounded-lg border p-2 transition-colors ${
                        s.key === prospect.status
                          ? "border-primary/40 bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/30 hover:bg-primary/5"
                      }`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                      <span className="truncate text-[11px]">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalhes</h3>
                <div className="rounded-lg border border-border divide-y divide-border">
                  <DetailRow label="WhatsApp" value={prospect.whatsapp} />
                  <DetailRow label="Responsável" value={prospect.responsavel} />
                  <DetailRow label="Origem" value={prospect.origem || "—"} />
                  <DetailRow label="Faturamento" value={prospect.faturamento_estimado || "—"} />
                  <DetailRow label="Script" value={prospect.script_usado || "—"} />
                  <DetailRow label="Abordagem" value={prospect.data_abordagem ? new Date(prospect.data_abordagem).toLocaleDateString("pt-BR") : "—"} />
                  <DetailRow label="Última Interação" value={timeAgo(prospect.data_ultima_interacao)} />
                  {prospect.dia_cadencia !== null && <DetailRow label="Dia Cadência" value={`D${prospect.dia_cadencia}`} />}
                </div>
              </div>

              {prospect.resumo_conversa && (
                <div>
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resumo IA</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed bg-primary/5 rounded-lg p-3 border border-primary/10">
                    {prospect.resumo_conversa}
                  </p>
                </div>
              )}

              {/* Notas / Anotações */}
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <StickyNote className="h-3 w-3" />
                  Anotações
                  {notas && notas.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{notas.length}</Badge>
                  )}
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Textarea
                      value={novaNota}
                      onChange={e => setNovaNota(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddNota(); } }}
                      placeholder="Escreva uma anotação sobre a negociação..."
                      className="min-h-[60px] max-h-[100px] resize-none text-[11px] bg-background"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1.5" onClick={handleAddNota} disabled={savingNota || !novaNota.trim()}>
                    {savingNota ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Salvar Nota
                  </Button>
                  {notas && notas.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {notas.map((nota: any) => (
                        <div key={nota.id} className="rounded-lg border border-border p-2.5 group relative">
                          <p className="text-[11px] text-foreground/90 whitespace-pre-wrap leading-relaxed pr-5">{nota.conteudo}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(nota.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {nota.autor && <span className="text-[9px] text-muted-foreground">· {nota.autor}</span>}
                          </div>
                          <button
                            onClick={() => handleDeleteNota(nota.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cadência history */}
              {cadenciaHistory && cadenciaHistory.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Cadência <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{cadenciaHistory.length}</Badge>
                  </h3>
                  <div className="space-y-1.5">
                    {cadenciaHistory.slice(0, 5).map(c => (
                      <div key={c.id} className="rounded-lg border border-border p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px] h-5">{c.dia === 0 ? "Abordagem" : `D${c.dia}`}</Badge>
                          <div className="flex items-center gap-1">
                            {c.status === "enviado" ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-[10px] text-muted-foreground capitalize">{c.status}</span>
                          </div>
                        </div>
                        {c.mensagem_enviada && (
                          <p className="text-[10px] bg-muted rounded-md p-1.5 whitespace-pre-wrap line-clamp-2">{c.mensagem_enviada}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Helpers ── */

function ActionButton({ icon, label, desc, loading, onClick }: { icon: React.ReactNode; label: string; desc: string; loading?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="w-full flex items-center gap-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 p-2.5 transition-colors text-left disabled:opacity-50">
      <div className="shrink-0 text-primary">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground font-medium truncate ml-2 max-w-[150px] text-right">{value}</span>
    </div>
  );
}

function MessageBubbleEmpty() {
  return (
    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
      <Send className="h-6 w-6 text-muted-foreground/40" />
    </div>
  );
}
