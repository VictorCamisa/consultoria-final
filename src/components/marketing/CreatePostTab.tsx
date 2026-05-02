import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNichos } from "@/hooks/useNichos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Sparkles, Loader2, Download, Wand2, ImageIcon, CheckCircle2, AlertTriangle, Layers,
  Eye, Brain, Palette,
} from "lucide-react";
import { treatImage, dataUrlToBlob } from "@/lib/imageryTreatment";

type Slide = {
  id: string;
  slide_n: number;
  template_id: string;
  needs_image: boolean;
  image_brief: string | null;
  image_type: string | null;
  raw_image_url: string | null;
  treated_image_url: string | null;
  final_png_url: string | null;
  validation_score: any;
  copy_data: any;
  status: string;
  error_message: string | null;
};

const TEMPLATE_LABEL: Record<string, string> = {
  T01_HOOK_BIG_TEXT: "Hook · Big Text",
  T02_PROBLEM_STATEMENT: "Problema",
  T03_DATA_POINT: "Dado",
  T04_BEFORE_AFTER: "Antes/Depois",
  T05_PROCESS_STEP: "Etapa",
  T06_QUOTE_FOUNDER: "Citação",
  T07_SOLUTION_REVEAL: "Solução",
  T08_CTA_FINAL: "CTA Final",
};

const QUICK_THEMES = [
  "Por que seu time comercial é caro e ineficiente",
  "Follow-up no WhatsApp sem depender de humano",
  "Como uma clínica trocou recepcionista por IA",
  "O CRM morreu. O que vem depois.",
];

