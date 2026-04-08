import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Send, Sparkles, Loader2, BrainCircuit, CheckCircle2, XCircle,
  ExternalLink, X, Phone, MapPin, Instagram, Globe, User,
  Megaphone, PlayCircle, RotateCcw, ArrowRightLeft, FileText, Copy, ChevronRight,
} from "lucide-react";
import { Prospect, PIPELINE_STAGES, classificacaoConfig, scoreColor, timeAgo } from "./types";

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

export function ProspectWorkspace({
  prospect, onClose, onProspectUpdate,
  onAbordar, onCadencia, onReativar,
  loadingAbordar, loadingCadencia, loadingReativar,
}: Props) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState("");
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingClassify, setLoadingClassify] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversas, refetch: refetchConversas } = useQuery({
    queryKey: ["conversas", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_conversas")
        .select("*")
        .eq("prospect_id", prospect!.id)
        .order("created_at", { ascending: true });
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
        .from("consultoria_cadencia")
        .select("*")
        .eq("prospect_id", prospect!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sessionMemory } = useQuery({
    queryKey: ["session-memory", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_session_memory")
        .select("*")
        .eq("prospect_id", prospect!.id)
        .order("extracted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: meddic } = useQuery({
    queryKey: ["meddic", prospect?.id],
    enabled: !!prospect?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_meddic")
        .select("*")
        .eq("prospect_id", prospect!.id)
        .order("pilar");
      if (error) throw error;
      return data;
    },
  });

  // Realtime
  useEffect(() => {
    if (!prospect?.id) return;
    const channel = supabase
      .channel(`conversas:${prospect.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "consultoria_conversas",
        filter: `prospect_id=eq.${prospect.id}`,
      }, () => {
        refetchConversas();
        queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prospect?.id, refetchConversas, queryClient]);

  // Auto-scroll
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

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSuggestReply = async () => {
    if (!prospect) return;
    setLoadingSuggest(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-reply", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      if (data?.sugestao) {
        setMensagem(data.sugestao);
        toast({ title: "Sugestão gerada pela IA" });
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao gerar sugestão", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingSuggest(false);
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
        toast({
          title: `${data.result.classificacao.toUpperCase()} — Score ${data.result.score}/100`,
          description: data.result.motivo,
        });
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
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao enviar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingSend(false);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in-0 duration-200">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-card shrink-0">
        {/* Left: Prospect identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {prospect.nome_negocio.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">{prospect.nome_negocio}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />{prospect.cidade}
              <span className="text-border">·</span>
              {prospect.nicho}
              {prospect.decisor && (
                <>
                  <span className="text-border">·</span>
                  <User className="h-3 w-3" />{prospect.decisor}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Center: Classification + Score + Stage */}
        <div className="flex items-center gap-3">
          {prospect.classificacao_ia ? (
            <Badge className={`text-xs ${classif.bg}`}>
              {classif.icon} {classif.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Não classificado</Badge>
          )}
          {prospect.score_qualificacao !== null && (
            <span className={`text-sm font-bold tabular ${scoreColor(prospect.score_qualificacao)}`}>
              {prospect.score_qualificacao}/100
            </span>
          )}

          <div className="h-5 w-px bg-border" />

          <Select value={prospect.status} onValueChange={handleMoveStatus}>
            <SelectTrigger className="h-8 text-xs w-auto gap-1.5 border-border">
              <div className={`w-2 h-2 rounded-full ${stageObj?.color}`} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map(s => (
                <SelectItem key={s.key} value={s.key}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${s.color}`} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" className="text-xs h-8" onClick={handleClassify} disabled={loadingClassify}>
            {loadingClassify ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5 mr-1" />}
            Classificar
          </Button>
        </div>

        {/* Right: Links + Close */}
        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/${prospect.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />WhatsApp
          </a>
          {prospect.instagram && (
            <a href={`https://instagram.com/${prospect.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Instagram className="h-3.5 w-3.5" />
            </a>
          )}
          {prospect.site && (
            <a href={prospect.site} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
          <div className="h-5 w-px bg-border ml-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Main Content: 2 columns ── */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: Chat */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
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
                  <div className={`rounded-2xl px-4 py-3 text-sm max-w-[75%] ${
                    msg.direcao === "saida"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  }`}>
                    <p className="text-[10px] opacity-50 mb-1">
                      {msg.direcao === "saida" ? "Você" : prospect.nome_negocio} ·{" "}
                      {new Date(msg.created_at!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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

          {/* Input area */}
          <div className="border-t border-border px-6 py-4 bg-card/50">
            <div className="max-w-2xl mx-auto space-y-3">
              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Digite uma mensagem... (Ctrl+Enter para enviar)"
                className="min-h-[80px] max-h-[140px] resize-none text-sm bg-background"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="text-xs h-9 flex-1" onClick={handleSuggestReply} disabled={loadingSuggest}>
                  {loadingSuggest ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Sugerir IA
                </Button>
                <Button className="text-xs h-9 flex-1" onClick={handleSendMessage} disabled={loadingSend || !mensagem.trim()}>
                  {loadingSend ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Intelligence Panel */}
        <div className="w-[380px] shrink-0 flex flex-col min-h-0 bg-card/30">
          <Tabs defaultValue="acoes" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mt-4 w-auto self-start h-8">
              <TabsTrigger value="acoes" className="text-xs h-7">Ações</TabsTrigger>
              <TabsTrigger value="intel" className="text-xs h-7">Inteligência</TabsTrigger>
              <TabsTrigger value="cadencia" className="text-xs h-7">
                Cadência
                {cadenciaHistory && cadenciaHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{cadenciaHistory.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab: Ações */}
            <TabsContent value="acoes" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações Rápidas</h3>
                    <div className="space-y-1.5">
                      {prospect.status === "novo" && onAbordar && (
                        <ActionButton icon={<Megaphone className="h-4 w-4" />} label="Enviar Abordagem" desc="Envia script automático via WhatsApp" loading={loadingAbordar} onClick={() => onAbordar(prospect)} />
                      )}
                      {["abordado", "respondeu"].includes(prospect.status) && onCadencia && (
                        <ActionButton icon={<PlayCircle className="h-4 w-4" />} label="Iniciar Cadência" desc="Inicia sequência de follow-ups" loading={loadingCadencia} onClick={() => onCadencia(prospect)} />
                      )}
                      {prospect.status === "frio" && onReativar && (
                        <ActionButton icon={<RotateCcw className="h-4 w-4" />} label="Reativar Lead" desc="Volta para cadência D1" loading={loadingReativar} onClick={() => onReativar(prospect)} />
                      )}
                      <ActionButton icon={<BrainCircuit className="h-4 w-4" />} label="Classificar com IA" desc="Analisa conversas e classifica o lead" loading={loadingClassify} onClick={handleClassify} />
                    </div>
                  </div>

                  {/* Move Stage */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mover Etapa</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PIPELINE_STAGES.filter(s => s.key !== prospect.status).slice(0, 6).map(s => (
                        <button
                          key={s.key}
                          onClick={() => handleMoveStatus(s.key)}
                          className="flex items-center gap-2 text-xs text-left rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 p-2.5 transition-colors"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                          <span className="truncate">{s.label}</span>
                        </button>
                      ))}
                    </div>
                    {PIPELINE_STAGES.filter(s => s.key !== prospect.status).length > 6 && (
                      <Select value="" onValueChange={handleMoveStatus}>
                        <SelectTrigger className="h-8 text-xs mt-1.5">
                          <span className="text-muted-foreground">Mais etapas...</span>
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.filter(s => s.key !== prospect.status).slice(6).map(s => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Prospect Details */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalhes</h3>
                    <div className="rounded-lg border border-border divide-y divide-border">
                      <DetailRow label="WhatsApp" value={prospect.whatsapp} />
                      <DetailRow label="Responsável" value={prospect.responsavel} />
                      <DetailRow label="Origem" value={prospect.origem || "—"} />
                      <DetailRow label="Faturamento" value={prospect.faturamento_estimado || "—"} />
                      <DetailRow label="Script Usado" value={prospect.script_usado || "—"} />
                      <DetailRow label="Abordagem" value={prospect.data_abordagem ? new Date(prospect.data_abordagem).toLocaleDateString("pt-BR") : "—"} />
                      <DetailRow label="Última Interação" value={timeAgo(prospect.data_ultima_interacao)} />
                      {prospect.dia_cadencia !== null && <DetailRow label="Dia Cadência" value={`D${prospect.dia_cadencia}`} />}
                    </div>
                  </div>

                  {/* Resumo */}
                  {prospect.resumo_conversa && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resumo IA</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed bg-primary/5 rounded-lg p-3 border border-primary/10">
                        {prospect.resumo_conversa}
                      </p>
                    </div>
                  )}

                  {/* Observações */}
                  {prospect.observacoes && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observações</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{prospect.observacoes}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Inteligência */}
            <TabsContent value="intel" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-4">
                  {/* MEDDIC */}
                  {meddic && meddic.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">MEDDIC Score</h3>
                      <div className="space-y-2">
                        {meddic.map(m => (
                          <div key={m.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground uppercase">{m.pilar}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold tabular ${m.score >= 7 ? "text-green-400" : m.score >= 4 ? "text-amber-400" : "text-red-400"}`}>
                                  {m.score}/10
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({m.confianca}%)
                                </span>
                              </div>
                            </div>
                            {m.evidencia_citacao && (
                              <p className="text-[11px] text-muted-foreground italic leading-relaxed">"{m.evidencia_citacao}"</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Session Memory / Facts */}
                  {sessionMemory && sessionMemory.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fatos Extraídos</h3>
                      <div className="space-y-1.5">
                        {sessionMemory.map(f => (
                          <div key={f.id} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                            <ChevronRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[11px] font-medium text-foreground">{f.fact_key}:</span>
                              <span className="text-[11px] text-muted-foreground ml-1">{f.fact_value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!meddic || meddic.length === 0) && (!sessionMemory || sessionMemory.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <BrainCircuit className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">Sem dados de inteligência</p>
                      <p className="text-xs mt-1">Classifique o lead para gerar insights</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Cadência */}
            <TabsContent value="cadencia" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-4 py-4">
                <div className="space-y-2.5">
                  {(!cadenciaHistory || cadenciaHistory.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <PlayCircle className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">Nenhum follow-up registrado</p>
                      <p className="text-xs mt-1">Inicie a cadência para acompanhar</p>
                    </div>
                  )}
                  {cadenciaHistory?.map(c => (
                    <div key={c.id} className="rounded-lg border border-border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {c.dia === 0 ? "Abordagem" : `D${c.dia}`}
                          </Badge>
                          {c.script_usado && (
                            <span className="text-[10px] text-muted-foreground">{c.script_usado}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {c.status === "enviado" ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          ) : (
                            <XCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground capitalize">{c.status}</span>
                        </div>
                      </div>
                      {c.enviado_em && (
                        <p className="text-[10px] text-muted-foreground tabular">
                          {new Date(c.enviado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {c.mensagem_enviada && (
                        <p className="text-[11px] bg-muted rounded-md p-2 whitespace-pre-wrap line-clamp-3">{c.mensagem_enviada}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ── */

function ActionButton({ icon, label, desc, loading, onClick }: { icon: React.ReactNode; label: string; desc: string; loading?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 p-3 transition-colors text-left disabled:opacity-50"
    >
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
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground font-medium">{value}</span>
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
