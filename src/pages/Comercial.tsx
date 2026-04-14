import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";

import { PIPELINE_STAGES, NICHOS, NICHO_CATEGORIES, matchesNichoFilter, Prospect } from "@/components/comercial/types";
import { PipelineStats } from "@/components/comercial/PipelineStats";
import { ProspectCard } from "@/components/comercial/ProspectCard";
import { ProspectWorkspace } from "@/components/comercial/ProspectWorkspace";
import { NewProspectDialog } from "@/components/comercial/NewProspectDialog";
import { KanbanSkeleton } from "@/components/PageSkeleton";
import { UnreadNotifications } from "@/components/comercial/UnreadNotifications";

export default function Comercial() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const storageKey = user ? `vs_filterNicho_${user.id}` : "vs_filterNicho";
  const [filterNicho, setFilterNicho] = useState(() => localStorage.getItem(storageKey) || "todos");
  const [filterClassificacao, setFilterClassificacao] = useState("todos");

  useEffect(() => {
    localStorage.setItem(storageKey, filterNicho);
  }, [filterNicho, storageKey]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [loadingAbordar, setLoadingAbordar] = useState<string | null>(null);
  const [loadingReativar, setLoadingReativar] = useState<string | null>(null);
  const [loadingCadencia, setLoadingCadencia] = useState<string | null>(null);
  const [loadingProcessar, setLoadingProcessar] = useState(false);

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_prospects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Track "last seen" per prospect in localStorage
  const getLastSeen = (prospectId: string) => {
    const key = `vs_lastSeen_${user?.id}_${prospectId}`;
    return localStorage.getItem(key);
  };

  const markAsSeen = (prospectId: string) => {
    const key = `vs_lastSeen_${user?.id}_${prospectId}`;
    localStorage.setItem(key, new Date().toISOString());
    queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
  };

  const { data: unreadCounts } = useQuery({
    queryKey: ["unread-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultoria_conversas")
        .select("prospect_id, created_at")
        .eq("direcao", "entrada")
        .order("created_at", { ascending: false });
      const counts: Record<string, number> = {};
      data?.forEach(m => {
        if (!m.prospect_id) return;
        const lastSeen = getLastSeen(m.prospect_id);
        if (!lastSeen || new Date(m.created_at!) > new Date(lastSeen)) {
          counts[m.prospect_id] = (counts[m.prospect_id] ?? 0) + 1;
        }
      });
      return counts;
    },
    refetchInterval: 15000,
  });

  const filtered = prospects?.filter(p => {
    if (!matchesNichoFilter(p.nicho, filterNicho)) return false;
    if (filterClassificacao !== "todos" && p.classificacao_ia !== filterClassificacao) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.nome_negocio.toLowerCase().includes(q) || p.cidade.toLowerCase().includes(q) || p.whatsapp.includes(q);
    }
    return true;
  });

  // --- Actions ---
  const handleMoveStage = async (prospect: Prospect, newStatus: string) => {
    try {
      const { error } = await supabase.from("consultoria_prospects").update({
        status: newStatus, updated_at: new Date().toISOString(),
      }).eq("id", prospect.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      const label = PIPELINE_STAGES.find(s => s.key === newStatus)?.label ?? newStatus;
      toast({ title: `${prospect.nome_negocio} movido para ${label}` });
    } catch (err: unknown) {
      toast({ title: "Erro ao mover", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const handleDelete = async (prospect: Prospect) => {
    if (!confirm(`Tem certeza que deseja excluir "${prospect.nome_negocio}"?`)) return;
    try {
      const { error } = await supabase.from("consultoria_prospects").delete().eq("id", prospect.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast({ title: `${prospect.nome_negocio} excluído` });
    } catch (err: unknown) {
      toast({ title: "Erro ao excluir", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const handleAbordar = async (prospect: Prospect) => {
    setLoadingAbordar(prospect.id);
    try {
      const { data, error } = await supabase.functions.invoke("abordar-prospect", { body: { prospect_id: prospect.id } });
      if (error) throw error;
      if (data?.reason === "numero_invalido") {
        queryClient.invalidateQueries({ queryKey: ["prospects"] });
        toast({ title: "Número inválido", description: data.message || "Número não encontrado no WhatsApp", variant: "destructive" });
        return;
      }
      if (data?.reason === "fora_horario") {
        toast({ title: "Fora do horário", description: data.message, variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast({ title: `Script enviado para ${prospect.nome_negocio}` });
    } catch (err: unknown) {
      toast({ title: "Erro ao abordar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoadingAbordar(null); }
  };

  const handleReativar = async (prospect: Prospect) => {
    setLoadingReativar(prospect.id);
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const { error } = await supabase.from("consultoria_prospects").update({
        status: "em_cadencia", dia_cadencia: 1, data_proxima_acao: tomorrow.toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", prospect.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast({ title: `${prospect.nome_negocio} reativado` });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoadingReativar(null); }
  };

  const handleIniciarCadencia = async (prospect: Prospect) => {
    setLoadingCadencia(prospect.id);
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const { error } = await supabase.from("consultoria_prospects").update({
        status: "em_cadencia", dia_cadencia: 1, data_abordagem: new Date().toISOString().split("T")[0],
        data_proxima_acao: tomorrow.toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", prospect.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast({ title: `Cadência iniciada para ${prospect.nome_negocio}` });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoadingCadencia(null); }
  };

  const handleProcessarCadencia = async () => {
    setLoadingProcessar(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-cadencia", {});
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast({ title: "Cadência processada", description: `${data?.processados ?? 0} prospect(s)` });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoadingProcessar(false); }
  };

  return (
    <div className="space-y-5 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Pipeline Comercial</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {prospects?.length ?? 0} prospects no pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleProcessarCadencia} disabled={loadingProcessar} className="text-xs">
            {loadingProcessar ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            <span className="hidden sm:inline">Processar</span> Cadência
          </Button>
          <NewProspectDialog />
        </div>
      </div>

      {/* Unread Notifications */}
      {prospects && unreadCounts && (
        <UnreadNotifications
          prospects={prospects}
          unreadCounts={unreadCounts}
          onSelectProspect={p => {
            markAsSeen(p.id);
            setSelectedProspect(p);
          }}
        />
      )}

      {/* Stats */}
      <PipelineStats
        prospects={filtered}
        onStageClick={(key) => {
          const el = document.getElementById(`kanban-col-${key}`);
          if (el) el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        }}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card rounded-lg border border-border p-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar prospect..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterNicho} onValueChange={setFilterNicho}>
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos nichos</SelectItem>
              {NICHOS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              <SelectItem value="sem_config">Sem config.</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterClassificacao} onValueChange={setFilterClassificacao}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas class.</SelectItem>
              <SelectItem value="quente">🔥 Quente</SelectItem>
              <SelectItem value="morno">🌡️ Morno</SelectItem>
              <SelectItem value="frio">❄️ Frio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <KanbanSkeleton />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 hide-scrollbar">
          {PIPELINE_STAGES.map(col => {
            const items = filtered?.filter(p => p.status === col.key) ?? [];
            return (
              <div key={col.key} id={`kanban-col-${col.key}`} className="kanban-col">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${col.color}`} />
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {col.label}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] h-[18px] px-1.5 ml-auto shrink-0">
                    {items.length}
                  </Badge>
                </div>

                {/* Cards container */}
                <div className="space-y-2 rounded-lg bg-card/50 border border-border/50 p-2 min-h-[120px]">
                  {items.map(p => (
                    <ProspectCard
                      key={p.id}
                      prospect={p}
                      unread={unreadCounts?.[p.id] ?? 0}
                      loadingAbordar={loadingAbordar === p.id}
                      loadingCadencia={loadingCadencia === p.id}
                      loadingReativar={loadingReativar === p.id}
                      onSelect={() => { markAsSeen(p.id); setSelectedProspect(p); }}
                      onAbordar={() => handleAbordar(p)}
                      onCadencia={() => handleIniciarCadencia(p)}
                      onReativar={() => handleReativar(p)}
                      onDelete={() => handleDelete(p)}
                      onMoveStage={(newStatus) => handleMoveStage(p, newStatus)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="flex items-center justify-center h-20">
                      <p className="text-[11px] text-muted-foreground/50">Vazio</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-screen Workspace */}
      <ProspectWorkspace
        prospect={selectedProspect}
        onClose={() => setSelectedProspect(null)}
        onProspectUpdate={updated => setSelectedProspect(prev => prev ? { ...prev, ...updated } : prev)}
        onAbordar={handleAbordar}
        onCadencia={handleIniciarCadencia}
        onReativar={handleReativar}
        loadingAbordar={loadingAbordar === selectedProspect?.id}
        loadingCadencia={loadingCadencia === selectedProspect?.id}
        loadingReativar={loadingReativar === selectedProspect?.id}
      />
    </div>
  );
}