export function CreatePostTab() {
  const qc = useQueryClient();
  const { labels: nichoLabels } = useNichos();

  const [tema, setTema] = useState("");
  const [nicho, setNicho] = useState("Estética");
  const [objetivo, setObjetivo] = useState("Educar sobre dor + apresentar solução VS");
  const [tipo, setTipo] = useState<"carrossel" | "feed_unico" | "story">("carrossel");
  const [nSlides, setNSlides] = useState(5);

  const [postId, setPostId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [treating, setTreating] = useState<Record<string, boolean>>({});

  // Polling do post
  const { data: post } = useQuery({
    queryKey: ["imagery-post", postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from("imagery_posts")
        .select("*")
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!postId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s === "generating" || s === "planning" ? 2500 : false;
    },
  });

  const { data: slides } = useQuery({
    queryKey: ["imagery-slides", postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from("imagery_slides")
        .select("*")
        .eq("post_id", postId)
        .order("slide_n");
      if (error) throw error;
      return (data ?? []) as Slide[];
    },
    enabled: !!postId,
    refetchInterval: (q) => {
      const arr = (q.state.data as Slide[] | undefined) ?? [];
      const incomplete = arr.some((s) => !["ready", "failed"].includes(s.status));
      return incomplete ? 2500 : false;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["imagery-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imagery_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handlePlan = async () => {
    if (!tema.trim()) return toast.error("Descreva o tema");
    setPlanLoading(true);
    setPostId(null);
    try {
      const { data, error } = await supabase.functions.invoke("imagery-plan-post", {
        body: { tema, nicho, objetivo, tipo, n_slides: nSlides },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPostId(data.post_id);
      qc.invalidateQueries({ queryKey: ["imagery-history"] });
      toast.success(`Plano criado · ${data.plan?.slides?.length} slides`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Erro no planner");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!postId) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("imagery-orchestrate", {
        body: { post_id: postId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Pipeline rodou · ${data.ok}/${data.total} slides ok · $${(data.custo_total_usd ?? 0).toFixed(3)}`);
      qc.invalidateQueries({ queryKey: ["imagery-slides", postId] });
      qc.invalidateQueries({ queryKey: ["imagery-post", postId] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Erro no pipeline");
    } finally {
      setGenLoading(false);
    }
  };

  const handleTreatAndRecompose = async (slide: Slide) => {
    if (!slide.raw_image_url) return toast.error("Sem imagem raw");
    setTreating((p) => ({ ...p, [slide.id]: true }));
    try {
      // 1. trata no client
      const treatedDataUrl = await treatImage(slide.raw_image_url);
      const blob = await dataUrlToBlob(treatedDataUrl);
      const path = `${slide.id}/treated_${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("imagery").upload(path, blob, {
        contentType: "image/png", upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("imagery").getPublicUrl(path);

      await supabase.from("imagery_slides").update({
        treated_image_url: urlData.publicUrl,
      }).eq("id", slide.id);

      // 2. recompõe slide com a treated
      const { data: cmp, error: cmpErr } = await supabase.functions.invoke("imagery-compose-slide", {
        body: { slide_id: slide.id, treated_image_url: urlData.publicUrl },
      });
      if (cmpErr) throw new Error(cmpErr.message);
      if (cmp?.error) throw new Error(cmp.error);

      qc.invalidateQueries({ queryKey: ["imagery-slides", postId] });
      toast.success("Imagem tratada + recomposta");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Erro no tratamento");
    } finally {
      setTreating((p) => ({ ...p, [slide.id]: false }));
    }
  };

  const downloadAll = async () => {
    if (!slides?.length) return;
    for (const s of slides) {
      const url = s.final_png_url;
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.download = `slide_${s.slide_n}.png`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const planReady = post?.status === "draft" || post?.status === "ready" || post?.status === "generating";
  const totalUsd = Number(post?.custo_total_usd ?? 0);

  return (
    <div className="space-y-4">
      <Card className="border-accent/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-accent" />
            Imagery Engine v1.0 · Pipeline editorial
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            5 etapas: <b>Plan → Generate → Validate → Treat → Compose</b>. Resultado: post nível agência.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Tema do post (ex: 'Como pararem de perder leads no WhatsApp')"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            rows={2}
            className="resize-none"
          />

          <Input
            placeholder="Objetivo (ex: educar sobre dor X)"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-2">
            <Select value={nicho} onValueChange={setNicho}>
              <SelectTrigger><SelectValue placeholder="Nicho" /></SelectTrigger>
              <SelectContent>
                {nichoLabels.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="carrossel">Carrossel</SelectItem>
                <SelectItem value="feed_unico">Feed único</SelectItem>
                <SelectItem value="story">Story</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(nSlides)} onValueChange={(v) => setNSlides(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 3, 5, 7, 10].map((n) => <SelectItem key={n} value={String(n)}>{n} slide{n > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTema(t)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handlePlan} disabled={planLoading || genLoading} variant="outline">
              {planLoading
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Planejando...</>
                : <><Brain className="h-4 w-4 mr-1" />1. Planejar Post</>}
            </Button>
            <Button onClick={handleGenerate} disabled={!planReady || genLoading || planLoading} className="ml-auto">
              {genLoading
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Pipeline rodando...</>
                : <><Sparkles className="h-4 w-4 mr-1" />2. Gerar Imagens (Pipeline)</>}
            </Button>
          </div>

          {post && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <Badge variant={post.status === "ready" ? "default" : "secondary"} className="text-[10px]">
                {post.status}
              </Badge>
              <span>Custo: <b>${totalUsd.toFixed(3)}</b></span>
              <span>·</span>
              <span>{slides?.length ?? 0} slides</span>
              {post.status === "ready" && (
                <Button size="sm" variant="outline" className="ml-auto" onClick={downloadAll}>
                  <Download className="h-3 w-3 mr-1" />Baixar tudo
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {post?.copy_data && (() => {
        const cd = post.copy_data as any;
        return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-accent" />
              {cd.titulo ?? "Post"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{cd.caption}</p>
            {!!cd.hashtags?.length && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cd.hashtags.map((h: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[9px]">#{h.replace(/^#/, "")}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        );
      })()}

      {!!slides?.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {slides.map((s) => (
            <Card key={s.id} className="border-accent/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">#{s.slide_n}</Badge>
                    <span>{TEMPLATE_LABEL[s.template_id] ?? s.template_id}</span>
                  </CardTitle>
                  <SlideStatus status={s.status} score={s.validation_score} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="aspect-square rounded-lg bg-secondary/50 overflow-hidden border border-border flex items-center justify-center">
                  {s.final_png_url ? (
                    <img src={s.final_png_url} alt="" className="w-full h-full object-cover" />
                  ) : s.raw_image_url ? (
                    <img src={s.raw_image_url} alt="" className="w-full h-full object-cover opacity-60" />
                  ) : ["generating", "validating", "composing"].includes(s.status) ? (
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground">
                  <p className="font-semibold text-foreground line-clamp-1">{s.copy_data?.headline}</p>
                  {s.copy_data?.sub_text && <p className="line-clamp-2">{s.copy_data.sub_text}</p>}
                  {s.image_brief && (
                    <p className="mt-1 italic line-clamp-2 opacity-70">📷 {s.image_brief}</p>
                  )}
                </div>

                {s.validation_score && (
                  <div className="grid grid-cols-4 gap-1 text-[9px]">
                    <ScoreBadge label="Brand" v={s.validation_score.brand_fit} />
                    <ScoreBadge label="Brief" v={s.validation_score.brief_match} />
                    <ScoreBadge label="Tech" v={s.validation_score.tech_quality} />
                    <ScoreBadge label="Use" v={s.validation_score.usability} />
                  </div>
                )}

                <div className="flex gap-1 pt-1">
                  {s.raw_image_url && (
                    <Button
                      size="sm" variant="outline" className="flex-1 text-[10px] h-7"
                      onClick={() => handleTreatAndRecompose(s)}
                      disabled={!!treating[s.id]}
                    >
                      {treating[s.id]
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><Palette className="h-3 w-3 mr-1" />Tratar + Recompor</>}
                    </Button>
                  )}
                  {s.final_png_url && (
                    <Button
                      size="sm" variant="outline" className="text-[10px] h-7"
                      onClick={() => window.open(s.final_png_url!, "_blank")}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {s.error_message && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />{s.error_message}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!!(history as any[])?.length && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Histórico
          </h3>
          <div className="space-y-1.5">
            {(history as any[]).map((h) => (
              <Card
                key={h.id}
                className="hover:border-accent/30 transition-colors cursor-pointer"
                onClick={() => setPostId(h.id)}
              >
                <CardContent className="p-2.5 flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px]">{h.tipo}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{h.tema}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{h.nicho} · {h.n_slides} slides · ${Number(h.custo_total_usd ?? 0).toFixed(3)}</p>
                  </div>
                  <Badge variant={h.status === "ready" ? "default" : "secondary"} className="text-[9px]">
                    {h.status}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">
                    {format(new Date(h.created_at), "dd/MM HH:mm")}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SlideStatus({ status, score }: { status: string; score: any }) {
  if (status === "ready") {
    const media = score?.media;
    return (
      <Badge variant="default" className="text-[10px] gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {media ? `${media}/10` : "ok"}
      </Badge>
    );
  }
  if (status === "failed") {
    return <Badge variant="destructive" className="text-[10px]">falhou</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-[10px] gap-1">
      <Loader2 className="h-2.5 w-2.5 animate-spin" />
      {status}
    </Badge>
  );
}

function ScoreBadge({ label, v }: { label: string; v: number }) {
  const color = v >= 7 ? "bg-green-500/15 text-green-600" : v >= 5 ? "bg-yellow-500/15 text-yellow-600" : "bg-red-500/15 text-red-600";
  return (
    <div className={`px-1.5 py-0.5 rounded text-center ${color}`}>
      <div className="opacity-70">{label}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}