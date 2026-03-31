import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  BrainCircuit, Flame, Thermometer, Snowflake, MessageSquare,
  PlayCircle, Loader2, CheckCircle2, XCircle, Sparkles, RefreshCw,
  Megaphone, Zap, Activity, TrendingUp, Target,
} from "lucide-react";

type LogEntry = {
  id: string;
  agent: string;
  status: "ok" | "erro";
  msg: string;
  ts: Date;
};

type AgentConfig = {
  id: string;
  icon: React.ElementType;
  gradient: string;
  title: string;
  description: string;
  stats: { label: string; value: string | number; trend?: "up" | "down" | "neutral" }[];
  action: string | null;
  disabled: boolean;
  loading: boolean;
};

export default function AgenteIA() {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingClassificar, setLoadingClassificar] = useState(false);
  const [loadingAbordar, setLoadingAbordar] = useState(false);
  const [loadingCadencia, setLoadingCadencia] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const addLog = (agent: string, status: "ok" | "erro", msg: string) => {
    setLogs(prev => [{ id: crypto.randomUUID(), agent, status, msg, ts: new Date() }, ...prev.slice(0, 49)]);
  };

  const { data: prospects } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultoria_prospects").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Derived stats
  const total = prospects?.length ?? 0;
  const comScore = prospects?.filter(p => p.score_qualificacao !== null).length ?? 0;
  const semScore = total - comScore;
  const quentes = prospects?.filter(p => p.classificacao_ia === "quente").length ?? 0;
  const mornos = prospects?.filter(p => p.classificacao_ia === "morno").length ?? 0;
  const frios = prospects?.filter(p => p.classificacao_ia === "frio").length ?? 0;
  const emCadencia = prospects?.filter(p => p.status === "em_cadencia").length ?? 0;
  const novos = prospects?.filter(p => p.status === "novo").length ?? 0;
  const responderam = prospects?.filter(p => p.status === "respondeu" || p.status === "quente").length ?? 0;
  const cobertura = total > 0 ? Math.round((comScore / total) * 100) : 0;

  const agents: AgentConfig[] = [
    {
      id: "classify",
      icon: BrainCircuit,
      gradient: "from-purple-500/10 to-indigo-500/10",
      title: "Classificador IA",
      description: "Analisa conversas e atribui score (0–100) + classificação via GPT-4o",
      stats: [
        { label: "Classificados", value: comScore },
        { label: "Pendentes", value: semScore },
        { label: "Cobertura", value: `${cobertura}%` },
      ],
      action: `Classificar ${semScore} pendente${semScore !== 1 ? "s" : ""}`,
      disabled: semScore === 0 || loadingClassificar,
      loading: loadingClassificar,
    },
    {
      id: "abordar",
      icon: Megaphone,
      gradient: "from-blue-500/10 to-cyan-500/10",
      title: "Abordagem Automática",
      description: "Envia script inicial via WhatsApp e inicia cadência de follow-up",
      stats: [
        { label: "Novos", value: novos },
        { label: "Em cadência", value: emCadencia },
      ],
      action: `Abordar ${novos} novo${novos !== 1 ? "s" : ""}`,
      disabled: novos === 0 || loadingAbordar,
      loading: loadingAbordar,
    },
    {
      id: "cadencia",
      icon: RefreshCw,
      gradient: "from-emerald-500/10 to-green-500/10",
      title: "Follow-up Automático",
      description: "Dispara follow-ups vencidos (D1 → D3 → D7 → D14 → D30)",
      stats: [
        { label: "Em cadência", value: emCadencia },
      ],
      action: "Processar agora",
      disabled: loadingCadencia,
      loading: loadingCadencia,
    },
    {
      id: "suggest",
      icon: MessageSquare,
      gradient: "from-amber-500/10 to-orange-500/10",
      title: "Sugestor de Respostas",
      description: "Gera respostas contextualizadas para prospects que responderam",
      stats: [
        { label: "Responderam", value: responderam },
      ],
      action: null,
      disabled: true,
      loading: false,
    },
  ];

  // --- Handlers ---
  async function handleClassificar() {
    const pendentes = prospects?.filter(p => !p.score_qualificacao) ?? [];
    if (!pendentes.length) return;
    setLoadingClassificar(true);
    setProgresso(0);
    let ok = 0, erros = 0;
    for (let i = 0; i < pendentes.length; i++) {
      const p = pendentes[i];
      try {
        const { data, error } = await supabase.functions.invoke("classify-prospect", { body: { prospect_id: p.id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        ok++;
        addLog("Classificador", "ok", `${p.nome_negocio} — score: ${data?.result?.score ?? '?'}`);
      } catch (e: unknown) {
        erros++;
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        addLog("Classificador", "erro", `${p.nome_negocio}: ${msg}`);
      }
      setProgresso(Math.round(((i + 1) / pendentes.length) * 100));
    }
    setLoadingClassificar(false);
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
    toast({ title: "Classificação concluída", description: `${ok} ok · ${erros} erros` });
  }

  async function handleAbordar() {
    const novosP = prospects?.filter(p => p.status === "novo") ?? [];
    if (!novosP.length) return;
    setLoadingAbordar(true);
    let ok = 0, erros = 0;
    for (const p of novosP) {
      try {
        const { data, error } = await supabase.functions.invoke("abordar-prospect", { body: { prospect_id: p.id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const status = data?.enviado ? "enviado" : "salvo (sem WhatsApp)";
        ok++;
        addLog("Abordagem", "ok", `${p.nome_negocio} — ${status}`);
      } catch (e: unknown) {
        erros++;
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        addLog("Abordagem", "erro", `${p.nome_negocio}: ${msg}`);
      }
    }
    setLoadingAbordar(false);
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
    toast({ title: "Abordagens enviadas", description: `${ok} ok · ${erros} erros` });
  }

  async function handleCadencia() {
    setLoadingCadencia(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-cadencia", {});
      if (error) throw error;
      const n = (data as { processados?: number })?.processados ?? 0;
      addLog("Cadência", "ok", `${n} follow-up(s) enviados`);
      toast({ title: "Cadência processada", description: `${n} mensagens` });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    } catch {
      addLog("Cadência", "erro", "Falha ao processar");
      toast({ title: "Erro", description: "Falha ao processar cadência", variant: "destructive" });
    }
    setLoadingCadencia(false);
  }

  function handleAction(id: string) {
    if (id === "classify") handleClassificar();
    else if (id === "abordar") handleAbordar();
    else if (id === "cadencia") handleCadencia();
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-lg gradient-vs">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          Central de Automação IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle seus agentes inteligentes de prospecção e cadência
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cobertura IA</span>
            </div>
            <p className="text-3xl font-bold tabular">{cobertura}<span className="text-lg text-muted-foreground">%</span></p>
            <Progress value={cobertura} className="mt-2 h-1" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Quentes</span>
            </div>
            <p className="text-3xl font-bold tabular text-red-600">{quentes}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{mornos} mornos · {frios} frios</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Em Cadência</span>
            </div>
            <p className="text-3xl font-bold tabular text-indigo-600">{emCadencia}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{novos} aguardando abordagem</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Responderam</span>
            </div>
            <p className="text-3xl font-bold tabular text-emerald-600">{responderam}</p>
            <p className="text-[10px] text-muted-foreground mt-1">de {total} prospects</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map(agent => (
          <Card key={agent.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className={`bg-gradient-to-br ${agent.gradient} p-5 space-y-4`}>
                {/* Agent header */}
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-card shadow-sm border">
                    <agent.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{agent.title}</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{agent.description}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-2">
                  {agent.stats.map(s => (
                    <div key={s.label} className="bg-card/80 backdrop-blur rounded-lg border px-3 py-2 flex-1 text-center">
                      <p className="text-lg font-bold tabular">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar for classify */}
                {agent.id === "classify" && loadingClassificar && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Classificando...</span>
                      <span className="tabular">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-1.5" />
                  </div>
                )}

                {/* Action button */}
                {agent.action ? (
                  <Button
                    size="sm"
                    disabled={agent.disabled}
                    onClick={() => handleAction(agent.id)}
                    className="w-full h-9"
                  >
                    {agent.loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {agent.loading ? "Processando..." : agent.action}
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Disponível individualmente no módulo Comercial
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Execution Log */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Log de Execução</h3>
            </div>
            {logs.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{logs.length} entradas</Badge>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma execução nesta sessão</p>
              <p className="text-[11px] text-muted-foreground/60">Acione um agente acima para começar</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {logs.map(entry => (
                <div key={entry.id} className="flex items-center gap-2.5 text-xs py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  {entry.status === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="font-medium text-muted-foreground shrink-0">[{entry.agent}]</span>
                  <span className="flex-1 min-w-0 truncate">{entry.msg}</span>
                  <span className="text-muted-foreground/50 tabular shrink-0">
                    {entry.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
