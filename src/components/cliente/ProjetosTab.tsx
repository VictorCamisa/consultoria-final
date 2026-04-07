import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, Pause, Trash2 } from "lucide-react";

const statusProjeto: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  nao_iniciado: { label: "Não Iniciado", icon: Circle, className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em Andamento", icon: Clock, className: "bg-primary text-primary-foreground" },
  concluido: { label: "Concluído", icon: CheckCircle2, className: "bg-success text-success-foreground" },
  pausado: { label: "Pausado", icon: Pause, className: "bg-warning text-warning-foreground" },
};

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "border-muted-foreground/30 text-muted-foreground" },
  media: { label: "Média", className: "border-primary/30 text-primary" },
  alta: { label: "Alta", className: "border-warning/30 text-warning" },
  urgente: { label: "Urgente", className: "border-destructive/30 text-destructive" },
};

const RESPONSAVEIS = ["victor", "danilo"];

interface Props { clienteId: string; }

export default function ProjetosTab({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newProjetoOpen, setNewProjetoOpen] = useState(false);
  const [newTarefaProjetoId, setNewTarefaProjetoId] = useState<string | null>(null);
  const [projetoForm, setProjetoForm] = useState({ nome: "", descricao: "", tipo: "entrega", responsavel: "victor", prioridade: "media" });
  const [tarefaForm, setTarefaForm] = useState({ titulo: "", descricao: "", responsavel: "victor", prioridade: "media", prazo: "" });

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_projetos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas", clienteId],
    queryFn: async () => {
      const projetoIds = projetos.map(p => p.id);
      if (projetoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("consultoria_tarefas")
        .select("*")
        .in("projeto_id", projetoIds)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: projetos.length > 0,
  });

  const createProjeto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultoria_projetos").insert({
        cliente_id: clienteId,
        nome: projetoForm.nome.trim(),
        descricao: projetoForm.descricao.trim() || null,
        tipo: projetoForm.tipo,
        responsavel: projetoForm.responsavel,
        prioridade: projetoForm.prioridade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto criado!");
      queryClient.invalidateQueries({ queryKey: ["projetos", clienteId] });
      setNewProjetoOpen(false);
      setProjetoForm({ nome: "", descricao: "", tipo: "entrega", responsavel: "victor", prioridade: "media" });
    },
    onError: () => toast.error("Erro ao criar projeto"),
  });

  const createTarefa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultoria_tarefas").insert({
        projeto_id: newTarefaProjetoId!,
        titulo: tarefaForm.titulo.trim(),
        descricao: tarefaForm.descricao.trim() || null,
        responsavel: tarefaForm.responsavel,
        prioridade: tarefaForm.prioridade,
        prazo: tarefaForm.prazo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa criada!");
      queryClient.invalidateQueries({ queryKey: ["tarefas", clienteId] });
      setNewTarefaProjetoId(null);
      setTarefaForm({ titulo: "", descricao: "", responsavel: "victor", prioridade: "media", prazo: "" });
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("consultoria_tarefas").update({
        status: done ? "concluida" : "pendente",
        concluida_em: done ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas", clienteId] }),
  });

  const updateProjetoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "concluido") updates.data_conclusao = new Date().toISOString();
      if (status === "em_andamento" && !projetos.find(p => p.id === id)?.data_inicio) updates.data_inicio = new Date().toISOString();
      const { error } = await supabase.from("consultoria_projetos").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos", clienteId] });
      toast.success("Status atualizado");
    },
  });

  const deleteProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consultoria_projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas", clienteId] });
      toast.success("Projeto removido");
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projetos.length} projeto{projetos.length !== 1 ? "s" : ""}</p>
        <Dialog open={newProjetoOpen} onOpenChange={setNewProjetoOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Projeto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Projeto/Entrega</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={projetoForm.nome} onChange={e => setProjetoForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Landing Page" /></div>
              <div className="space-y-1"><Label className="text-xs">Descrição</Label><Textarea value={projetoForm.descricao} onChange={e => setProjetoForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">Tipo</Label>
                  <Select value={projetoForm.tipo} onValueChange={v => setProjetoForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="entrega">Entrega</SelectItem><SelectItem value="recorrente">Recorrente</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Responsável</Label>
                  <Select value={projetoForm.responsavel} onValueChange={v => setProjetoForm(p => ({ ...p, responsavel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r === "victor" ? "Victor" : "Danilo"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Prioridade</Label>
                  <Select value={projetoForm.prioridade} onValueChange={v => setProjetoForm(p => ({ ...p, prioridade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(prioridadeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewProjetoOpen(false)}>Cancelar</Button>
              <Button onClick={() => createProjeto.mutate()} disabled={!projetoForm.nome.trim() || createProjeto.isPending}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projetos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum projeto cadastrado para este cliente.</CardContent></Card>
      ) : (
        projetos.map(projeto => {
          const projetoTarefas = tarefas.filter(t => t.projeto_id === projeto.id);
          const concluidas = projetoTarefas.filter(t => t.status === "concluida").length;
          const total = projetoTarefas.length;
          const sc = statusProjeto[projeto.status] ?? statusProjeto.nao_iniciado;
          const pc = prioridadeConfig[projeto.prioridade ?? "media"] ?? prioridadeConfig.media;
          const isExpanded = expanded[projeto.id];

          return (
            <Card key={projeto.id} className="border border-border">
              <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => toggle(projeto.id)}>
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm font-medium flex-1">{projeto.nome}</CardTitle>
                  <Badge variant="outline" className={pc.className}>{pc.label}</Badge>
                  <Badge className={sc.className}>{sc.label}</Badge>
                  {total > 0 && <span className="text-xs text-muted-foreground">{concluidas}/{total}</span>}
                  <Select value={projeto.status} onValueChange={v => updateProjetoStatus.mutate({ id: projeto.id, status: v })}>
                    <SelectTrigger className="w-[130px] h-7 text-xs" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(statusProjeto).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); deleteProjeto.mutate(projeto.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {projeto.descricao && <p className="text-xs text-muted-foreground mt-1 ml-6">{projeto.descricao}</p>}
                <div className="flex gap-3 ml-6 mt-1 text-xs text-muted-foreground">
                  <span>Responsável: <strong>{projeto.responsavel === "victor" ? "Victor" : "Danilo"}</strong></span>
                  {projeto.tipo === "recorrente" && <Badge variant="outline" className="text-[10px] h-4">Recorrente</Badge>}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0 px-4 pb-3">
                  <div className="border-t border-border pt-3 space-y-2">
                    {projetoTarefas.map(tarefa => (
                      <div key={tarefa.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          checked={tarefa.status === "concluida"}
                          onCheckedChange={checked => toggleTarefa.mutate({ id: tarefa.id, done: !!checked })}
                        />
                        <span className={`text-sm flex-1 ${tarefa.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>{tarefa.titulo}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 ${(prioridadeConfig[tarefa.prioridade ?? "media"] ?? prioridadeConfig.media).className}`}>
                          {(prioridadeConfig[tarefa.prioridade ?? "media"] ?? prioridadeConfig.media).label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{tarefa.responsavel === "victor" ? "Victor" : "Danilo"}</span>
                        {tarefa.prazo && <span className="text-[10px] text-muted-foreground">{new Date(tarefa.prazo).toLocaleDateString("pt-BR")}</span>}
                      </div>
                    ))}
                    <Dialog open={newTarefaProjetoId === projeto.id} onOpenChange={open => setNewTarefaProjetoId(open ? projeto.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs mt-1"><Plus className="h-3 w-3 mr-1" />Tarefa</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
                        <div className="grid gap-3 py-2">
                          <div className="space-y-1"><Label className="text-xs">Título *</Label><Input value={tarefaForm.titulo} onChange={e => setTarefaForm(p => ({ ...p, titulo: e.target.value }))} /></div>
                          <div className="space-y-1"><Label className="text-xs">Descrição</Label><Textarea value={tarefaForm.descricao} onChange={e => setTarefaForm(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1"><Label className="text-xs">Responsável</Label>
                              <Select value={tarefaForm.responsavel} onValueChange={v => setTarefaForm(p => ({ ...p, responsavel: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r === "victor" ? "Victor" : "Danilo"}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1"><Label className="text-xs">Prioridade</Label>
                              <Select value={tarefaForm.prioridade} onValueChange={v => setTarefaForm(p => ({ ...p, prioridade: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{Object.entries(prioridadeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1"><Label className="text-xs">Prazo</Label><Input type="date" value={tarefaForm.prazo} onChange={e => setTarefaForm(p => ({ ...p, prazo: e.target.value }))} /></div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setNewTarefaProjetoId(null)}>Cancelar</Button>
                          <Button onClick={() => createTarefa.mutate()} disabled={!tarefaForm.titulo.trim() || createTarefa.isPending}>Criar</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
