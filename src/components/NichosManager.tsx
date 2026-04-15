import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNichos, NichoRecord } from "@/hooks/useNichos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJI_PRESETS = [
  "💆", "🦷", "⚖️", "🚗", "🐾", "🏠", "🍕", "💊", "🏋️", "📚",
  "🎨", "💻", "🔧", "🌿", "👗", "📷", "🎵", "✈️", "🏢", "🧹",
  "💈", "🍽️", "☕", "🛒", "🏥", "👶", "🐕", "🌸", "🔒", "📱",
];

const COLOR_PRESETS = [
  { label: "Rosa", color: "bg-pink-500/15 border-pink-500/30 text-pink-400", dot: "bg-pink-500" },
  { label: "Ciano", color: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400", dot: "bg-cyan-500" },
  { label: "Âmbar", color: "bg-amber-500/15 border-amber-500/30 text-amber-400", dot: "bg-amber-500" },
  { label: "Azul", color: "bg-blue-500/15 border-blue-500/30 text-blue-400", dot: "bg-blue-500" },
  { label: "Verde", color: "bg-green-500/15 border-green-500/30 text-green-400", dot: "bg-green-500" },
  { label: "Roxo", color: "bg-purple-500/15 border-purple-500/30 text-purple-400", dot: "bg-purple-500" },
  { label: "Vermelho", color: "bg-red-500/15 border-red-500/30 text-red-400", dot: "bg-red-500" },
  { label: "Cinza", color: "bg-gray-500/15 border-gray-500/30 text-gray-400", dot: "bg-gray-500" },
];

type FormState = {
  label: string;
  keywords: string;
  icon: string;
  search_value: string;
  colorIndex: number;
};

const emptyForm: FormState = { label: "", keywords: "", icon: "🏢", search_value: "", colorIndex: 7 };

export default function NichosManager() {
  const queryClient = useQueryClient();
  const { nichos } = useNichos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const set = (key: keyof FormState, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const upsertNicho = useMutation({
    mutationFn: async () => {
      const preset = COLOR_PRESETS[form.colorIndex] ?? COLOR_PRESETS[7];
      const payload = {
        label: form.label.trim(),
        keywords: form.keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean),
        icon: form.icon || "🏢",
        search_value: form.search_value.trim(),
        color: preset.color,
        dot: preset.dot,
        ordem: nichos.length + 1,
      };
      if (editingId) {
        const { error } = await supabase.from("consultoria_nichos").update(payload as any).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultoria_nichos").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nichos"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: editingId ? "Nicho atualizado!" : "Nicho criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteNicho = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consultoria_nichos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nichos"] });
      toast({ title: "Nicho removido" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openEdit = (n: NichoRecord) => {
    const ci = COLOR_PRESETS.findIndex(p => p.color === n.color);
    setForm({
      label: n.label,
      keywords: n.keywords.join(", "),
      icon: n.icon,
      search_value: n.search_value,
      colorIndex: ci >= 0 ? ci : 7,
    });
    setEditingId(n.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Nichos Cadastrados</CardTitle>
              <CardDescription>Gerencie os nichos de atuação. Eles aparecem em todo o sistema.</CardDescription>
            </div>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Novo Nicho</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nichos.map(n => (
              <div key={n.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{n.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{n.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Keywords: {n.keywords.join(", ")} · Busca: {n.search_value || "—"}
                    </p>
                  </div>
                  <Badge className={`${n.color} border text-[10px]`}>{n.label}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(n)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Remover o nicho "${n.label}"?`)) deleteNicho.mutate(n.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {nichos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum nicho cadastrado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Nicho" : "Novo Nicho"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Ex: Casas de Ração" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palavras-chave (separadas por vírgula) *</Label>
              <Input value={form.keywords} onChange={e => set("keywords", e.target.value)} placeholder="ração, pet, animal" className="h-9" />
              <p className="text-[10px] text-muted-foreground">Usadas para classificar prospects automaticamente</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ícone (emoji)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start text-lg">
                      {form.icon || "🏢"} <span className="ml-2 text-xs text-muted-foreground">Clique para trocar</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <div className="grid grid-cols-6 gap-1">
                      {EMOJI_PRESETS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => set("icon", e)}
                          className={`text-xl p-1.5 rounded hover:bg-accent transition-colors ${form.icon === e ? "bg-accent ring-2 ring-primary" : ""}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Termo de busca (prospecção)</Label>
                <Input value={form.search_value} onChange={e => set("search_value", e.target.value)} placeholder="casas de ração pet shops" className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => set("colorIndex", i)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${c.dot} ${form.colorIndex === i ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-60 hover:opacity-100"}`}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.label.trim() || !form.keywords.trim() || upsertNicho.isPending}
              onClick={() => upsertNicho.mutate()}
            >
              {upsertNicho.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar Nicho"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
