import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Package, Loader2 } from "lucide-react";

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  tipo: string;
  preco_min: number | null;
  preco_max: number | null;
  preco_fixo: number | null;
  nichos: string[];
  ativo: boolean;
  destaque: boolean;
  ordem: number;
  obs: string | null;
};

const tipoLabel: Record<string, string> = { unico: "Pagamento único", recorrente: "Recorrente" };
const categoriaLabel: Record<string, string> = { servico: "Serviço", produto: "Produto" };

function fmt(n: number | null) {
  if (n == null) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function precoDisplay(p: Produto) {
  if (p.preco_fixo != null) return fmt(p.preco_fixo);
  if (p.preco_min != null && p.preco_max != null) return `${fmt(p.preco_min)} – ${fmt(p.preco_max)}`;
  if (p.preco_min != null) return `A partir de ${fmt(p.preco_min)}`;
  return "—";
}

const EMPTY: Omit<Produto, "id"> = {
  nome: "", descricao: "", categoria: "servico", tipo: "recorrente",
  preco_min: null, preco_max: null, preco_fixo: null,
  nichos: [], ativo: true, destaque: false, ordem: 0, obs: "",
};

export default function Produtos() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState<Omit<Produto, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["vs-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_produtos" as any)
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(p: Produto) {
    setEditing(p);
    setForm({ ...p });
    setModalOpen(true);
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        preco_min: form.preco_min || null,
        preco_max: form.preco_max || null,
        preco_fixo: form.preco_fixo || null,
      };
      if (editing) {
        const { error } = await supabase.from("vs_produtos" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Produto atualizado!" });
      } else {
        const { error } = await supabase.from("vs_produtos" as any).insert(payload);
        if (error) throw error;
        toast({ title: "Produto criado!" });
      }
      qc.invalidateQueries({ queryKey: ["vs-produtos"] });
      setModalOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este produto?")) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from("vs_produtos" as any).delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["vs-produtos"] });
      toast({ title: "Produto excluído" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  async function toggleAtivo(p: Produto) {
    await supabase.from("vs_produtos" as any).update({ ativo: !p.ativo }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["vs-produtos"] });
  }

  const ativos = produtos?.filter(p => p.ativo) ?? [];
  const inativos = produtos?.filter(p => !p.ativo) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="vs-h1">Produtos & Serviços</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{produtos?.length ?? 0} itens no catálogo</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />Novo Produto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Ativos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ativos.map(p => (
              <Card key={p.id} className={`relative transition-all ${p.destaque ? "border-primary/40 shadow-primary/10 shadow-md" : ""}`}>
                {p.destaque && (
                  <div className="absolute top-3 right-3">
                    <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                  </div>
                )}
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start gap-2 pr-5">
                    <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm leading-tight">{p.nome}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] px-1.5">{categoriaLabel[p.categoria] ?? p.categoria}</Badge>
                        <Badge variant="secondary" className="text-[9px] px-1.5">{tipoLabel[p.tipo] ?? p.tipo}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {p.descricao && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{p.descricao}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold tabular text-primary">{precoDisplay(p)}</p>
                    {p.tipo === "recorrente" && <span className="text-[10px] text-muted-foreground">/mês</span>}
                  </div>

                  {p.nichos.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {p.nichos.map(n => (
                        <Badge key={n} variant="outline" className="text-[9px] px-1.5">{n}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3 mr-1" />Editar
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                    >
                      {deleting === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[10px] text-muted-foreground">Ativo</span>
                      <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} className="scale-75" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty state */}
            {ativos.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-3">
                <Package className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum produto cadastrado</p>
                <Button size="sm" variant="outline" onClick={openNew}>Criar primeiro produto</Button>
              </div>
            )}
          </div>

          {/* Inativos */}
          {inativos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inativos ({inativos.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-50">
                {inativos.map(p => (
                  <div key={p.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{precoDisplay(p)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Switch checked={false} onCheckedChange={() => toggleAtivo(p)} className="scale-75" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Ecossistema IA — Estética" />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao ?? ""} onChange={e => set("descricao", e.target.value)} rows={3} placeholder="O que está incluso, para quem é..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => set("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="produto">Produto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de cobrança</Label>
                <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recorrente">Recorrente (mensal)</SelectItem>
                    <SelectItem value="unico">Pagamento único</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Preço mínimo (R$)</Label>
                <Input type="number" value={form.preco_min ?? ""} onChange={e => set("preco_min", e.target.value ? Number(e.target.value) : null)} placeholder="1200" />
              </div>
              <div className="space-y-1.5">
                <Label>Preço máximo (R$)</Label>
                <Input type="number" value={form.preco_max ?? ""} onChange={e => set("preco_max", e.target.value ? Number(e.target.value) : null)} placeholder="3500" />
              </div>
              <div className="space-y-1.5">
                <Label>Preço fixo (R$)</Label>
                <Input type="number" value={form.preco_fixo ?? ""} onChange={e => set("preco_fixo", e.target.value ? Number(e.target.value) : null)} placeholder="Ou fixo" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nichos (separados por vírgula)</Label>
              <Input
                value={form.nichos.join(", ")}
                onChange={e => set("nichos", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                placeholder="Estética, Odonto, Advocacia..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ordem (menor = primeiro)</Label>
              <Input type="number" value={form.ordem} onChange={e => set("ordem", Number(e.target.value))} min={0} />
            </div>

            <div className="space-y-1.5">
              <Label>Observações internas</Label>
              <Textarea value={form.obs ?? ""} onChange={e => set("obs", e.target.value)} rows={2} placeholder="Notas internas, restrições, combos..." />
            </div>

            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2.5">
                <Switch id="ativo" checked={form.ativo} onCheckedChange={v => set("ativo", v)} />
                <Label htmlFor="ativo" className="cursor-pointer">Ativo</Label>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch id="destaque" checked={form.destaque} onCheckedChange={v => set("destaque", v)} />
                <Label htmlFor="destaque" className="cursor-pointer">Destaque</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editing ? "Salvar alterações" : "Criar produto"}
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
