import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Send, Sparkles, Loader2, BrainCircuit, CheckCircle2, XCircle,
  ExternalLink,
} from "lucide-react";
import { Prospect, PIPELINE_STAGES, classificacaoConfig, scoreColor } from "./types";

interface Props {
  prospect: Prospect | null;
  onClose: () => void;
  onProspectUpdate: (updated: Partial<Prospect>) => void;
}

export function ChatSheet({ prospect, onClose, onProspectUpdate }: Props) {
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

  return (
    <Sheet open={!!prospect} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent className="w-[500px] sm:w-[580px] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="p-5 pb-4 space-y-3 border-b">
          <SheetHeader className="p-0">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-lg">{prospect.nome_negocio}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {prospect.nicho} · {prospect.cidade}
                </p>
              </div>
              <a
                href={`https://wa.me/${prospect.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline shrink-0"
              >
                <ExternalLink className="h-3 w-3" />WhatsApp
              </a>
            </div>
          </SheetHeader>

          {/* Classification bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {prospect.classificacao_ia ? (
              <Badge className={`text-xs ${classif.bg}`}>
                {classif.icon} {classif.label}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Não classificado</Badge>
            )}
            {prospect.score_qualificacao !== null && (
              <span className={`text-xs font-bold tabular ${scoreColor(prospect.score_qualificacao)}`}>
                Score {prospect.score_qualificacao}/100
              </span>
            )}
            <Button size="sm" variant="outline" className="text-[11px] h-6 px-2 ml-auto" onClick={handleClassify} disabled={loadingClassify}>
              {loadingClassify ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3 mr-1" />}
              Classificar
            </Button>
          </div>

          {/* Move status */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Etapa:</span>
            <Select value={prospect.status} onValueChange={handleMoveStatus}>
              <SelectTrigger className="h-7 text-xs w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {prospect.resumo_conversa && (
              <span className="text-[11px] text-muted-foreground italic truncate flex-1 min-w-0">
                {prospect.resumo_conversa}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="conversa" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 w-auto self-start h-8">
            <TabsTrigger value="conversa" className="text-xs h-7">Conversa</TabsTrigger>
            <TabsTrigger value="cadencia" className="text-xs h-7">
              Cadência
              {cadenciaHistory && cadenciaHistory.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">{cadenciaHistory.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversa" className="flex-1 flex flex-col min-h-0 mt-0">
            <ScrollArea className="flex-1 px-5 py-3" ref={scrollRef}>
              <div className="space-y-2">
                {conversas?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-12">Nenhuma mensagem ainda.</p>
                )}
                {conversas?.map(msg => (
                  <div key={msg.id} className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[82%] ${
                    msg.direcao === "saida"
                      ? "bg-primary text-primary-foreground ml-auto rounded-br-md"
                      : "bg-muted mr-auto rounded-bl-md"
                  }`}>
                    <p className="text-[10px] opacity-50 mb-0.5">
                      {msg.direcao === "saida" ? "Você" : prospect.nome_negocio} ·{" "}
                      {new Date(msg.created_at!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                  </div>
                ))}
                {(loadingSuggest || loadingSend) && (
                  <div className="bg-muted mr-auto rounded-2xl rounded-bl-md px-4 py-3 max-w-[82%]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-4 space-y-2.5">
              <Textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Digite uma mensagem... (Ctrl+Enter para enviar)"
                className="min-h-[72px] max-h-[120px] resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={handleSuggestReply} disabled={loadingSuggest}>
                  {loadingSuggest ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  {loadingSuggest ? "Gerando..." : "Sugerir IA"}
                </Button>
                <Button size="sm" className="flex-1 text-xs h-8" onClick={handleSendMessage} disabled={loadingSend || !mensagem.trim()}>
                  {loadingSend ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  Enviar
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cadencia" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-5 py-3">
              <div className="space-y-2.5">
                {(!cadenciaHistory || cadenciaHistory.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-12">Nenhum follow-up registrado.</p>
                )}
                {cadenciaHistory?.map(c => (
                  <div key={c.id} className="rounded-lg border p-3 space-y-1.5">
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
      </SheetContent>
    </Sheet>
  );
}
