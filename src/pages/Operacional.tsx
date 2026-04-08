import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Search, FolderKanban, ListChecks, AlertTriangle, CheckCircle2, Clock, Eye } from "lucide-react";
import { TableSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const statusProjeto: Record<string, { label: string; className: string }> = {
  nao_iniciado: { label: "Não Iniciado", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em Andamento", className: "bg-primary text-primary-foreground" },
  concluido: { label: "Concluído", className: "bg-success text-success-foreground" },
  pausado: { label: "Pausado", className: "bg-warning text-warning-foreground" },
};

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "border-muted-foreground/30 text-muted-foreground" },
  media: { label: "Média", className: "border-primary/30 text-primary" },
  alta: { label: "Alta", className: "border-warning/30 text-warning" },
  urgente: { label: "Urgente", className: "border-destructive/30 text-destructive" },
};

export default function Operacional() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");

  const { data: projetos = [], isLoading: loadingProjetos } = useQuery({
    queryKey: ["all-projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_projetos")
        .select("*, consultoria_clientes(nome_negocio, nicho)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["all-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_tarefas")
        .select("*, consultoria_projetos(nome, cliente_id, consultoria_clientes(nome_negocio))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // KPIs
  const projetosAtivos = projetos.filter(p => p.status === "em_andamento").length;
  const projetosConcluidos = projetos.filter(p => p.status === "concluido").length;
  const tarefasPendentes = tarefas.filter(t => t.status === "pendente" || t.status === "em_andamento").length;
  const tarefasAtrasadas = tarefas.filter(t => t.prazo && new Date(t.prazo) < new Date() && t.status !== "concluida" && t.status !== "cancelada").length;

  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      if (filterStatus !== "todos" && p.status !== filterStatus) return false;
      if (filterResponsavel !== "todos" && p.responsavel !== filterResponsavel) return false;
      if (search) {
        const q = search.toLowerCase();
        const clienteNome = (p as any).consultoria_clientes?.nome_negocio?.toLowerCase() ?? "";
        return p.nome.toLowerCase().includes(q) || clienteNome.includes(q);
      }
      return true;
    });
  }, [projetos, filterStatus, filterResponsavel, search]);

  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      if (filterStatus !== "todos" && t.status !== filterStatus) return false;
      if (filterResponsavel !== "todos" && t.responsavel !== filterResponsavel) return false;
      if (search) {
        const q = search.toLowerCase();
        const projeto = (t as any).consultoria_projetos;
        const clienteNome = projeto?.consultoria_clientes?.nome_negocio?.toLowerCase() ?? "";
        return t.titulo.toLowerCase().includes(q) || projeto?.nome?.toLowerCase().includes(q) || clienteNome.includes(q);
      }
      return true;
    });
  }, [tarefas, filterStatus, filterResponsavel, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="vs-h1">Operacional</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral de projetos e tarefas de todos os clientes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Projetos Ativos", value: projetosAtivos, icon: FolderKanban, color: "text-primary" },
          { label: "Projetos Concluídos", value: projetosConcluidos, icon: CheckCircle2, color: "text-success" },
          { label: "Tarefas Pendentes", value: tarefasPendentes, icon: ListChecks, color: "text-warning" },
          { label: "Tarefas Atrasadas", value: tarefasAtrasadas, icon: AlertTriangle, color: "text-destructive" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card rounded-lg border border-border p-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar projeto ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-8 text-sm bg-background" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {Object.entries(statusProjeto).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
          <SelectTrigger className="w-32 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="victor">Victor</SelectItem>
            <SelectItem value="danilo">Danilo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="projetos">
        <TabsList>
          <TabsTrigger value="projetos">Projetos ({filteredProjetos.length})</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas ({filteredTarefas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="projetos" className="mt-4">
          {loadingProjetos ? <TableSkeleton rows={5} cols={6} /> : filteredProjetos.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Nenhum projeto encontrado" description="Crie projetos na página de detalhe do cliente." />
          ) : (
            <div className="bg-card rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjetos.map(p => {
                    const projetoTarefas = tarefas.filter(t => t.projeto_id === p.id);
                    const concluidas = projetoTarefas.filter(t => t.status === "concluida").length;
                    const total = projetoTarefas.length;
                    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
                    const sc = statusProjeto[p.status] ?? statusProjeto.nao_iniciado;
                    const pc = prioridadeConfig[p.prioridade ?? "media"] ?? prioridadeConfig.media;
                    const cliente = (p as any).consultoria_clientes;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell>{cliente?.nome_negocio ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{p.responsavel === "victor" ? "Victor" : "Danilo"}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={pc.className}>{pc.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5 w-16" />
                            <span className="text-xs text-muted-foreground">{concluidas}/{total}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={sc.className}>{sc.label}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/clientes/${p.cliente_id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          {loadingTarefas ? <TableSkeleton rows={5} cols={6} /> : filteredTarefas.length === 0 ? (
            <EmptyState icon={ListChecks} title="Nenhuma tarefa encontrada" description="Tarefas são criadas dentro dos projetos de cada cliente." />
          ) : (
            <div className="bg-card rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTarefas.map(t => {
                    const projeto = (t as any).consultoria_projetos;
                    const pc = prioridadeConfig[t.prioridade ?? "media"] ?? prioridadeConfig.media;
                    const isAtrasada = t.prazo && new Date(t.prazo) < new Date() && t.status !== "concluida" && t.status !== "cancelada";
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.titulo}</TableCell>
                        <TableCell className="text-muted-foreground">{projeto?.nome ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{projeto?.consultoria_clientes?.nome_negocio ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{t.responsavel === "victor" ? "Victor" : "Danilo"}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={pc.className}>{pc.label}</Badge></TableCell>
                        <TableCell>
                          {t.prazo ? (
                            <span className={isAtrasada ? "text-destructive font-medium text-xs" : "text-xs"}>
                              {isAtrasada && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                              {new Date(t.prazo).toLocaleDateString("pt-BR")}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            t.status === "concluida" ? "bg-success text-success-foreground" :
                            t.status === "cancelada" ? "bg-muted text-muted-foreground" :
                            t.status === "em_andamento" ? "bg-primary text-primary-foreground" :
                            "bg-warning text-warning-foreground"
                          }>
                            {t.status === "concluida" ? "Concluída" : t.status === "pendente" ? "Pendente" : t.status === "em_andamento" ? "Em Andamento" : "Cancelada"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
