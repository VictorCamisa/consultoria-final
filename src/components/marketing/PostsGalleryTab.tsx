import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, Loader2, Download, Copy, Trash2, FileText, ImagePlus, Globe, Calendar } from "lucide-react";

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: "📸", LinkedIn: "💼", Facebook: "📘", WhatsApp: "💬",
};

export function PostsGalleryTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["vs-marketing-posts-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_marketing_posts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (!search) return posts;
    const q = search.toLowerCase();
    return posts.filter((p: any) =>
      p.caption?.toLowerCase().includes(q) ||
      p.prompt?.toLowerCase().includes(q) ||
      p.platform?.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const total = posts?.length || 0;
  const withImage = posts?.filter((p: any) => p.image_url).length || 0;
  const platforms = new Set((posts || []).map((p: any) => p.platform)).size;
  const thisMonth = posts?.filter(
    (p: any) => new Date(p.created_at).getMonth() === new Date().getMonth()
  ).length || 0;

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este post?")) return;
    const { error } = await supabase.from("vs_marketing_posts" as any).delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["vs-marketing-posts-gallery"] });
    qc.invalidateQueries({ queryKey: ["vs-marketing-posts-history"] });
  };

  const kpis = [
    { label: "Posts Criados", value: total, icon: FileText },
    { label: "Com Imagem", value: withImage, icon: ImagePlus },
    { label: "Plataformas", value: platforms, icon: Globe },
    { label: "Este Mês", value: thisMonth, icon: Calendar },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
                <k.icon className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por legenda, prompt ou plataforma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum post salvo. Crie posts na aba "Criar Post" e eles aparecerão aqui.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p: any) => (
            <Card key={p.id} className="hover:border-accent/30 transition-colors overflow-hidden group">
              {p.image_url && (
                <div className="aspect-square overflow-hidden relative">
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <a href={p.image_url} download target="_blank" rel="noreferrer">
                        <Button size="sm" variant="secondary" className="h-7 text-[10px]">
                          <Download className="h-3 w-3 mr-1" />Baixar
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[10px]"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            p.caption + "\n\n" + (p.hashtags || []).map((h: string) =>
                              h.startsWith("#") ? h : `#${h}`
                            ).join(" ")
                          );
                          toast.success("Copiado!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />Legenda
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-[10px]"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{PLATFORM_EMOJI[p.platform] || "📝"}</span>
                    <span className="text-xs font-semibold">{p.platform}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM/yy HH:mm")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{p.caption}</p>
                {p.hashtags && (p.hashtags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(p.hashtags as string[]).slice(0, 5).map((h: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">
                        {h.startsWith("#") ? h : `#${h}`}
                      </Badge>
                    ))}
                    {(p.hashtags as string[]).length > 5 && (
                      <Badge variant="outline" className="text-[9px]">
                        +{(p.hashtags as string[]).length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}