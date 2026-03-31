import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, TrendingUp, DollarSign, Target, Phone, BarChart3,
  AlertTriangle, BrainCircuit, Flame, Thermometer, Snowflake, Clock,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: prospects } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultoria_prospects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultoria_clientes").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: acompanhamentos } = useQuery({
    queryKey: ["acompanhamentos-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_acompanhamentos")
        .select("*, consultoria_clientes(nome_negocio)")
        .eq("status", "pendente")
        .order("agendado_para", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStr = now.toISOString().split("T")[0];

  // --- KPIs existentes ---
  const prospectsThisWeek = prospects?.filter(
    (p) => p.data_abordagem && new Date(p.data_abordagem) >= weekAgo
  ).length ?? 0;

  const respondidos = prospects?.filter((p) =>
    ["respondeu", "quente", "call_agendada", "call_realizada", "proposta_enviada", "fechado"].includes(p.status)
  ).length ?? 0;

  const taxaResposta = prospects?.length ? Math.round((respondidos / prospects.length) * 100) : 0;

  const fechadosMes = clientes?.filter(
    (c) => new Date(c.data_fechamento) >= monthStart
  ).length ?? 0;

  const feeTotalMes = clientes
    ?.filter((c) => new Date(c.data_fechamento) >= monthStart)
    .reduce((sum, c) => sum + Number(c.valor_fee), 0) ?? 0;

  const convertidos = clientes?.filter((c) => c.status === "convertido_recorrente").length ?? 0;
  const taxaConversao = clientes?.length ? Math.round((convertidos / clientes.length) * 100) : 0;

  // --- Alertas urgentes ---
  const respondeuAguardando = prospects?.filter((p) => p.status === "quenterespondeu" || p.status === "respondeu") ?? [];

  const quentesParados = prospects?.filter((p) => {
    if (p.classificacao_ia !== "quente") return false;
    if (!p.data_ultima_interacao) return true;
    return new Date(p.data_ultima_interacao) < twoDaysAgo;
  }) ?? [];

  const cadenciaVencida = prospects?.filter((p) => {
    if (p.status !== "em_cadencia") return false;
    if (!p.data_proxima_acao) return true;
    return new Date(p.data_proxima_acao) < now;
  }) ?? [];

  const cadenciaHoje = prospects?.filter((p) => {
    if (p.status !== "em_cadencia") return false;
    if (!p.data_proxima_acao) return false;
    return p.data_proxima_acao.split("T")[0] === todayStr;
  }) ?? [];

  // --- Classificação IA ---
  const iaQuente = prospects?.filter((p) => p.classificacao_ia === "quente").length ?? 0;
  const iaMorno = prospects?.filter((p) => p.classificacao_ia === "morno").length ?? 0;
  const iaFrio = prospects?.filter((p) => p.classificacao_ia === "frio").length ?? 0;
  const iaSemClassificacao = prospects?.filter((p) => !p.classificacao_ia).length ?? 0;
  const scoreMediano = prospects?.reduce((s, p) => s + (p.score_qualificacao ?? 0), 0) ?? 0;
  const scoreMedio = prospects?.length ? Math.round(scoreMediano / prospects.length) : 0;

  // Top 5 prospects por score (quentes)
  const topProspects = [...(prospects ?? [])]
    .filter((p) => p.score_qualificacao !== null && p.classificacao_ia !== "frio")
    .sort((a, b) => (b.score_qualificacao ?? 0) - (a.score_qualificacao ?? 0))
    .slice(0, 5);

  // --- Pipeline stages ---
  const pipelineStages = [
    { label: "Novo", count: prospects?.filter((p) => p.status === "novo").length ?? 0 },
    { label: "Abordado", count: prospects?.filter((p) => p.status === "abordado").length ?? 0 },
    { label: "Em Cadência", count: prospects?.filter((p) => p.status === "em_cadencia").length ?? 0 },
    { label: "Respondeu", count: prospects?.filter((p) => p.status === "respondeu").length ?? 0 },
    { label: "Quente 🔥", count: prospects?.filter((p) => p.status === "quente").length ?? 0 },
    { label: "Call Agendada", count: prospects?.filter((p) => p.status === "call_agendada").length ?? 0 },
    { label: "Fechado ✓", count: prospects?.filter((p) => p.status === "fechado").length ?? 0 },
  ];

  const kpis = [
    { title: "Abordados esta semana", value: prospectsThisWeek, icon: Phone, color: "text-primary" },
    { title: "Taxa de resposta", value: `${taxaResposta}%`, icon: BarChart3, color: "text-primary" },
    { title: "Fechados este mês", value: fechadosMes, icon: Target, color: "text-success" },
    { title: "Fee total (mês)", value: `R$ ${feeTotalMes.toLocaleString("pt-BR")}`, icon: DollarSign, color: "text-success" },
    { title: "Convertidos recorrente", value: convertidos, icon: TrendingUp, color: "text-primary" },
    { title: "Taxa conversão", value: `${taxaConversao}%`, icon: Users, color: "text-primary" },
  ];

  const totalAlertas = respondeuAguardando.length + quentesParados.length + cadenciaVencida.length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="vs-h1">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral do pipeline e operação</p>
        </div>
        {totalAlertas > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {totalAlertas} alerta{totalAlertas > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="pt-5 pb-5 px-5">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                <span className="text-sm text-muted-foreground font-medium">{kpi.title}</span>
              </div>
              <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas Urgentes */}
      {totalAlertas > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Atenção Urgente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {respondeuAguardando.length > 0 && (
              <div className="rounded-lg surface-warning border border-warning/20 p-3">
                <p className="text-sm font-medium mb-1">
                  {respondeuAguardando.length} prospect(s) responderam — aguardando ação
                </p>
                <div className="flex flex-wrap gap-2">
                  {respondeuAguardando.slice(0, 5).map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      className="text-xs h-6"
                      onClick={() => navigate("/comercial")}
                    >
                      {p.nome_negocio}
                    </Button>
                  ))}
                  {respondeuAguardando.length > 5 && (
                    <span className="text-xs text-muted-foreground self-center">
                      +{respondeuAguardando.length - 5} outros
                    </span>
                  )}
                </div>
              </div>
            )}

            {quentesParados.length > 0 && (
              <div className="rounded-lg surface-danger border border-destructive/20 p-3">
                <p className="text-sm font-medium mb-1">
                  {quentesParados.length} prospect(s) QUENTES sem contato há +2 dias
                </p>
                <div className="flex flex-wrap gap-2">
                  {quentesParados.slice(0, 5).map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      className="text-xs h-6"
                      onClick={() => navigate("/comercial")}
                    >
                      {p.nome_negocio} ({p.score_qualificacao ?? "—"})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {cadenciaVencida.length > 0 && (
              <div className="rounded-lg bg-muted p-3 border">
                <p className="text-sm font-medium mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {cadenciaVencida.length} prospect(s) com cadência vencida
                </p>
                <p className="text-xs text-muted-foreground">
                  Use "Processar Cadência" na tela Comercial para disparar automaticamente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Funil do Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipelineStages.map((stage) => (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="text-sm w-32 text-muted-foreground shrink-0">{stage.label}</span>
                <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.max(
                        (stage.count / Math.max(...pipelineStages.map((s) => s.count), 1)) * 100,
                        stage.count > 0 ? 12 : 0
                      )}%`,
                    }}
                  >
                    {stage.count > 0 && (
                      <span className="text-xs font-medium text-primary-foreground">{stage.count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Classificação IA */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" />
                Inteligência Artificial
              </CardTitle>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate("/agente-ia")}>
                Gerenciar →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg surface-danger p-3 text-center">
                <Flame className="h-4 w-4 mx-auto mb-1" />
                <p className="text-2xl font-bold">{iaQuente}</p>
                <p className="text-xs text-muted-foreground">Quentes</p>
              </div>
              <div className="rounded-lg surface-warning p-3 text-center">
                <Thermometer className="h-4 w-4 mx-auto mb-1" />
                <p className="text-2xl font-bold">{iaMorno}</p>
                <p className="text-xs text-muted-foreground">Mornos</p>
              </div>
              <div className="rounded-lg surface-info p-3 text-center">
                <Snowflake className="h-4 w-4 mx-auto mb-1" />
                <p className="text-2xl font-bold">{iaFrio}</p>
                <p className="text-xs text-muted-foreground">Frios</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <BrainCircuit className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold">{iaSemClassificacao}</p>
                <p className="text-xs text-muted-foreground">Sem análise</p>
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Score médio geral</p>
              <p className="text-3xl font-bold">{scoreMedio}<span className="text-sm text-muted-foreground">/100</span></p>
            </div>
            {iaSemClassificacao > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => navigate("/agente-ia")}
              >
                <BrainCircuit className="h-3 w-3 mr-1" />
                {iaSemClassificacao} prospect(s) sem análise — classificar agora
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top prospects quentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />
                Top Prospects por Score IA
              </CardTitle>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate("/comercial")}>
                Ver todos →
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProspects.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum prospect classificado ainda.</p>
            )}
            {topProspects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.nome_negocio}</p>
                  <p className="text-xs text-muted-foreground">{p.nicho} · {p.cidade}</p>
                  {p.resumo_conversa && (
                    <p className="text-xs text-muted-foreground italic truncate mt-0.5">"{p.resumo_conversa}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-sm font-bold ${
                    (p.score_qualificacao ?? 0) >= 70 ? "text-destructive" :
                    (p.score_qualificacao ?? 0) >= 40 ? "text-warning" : "text-primary"
                  }`}>
                    {p.score_qualificacao}
                  </span>
                  <Badge variant="outline" className="text-xs">{p.nicho}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cadência hoje + Ações pendentes */}
        <div className="space-y-4">
          {cadenciaHoje.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Cadência de Hoje ({cadenciaHoje.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {cadenciaHoje.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1">
                    <span className="truncate flex-1">{p.nome_negocio}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">D{p.dia_cadencia}</Badge>
                      <span className="text-xs text-muted-foreground">{p.nicho}</span>
                    </div>
                  </div>
                ))}
                {cadenciaHoje.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{cadenciaHoje.length - 5} outros</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs mt-2"
                  onClick={() => navigate("/comercial")}
                >
                  Processar no Comercial →
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Pendentes (Clientes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {acompanhamentos?.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma ação pendente.</p>
              )}
              {acompanhamentos?.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {(a as unknown as { consultoria_clientes: { nome_negocio: string } }).consultoria_clientes?.nome_negocio ?? "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.tipo} — {new Date(a.agendado_para).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={a.responsavel === "victor" ? "secondary" : "default"} className="text-xs">
                    {a.responsavel === "victor" ? "Victor" : "Danilo"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
