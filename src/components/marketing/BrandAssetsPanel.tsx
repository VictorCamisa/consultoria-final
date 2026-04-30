import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Plus, ImagePlus, FileText, CheckCircle, Ban, Trash2, Zap,
} from "lucide-react";

type BrandAsset = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  file_url: string | null;
  is_active: boolean;
  created_at: string;
};

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  logo: { label: "Logo", emoji: "🎨" },
  manual: { label: "Manual de Marca", emoji: "📖" },
  reference: { label: "Referência Visual", emoji: "📸" },
  rule: { label: "Regra de Criação", emoji: "📋" },
  palette: { label: "Paleta de Cores", emoji: "🎨" },
  typography: { label: "Tipografia", emoji: "✏️" },
  tone: { label: "Tom de Voz", emoji: "🗣️" },
};

export function BrandAssetsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [newAsset, setNewAsset] = useState({ type: "rule", title: "", content: "", file_url: "" });
  const [uploading, setUploading] = useState(false);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["vs-brand-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_brand_assets" as any)
        .select("*")
        .order("type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BrandAsset[];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const isReference = newAsset.type === "reference";
    const fileList = Array.from(files).slice(0, 20);

    if (!isReference || fileList.length === 1) {
      const file = fileList[0];
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `brand/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("vs-marketing").upload(path, file, { upsert: true });
      if (error) { toast.error("Erro ao fazer upload"); setUploading(false); return; }
      const { data: pub } = supabase.storage.from("vs-marketing").getPublicUrl(path);
      setNewAsset((a) => ({ ...a, file_url: pub.publicUrl }));
      toast.success("Arquivo enviado!");
      setUploading(false);
    } else {
      setUploading(true);
      let success = 0;
      for (const file of fileList) {
        const ext = file.name.split(".").pop();
        const path = `brand/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("vs-marketing").upload(path, file, { upsert: true });
        if (error) continue;
        const { data: pub } = supabase.storage.from("vs-marketing").getPublicUrl(path);
        const title = newAsset.title.trim() || `Referência ${file.name}`;
        await supabase.from("vs_brand_assets" as any).insert({
          type: "reference",
          title,
          content: newAsset.content || null,
          file_url: pub.publicUrl,
        });
        success++;
      }
      if (success > 0) {
        toast.success(`${success} referência(s) adicionada(s)!`);
        qc.invalidateQueries({ queryKey: ["vs-brand-assets"] });
        setNewAsset({ type: "reference", title: "", content: "", file_url: "" });
      } else toast.error("Nenhum arquivo enviado");
      setUploading(false);
    }
    e.target.value = "";
  };

  const handleAdd = async () => {
    if (!newAsset.title.trim()) return toast.error("Título é obrigatório");
    const { error } = await supabase.from("vs_brand_assets" as any).insert({
      type: newAsset.type,
      title: newAsset.title,
      content: newAsset.content || null,
      file_url: newAsset.file_url || null,
    });
    if (error) return toast.error("Erro ao salvar");
    toast.success("Ativo adicionado!");
    setNewAsset({ type: "rule", title: "", content: "", file_url: "" });
    qc.invalidateQueries({ queryKey: ["vs-brand-assets"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vs_brand_assets" as any).delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["vs-brand-assets"] });
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase.from("vs_brand_assets" as any).update({ is_active: !current }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    qc.invalidateQueries({ queryKey: ["vs-brand-assets"] });
  };

  const grouped = useMemo(() => {
    const g: Record<string, BrandAsset[]> = {};
    (assets || []).forEach((a) => {
      if (!g[a.type]) g[a.type] = [];
      g[a.type].push(a);
    });
    return g;
  }, [assets]);

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" />
            Central de Marca VS — Assets & Diretrizes
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tudo aqui é injetado na IA quando ela gera posts: logo, manual, regras, tom de voz e referências visuais.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3">
          <p className="text-xs font-semibold">Adicionar novo ativo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={newAsset.type} onValueChange={(v) => setNewAsset((a) => ({ ...a, type: v }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Título (ex: Logo principal, Regra de hashtags)"
              value={newAsset.title}
              onChange={(e) => setNewAsset((a) => ({ ...a, title: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>
          <Textarea
            placeholder="Conteúdo / regras (a IA vai ler este texto)..."
            value={newAsset.content}
            onChange={(e) => setNewAsset((a) => ({ ...a, content: e.target.value }))}
            rows={3}
            className="text-xs"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" className="text-xs" asChild disabled={uploading}>
                <span>
                  {uploading
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Enviando...</>
                    : <><ImagePlus className="h-3 w-3 mr-1" />Upload Arquivo</>}
                </span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
                multiple={newAsset.type === "reference"}
                onChange={handleUpload}
              />
            </label>
            {newAsset.type === "reference" && (
              <span className="text-[10px] text-muted-foreground">Até 20 arquivos por vez</span>
            )}
            {newAsset.file_url && newAsset.type !== "reference" && (
              <Badge variant="secondary" className="text-[10px]">✅ Arquivo anexado</Badge>
            )}
            <Button size="sm" className="ml-auto text-xs" onClick={handleAdd} disabled={!newAsset.title.trim()}>
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">
              Nenhum ativo cadastrado. Adicione logo, manual e regras para a IA produzir posts com a cara da VS.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {TYPE_LABELS[type]?.emoji} {TYPE_LABELS[type]?.label || type}
                </p>
                <div className="space-y-1.5">
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                        a.is_active ? "bg-secondary/30 border-accent/10" : "bg-muted/30 border-border opacity-60"
                      }`}
                    >
                      {a.file_url && (
                        a.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                          <img src={a.file_url} alt={a.title} className="h-10 w-10 rounded-md object-cover border border-accent/20" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-accent/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-accent" />
                          </div>
                        )
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.title}</p>
                        {a.content && <p className="text-[10px] text-muted-foreground line-clamp-1">{a.content}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={a.is_active ? "Desativar" : "Ativar"}
                          onClick={() => handleToggle(a.id, a.is_active)}
                        >
                          {a.is_active
                            ? <CheckCircle className="h-3.5 w-3.5 text-success" />
                            : <Ban className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          title="Excluir"
                          onClick={() => handleDelete(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}