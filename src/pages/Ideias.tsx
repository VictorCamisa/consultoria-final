import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Lightbulb, TrendingUp, Loader2, Filter, ExternalLink } from "lucide-react";

type Ideia = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  modulo: string | null;
  autor: string;
  status: string;
  impacto: number;
  esforco: number;
  score: number | null;
  tags: string[] | null;
  link_origem: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLUMNS = [
  { key: "captura",      label: "Captura",      color: "bg-slate-500/10 border-slate-500/30",  dot: "bg-slate-400" },
  { key: "analise",      label: "Análise",      color: "bg-blue-500/10 border-blue-500/30",    dot: "bg-blue-400" },
  { key: "priorizada",   label: "Priorizada",   color: "bg-amber-500/10 border-amber-500/30",  dot: "bg-amber-400" },
  { key: "em_execucao",  label: "Em Execução",  color: "bg-primary/10 border-primary/30",      dot: "bg-primary" },
  { key: "entregue",     label: "Entregue",     color: "bg-green-500/10 border-green-500/30",  dot: "bg-green-400" },
  { key: "arquivada",    label: "Arquivada",    color: "bg-muted border-border",                dot: "bg-muted-foreground" },
] as const;

const CATEGORIAS = [
  { key: "produto",   label: "Produto",   color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { key: "comercial", label: "Comercial", color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  { key: "marketing", label: "Marketing", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { key: "processo",  label: "Processo",  color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  { key: "tech",      label: "Tech",      color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
];

const MODULOS = [
  { key: "comercial",   label: "Comercial" },
  { key: "gatekeeper",  label: "Gatekeeper" },
  { key: "onboarding",  label: "Onboarding" },
  { key: "telemetria",  label: "Telemetria" },
  { key: "financeiro",  label: "Financeiro" },
  { key: "governanca",  label: "Governança" },
  { key: "outro",       label: "Outro" },
];

const AUTORES = [
  { key: "victor", label: "Victor" },
  { key: "danilo", label: "Danilo" },
  { key: "outro",  label: "Outro" },
];

const emptyForm = {
  titulo: "",
  descricao: "",
  categoria: "produto",
  modulo: "comercial",
  autor: "victor",
  status: "captura",
  impacto: 3,
  esforco: 3,
  tags: "",
  link_origem: "",
  observacoes: "",
};

export default function Ideias() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterModulo, setFilterModulo] = useState<string>("todos");

  const { data: ideias, isLoading } = useQuery({
    queryKey: ["vs-ideias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_ideias" as any)
        .select("*")
        .order("score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as Ideia[];
    },
  });

  const filtered = useMemo(() => {
    if (!ideias) return [];
    return ideias.filter(i =>
      (filterCategoria === "todas" || i.categoria === filterCategoria) &&
      (filterModulo === "todos" || i.modulo === filterModulo)
    );
  }, [ideias, filterCategoria, filterModulo]);

  const upsertIdeia = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria,
        modulo: form.modulo,
        autor: form.autor,
        status: form.status,
        impacto: Number(form.impacto),
        esforco: Number(form.esforco),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        link_origem: form.link_origem.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("vs_ideias" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vs_ideias" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vs-ideias"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Ideia atualizada" : "Ideia capturada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("vs_ideias" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vs-ideias"] }),
  });

  const deleteIdeia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vs_ideias" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vs-ideias"] });
      toast({ title: "Ideia removida" });
    },
  });

  const openEdit = (i: Ideia) => {
    setForm({
      titulo: i.titulo,
      descricao: i.descricao ?? "",
      categoria: i.categoria,
      modulo: i.modulo ?? "outro",
      autor: i.autor,
      status: i.status,
      impacto: i.impacto,
      esforco: i.esforco,
      tags: (i.tags ?? []).join(", "),
      link_origem: i.link_origem ?? "",
      observacoes: i.observacoes ?? "",
    });
    setEditingId(i.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const catColor = (key: string) => CATEGORIAS.find(c => c.key === key)?.color ?? "bg-muted";
  const catLabel = (key: string) => CATEGORIAS.find(c => c.key === key)?.label ?? key;
  const modLabel = (key: string | null) => MODULOS.find(m => m.key === key)?.label ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Banco de Ideias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture, priorize e execute ideias do VS Core OS. Score = impacto ÷ esforço.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova Ideia
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterModulo} onValueChange={setFilterModulo}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos módulos</SelectItem>
            {MODULOS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-2">
          {filtered.length} de {ideias?.length ?? 0} ideias
        </span>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-6 gap-3 min-h-[60vh]">
          {STATUS_COLUMNS.map(col => {
            const items = filtered.filter(i => i.status === col.key);
            return (
              <div key={col.key} className={`rounded-lg border ${col.color} p-2 flex flex-col`}>
                <div className="flex items-center gap-2 mb-2 px-1 py-1 sticky top-0">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <p className="text-xs font-bold uppercase tracking-wider">{col.label}</p>
                  <span className="ml-auto text-[10px] text-muted-foreground bg-background/40 rounded px-1.5 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {items.map(i => (
                    <Card
                      key={i.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors group"
                      onClick={() => openEdit(i)}
                    >
                      <CardContent className="p-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-semibold leading-tight line-clamp-2">{i.titulo}</p>
                          <div className="flex items-center gap-0.5 text-[10px] font-mono text-primary shrink-0">
                            <TrendingUp className="h-3 w-3" />
                            {i.score?.toFixed(1) ?? "—"}
                          </div>
                        </div>
                        {i.descricao && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{i.descricao}</p>
                        )}
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge className={`${catColor(i.categoria)} border text-[9px] px-1.5 py-0`}>
                            {catLabel(i.categoria)}
                          </Badge>
                          {i.modulo && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {modLabel(i.modulo)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                          <span className="text-[9px] text-muted-foreground capitalize">{i.autor}</span>
                          <div className="flex items-center gap-2 text-[9px] font-mono">
                            <span title="Impacto" className="text-emerald-400">I{i.impacto}</span>
                            <span title="Esforço" className="text-amber-400">E{i.esforco}</span>
                          </div>
                        </div>
                        {/* Status quick-move */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 pt-1">
                          <Select
                            value={i.status}
                            onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}
                          >
                            <SelectTrigger
                              className="h-6 text-[10px] flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_COLUMNS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remover "${i.titulo}"?`)) deleteIdeia.mutate(i.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <p className="text-center text-[10px] text-muted-foreground py-4">vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Ideia" : "Nova Ideia"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Adicionar simulador de ROI no diagnóstico"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                placeholder="Por quê? Para quem? Qual problema resolve?"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Módulo Core OS</Label>
                <Select value={form.modulo} onValueChange={(v) => setForm({ ...form, modulo: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULOS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Autor</Label>
                <Select value={form.autor} onValueChange={(v) => setForm({ ...form, autor: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUTORES.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Impacto (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.impacto} onChange={(e) => setForm({ ...form, impacto: Number(e.target.value) })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Esforço (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.esforco} onChange={(e) => setForm({ ...form, esforco: Number(e.target.value) })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_COLUMNS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tags (vírgula)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="rag, whatsapp, dashboard" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Link de origem</Label>
                <Input value={form.link_origem} onChange={(e) => setForm({ ...form, link_origem: e.target.value })} placeholder="https://..." className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
            <Button
              className="w-full"
              disabled={!form.titulo.trim() || upsertIdeia.isPending}
              onClick={() => upsertIdeia.mutate()}
            >
              {upsertIdeia.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Atualizar" : "Capturar Ideia"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
