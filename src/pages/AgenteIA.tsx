import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  BrainCircuit, Megaphone, RefreshCw, MessageSquare,
} from "lucide-react";

import KPIStrip from "@/components/agente-ia/KPIStrip";
import AgentCard from "@/components/agente-ia/AgentCard";
import ExecutionLog from "@/components/agente-ia/ExecutionLog";
import ConfirmActionDialog from "@/components/agente-ia/ConfirmActionDialog";
import type { LogEntry, AgentConfig } from "@/components/agente-ia/types";

export default function AgenteIA() {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingClassificar, setLoadingClassificar] = useState(false);
  const [loadingAbordar, setLoadingAbordar] = useState(false);
  const [loadingCadencia, setLoadingCadencia] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const abortClassificar = useRef<AbortController | null>(null);
  const abortAbordar = useRef<AbortController | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const addLog = useCallback((agent: string, status: "ok" | "erro", msg: string) => {
    setLogs(prev => [{ id: crypto.randomUUID(), agent, status, msg, ts: new Date() }, ...prev.slice(0, 49)]);
  }, []);

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_prospects")
        .select("id, status, score_qualificacao, classificacao_ia, nome_negocio");
      if (error) throw error;
      return data;
    },
  });

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

  const anyRunning = loadingClassificar || loadingAbordar || loadingCadencia;

  const agents: AgentConfig[] = [
    {
      id: "classify",
      icon: BrainCircuit,
      gradient: "from-primary/10 to-accent/10",
      title: "Classificador IA",
      description: "Analisa conversas e atribui score (0–100) + classificação automática via GPT-4o",
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
      gradient: "from-warning/10 to-warning/5",
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
      gradient: "from-success/10 to-success/5",
      title: "Follow-up Automático",
      description: "Dispara follow-ups vencidos: D1 → D3 → D7 → D14 → D30",
      stats: [
        { label: "Em cadência", value: emCadencia },
      ],
      action: "Processar follow-ups",
      disabled: loadingCadencia,
      loading: loadingCadencia,
    },
    {
      id: "suggest",
      icon: MessageSquare,
      gradient: "from-accent/10 to-accent/5",
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
    const controller = new AbortController();
    abortClassificar.current = controller;
    setLoadingClassificar(true);
    setProgresso(0);
    let ok = 0, erros = 0;

    // Delay de 1-2s entre chamadas para não sobrecarregar a API
    const classifyDelay = () => new Promise(resolve => 
      setTimeout(resolve, 1000 + Math.random() * 1000)
    );

    for (let i = 0; i < pendentes.length; i++) {
      if (controller.signal.aborted) {
        addLog("Classificador", "erro", `Cancelado (${ok} ok, ${erros} erros)`);
        break;
      }
      if (i > 0) await classifyDelay();
      const p = pendentes[i];
      try {
        const { data, error } = await supabase.functions.invoke("classify-prospect", { body: { prospect_id: p.id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        ok++;
        addLog("Classificador", "ok", `${p.nome_negocio} — score: ${data?.result?.score ?? '?'}`);
      } catch (e: unknown) {
        if (controller.signal.aborted) break;
        erros++;
        addLog("Classificador", "erro", `${p.nome_negocio}: ${e instanceof Error ? e.message : "Erro"}`);
      }
      setProgresso(Math.round(((i + 1) / pendentes.length) * 100));
    }
    setLoadingClassificar(false);
    abortClassificar.current = null;
    queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
    toast({ title: "Classificação concluída", description: `${ok} ok · ${erros} erros` });
  }

  async function handleAbordar() {
    const novosP = prospects?.filter(p => p.status === "novo") ?? [];
    if (!novosP.length) return;
    const controller = new AbortController();
    abortAbordar.current = controller;
    setLoadingAbordar(true);
    setProgresso(0);
    let ok = 0, erros = 0;

    // Delay aleatório entre 3-8 segundos para evitar bloqueio do WhatsApp
    const randomDelay = () => new Promise(resolve => 
      setTimeout(resolve, 3000 + Math.random() * 5000)
    );

    for (let i = 0; i < novosP.length; i++) {
      if (controller.signal.aborted) {
        addLog("Abordagem", "erro", `Cancelado (${ok} ok, ${erros} erros)`);
        break;
      }

      // Aguarda delay entre disparos (exceto antes do primeiro)
      if (i > 0) {
        addLog("Abordagem", "ok", `Aguardando intervalo anti-bloqueio...`);
        await randomDelay();
      }

      const p = novosP[i];
      try {
        const { data, error } = await supabase.functions.invoke("abordar-prospect", { body: { prospect_id: p.id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        ok++;
        addLog("Abordagem", "ok", `${p.nome_negocio} — ${data?.enviado ? "enviado ✓" : "salvo (sem envio)"}`);
      } catch (e: unknown) {
        if (controller.signal.aborted) break;
        erros++;
        addLog("Abordagem", "erro", `${p.nome_negocio}: ${e instanceof Error ? e.message : "Erro"}`);
      }
      setProgresso(Math.round(((i + 1) / novosP.length) * 100));
    }
    setLoadingAbordar(false);
    abortAbordar.current = null;
    queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["prospects-stats"] });
    } catch {
      addLog("Cadência", "erro", "Falha ao processar");
      toast({ title: "Erro", description: "Falha ao processar cadência", variant: "destructive" });
    }
    setLoadingCadencia(false);
  }

  function handleCancel(id: string) {
    if (id === "classify") abortClassificar.current?.abort();
    else if (id === "abordar") abortAbordar.current?.abort();
  }

  function handleAction(id: string) {
    if (id === "classify") {
      setConfirmDialog({
        open: true,
        title: "Classificar prospects pendentes",
        description: `Classificar ${semScore} prospect${semScore !== 1 ? "s" : ""} usando GPT-4o. Cada chamada consome tokens. Continuar?`,
        onConfirm: handleClassificar,
      });
    } else if (id === "abordar") {
      setConfirmDialog({
        open: true,
        title: "Abordar prospects novos",
        description: `Enviar mensagens via WhatsApp para ${novos} prospect${novos !== 1 ? "s" : ""}. Ação irreversível. Continuar?`,
        onConfirm: handleAbordar,
      });
    } else if (id === "cadencia") {
      handleCadencia();
    }
  }

  return (
    <div className="space-y-8 page-enter">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1>Central de Automação</h1>
          <p className="vs-body text-muted-foreground">
            Monitore e execute agentes de prospecção e cadência
          </p>
        </div>
        {anyRunning && (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-primary/25 bg-primary/5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-sm font-semibold text-primary">Agentes em execução</span>
          </div>
        )}
      </div>

      {/* ── KPI Strip ── */}
      <KPIStrip
        cobertura={cobertura} quentes={quentes} mornos={mornos} frios={frios}
        emCadencia={emCadencia} novos={novos} responderam={responderam}
        total={total} isLoading={isLoading}
      />

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 sm:gap-8 items-start">
        {/* Agents grid */}
        <div className="space-y-5">
          <h2>Agentes</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onAction={handleAction}
                onCancel={handleCancel}
                progresso={progresso}
                showProgress={agent.id === "classify" || agent.id === "abordar"}
                cancellable={agent.id === "classify" || agent.id === "abordar"}
              />
            ))}
          </div>
        </div>

        {/* Log sidebar */}
        <div className="xl:sticky xl:top-20">
          <ExecutionLog logs={logs} />
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={() => {
          setConfirmDialog(prev => ({ ...prev, open: false }));
          confirmDialog.onConfirm();
        }}
      />
    </div>
  );
}
