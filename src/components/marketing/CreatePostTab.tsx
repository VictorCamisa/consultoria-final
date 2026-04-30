import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNichos } from "@/hooks/useNichos";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Sparkles, Loader2, ImagePlus, Image, Copy, Download, Hash, Lightbulb,
  Clock, BookOpen, Smartphone,
} from "lucide-react";
import { BrandAssetsPanel } from "./BrandAssetsPanel";
import { renderAndUpload } from "@/lib/vsPostRenderer";
import vsLogoUrl from "@/assets/vs-logo-light.png";

type GeneratedPost = {
  image_headline?: string;
  caption: string;
  hashtags: string[];
  platform_tips: string;
  visual_suggestion: string;
  best_time: string;
};

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: "📸", LinkedIn: "💼", Facebook: "📘", WhatsApp: "💬",
};

const QUICK_IDEAS = [
  "Por que seu time comercial é caro e ineficiente",
  "Follow-up no WhatsApp sem depender de humano",
  "Como uma clínica substituiu a recepcionista por IA",
  "O CRM morreu. O que vem depois.",
  "Quanto custa um vendedor que não vende",
  "Pare de contratar. Comece a automatizar.",
];

export function CreatePostTab() {
  const qc = useQueryClient();
  const { labels: nichoLabels } = useNichos();
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [postFormat, setPostFormat] = useState<"feed" | "story" | "square">("feed");
  const [nicho, setNicho] = useState<string>("none");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageVariant, setImageVariant] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [showBrandAssets, setShowBrandAssets] = useState(false);

  const { data: brandAssets } = useQuery({
    queryKey: ["vs-brand-assets-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_brand_assets" as any)
        .select("*")
        .eq("is_active", true)
        .order("type");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["vs-marketing-posts-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_marketing_posts" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const referenceContext = useMemo(() => {
    return ((brandAssets as any[]) || [])
      .filter((a) => a.type === "reference" && a.content)
      .map((a, i) => `Referência ${i + 1}: ${a.title} — ${a.content}`)
      .join("\n");
  }, [brandAssets]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("Descreva o que deseja para o post");
    setLoading(true);
    setGeneratedPost(null);
    setGeneratedImage(null);
    setBgImage(null);

    try {
      // Generate post text directly via Gemini (no edge function, no OpenAI dependency)
      const systemPrompt = `Você é um especialista em marketing B2B para a empresa VS (Vendas de Soluções), que vende automação comercial, IA e CRM para empresas. Crie posts virais e impactantes para ${platform}.

${referenceContext ? `CONTEXTO DA MARCA:\n${referenceContext}\n` : ""}${nicho !== "none" ? `NICHO: ${nicho}\n` : ""}
TEMA DO POST: ${prompt}

IMPORTANTE: Retorne SOMENTE o JSON abaixo, sem nenhum texto antes ou depois, sem markdown, sem \`\`\`json:
{"image_headline":"2 PALAVRAS IMPACTANTES","caption":"legenda completa engajante com emojis e quebras de linha usando \\n","hashtags":["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5"],"platform_tips":"dica de horário","visual_suggestion":"descrição visual específica para a foto de fundo","best_time":"horário"}`;


      const geminiTextRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: 1200,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );

      if (!geminiTextRes.ok) {
        const errText = await geminiTextRes.text();
        throw new Error(`Gemini text error: ${geminiTextRes.status} ${errText.slice(0, 200)}`);
      }

      const geminiTextData = await geminiTextRes.json();
      // With thinkingBudget:0, response is a single part - get its text directly
      const allParts = geminiTextData?.candidates?.[0]?.content?.parts ?? [];
      const rawText = allParts.filter((p: any) => !p.thought).map((p: any) => p.text || "").join("").trim();

      // Sanitize JSON: escape literal newlines inside string values so JSON.parse works
      const sanitizeJSON = (s: string) => {
        let out = ""; let inStr = false; let esc = false;
        for (const c of s) {
          if (esc) { out += c; esc = false; continue; }
          if (c === "\\" && inStr) { out += c; esc = true; continue; }
          if (c === '"') { out += c; inStr = !inStr; continue; }
          if (inStr && (c === "\n" || c === "\r")) { out += "\\n"; continue; }
          out += c;
        }
        return out;
      };

      let post: GeneratedPost;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        post = JSON.parse(sanitizeJSON(jsonMatch[0]));
        if (!post.caption) throw new Error("Missing caption");
      } catch {
        try {
          const cleaned = rawText.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
          post = JSON.parse(sanitizeJSON(cleaned));
        } catch {
          post = {
            image_headline: prompt.split(" ").slice(0, 3).join(" ").toUpperCase(),
            caption: `${prompt}\n\nTransforme seu processo comercial com automação e IA. Reduza custos, aumente velocidade e escale sem contratar mais.`,
            hashtags: ["#VS", "#AutomacaoComercial", "#IA", "#CRM", "#Vendas"],
            platform_tips: "Poste entre 9h-11h para melhor alcance.",
            visual_suggestion: "Executivo em ambiente corporativo moderno.",
            best_time: "9h-11h",
          };
        }
      }



      setGeneratedPost(post);
      toast.success("Post gerado! ✨");

      const { data: saved, error: saveErr } = await supabase
        .from("vs_marketing_posts" as any)
        .insert({
          platform,
          prompt,
          caption: post.caption,
          hashtags: post.hashtags || [],
          best_time: post.best_time || null,
          nicho: nicho !== "none" ? nicho : null,
          status: "rascunho",
        } as any)
        .select("id")
        .single();
      if (saveErr) console.error("Save post error:", saveErr);
      const savedId = (saved as any)?.id;

      setImageLoading(true);
      try {
        // Generate photorealistic background directly via Gemini API (client-side, no edge function needed)
        let newBgUrl: string | undefined = undefined;
        try {
          // Build a specific image prompt based on actual post content
          const topicForPhoto = post.visual_suggestion
            ? post.visual_suggestion.slice(0, 200)
            : prompt.slice(0, 150);
          const geminiPrompt = [
            `Cinematic editorial photography for a B2B business post about: ${topicForPhoto}.`,
            "Style: Bloomberg Businessweek cover, HBO Succession, high-end corporate.",
            "Lighting: dramatic, moody, side-lit or rim-lit. Dark background with selective focus.",
            "ONLY photorealistic. NO text, NO logos, NO charts, NO icons, NO robots, NO illustrations, NO cartoons.",
          ].join(" ");

          const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY as string;
          const imagenRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instances: [{ prompt: geminiPrompt }],
                parameters: { sampleCount: 1, aspectRatio: "9:16", safetyFilterLevel: "block_some", personGeneration: "allow_adult" },
              }),
            }
          );

          if (imagenRes.ok) {
            const imagenData = await imagenRes.json();
            const b64Img = imagenData?.predictions?.[0]?.bytesBase64Encoded;
            if (b64Img) {
              const mimeType = "image/png";
              const byteChars = atob(b64Img);
              const byteArr = new Uint8Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
              const blob = new Blob([byteArr], { type: mimeType });
              const bgFileName = `posts/${Date.now()}-bg-imagen4.png`;
              const { error: bgUploadErr } = await supabase.storage
                .from("vs-marketing")
                .upload(bgFileName, blob, { contentType: mimeType, upsert: true });
              newBgUrl = bgUploadErr
                ? `data:${mimeType};base64,${b64Img}`
                : supabase.storage.from("vs-marketing").getPublicUrl(bgFileName).data.publicUrl;
            }
          } else {
            console.warn("Imagen 4 error:", imagenRes.status, await imagenRes.text().then(t => t.slice(0, 300)));
          }

        } catch (bgErr) {
          console.warn("Background photo generation failed (non-fatal):", bgErr);
        }

        setBgImage(newBgUrl || null);
        const currentVariant = 0;
        setImageVariant(currentVariant);

        // Use image_headline from AI (cap at 3 words for canvas balance)
        const rawHeadline = post.image_headline || prompt.split(" ").slice(0, 3).join(" ");
        const canvasHeadline = rawHeadline.trim().split(/\s+/).slice(0, 3).join(" ");
        const imageUrl = await renderAndUpload({
          headline: canvasHeadline,
          tagline: "",
          format: postFormat,
          variant: currentVariant,
          logoUrl: vsLogoUrl,
          platform,
          bgImageUrl: newBgUrl,
          supabase,
        });
        setGeneratedImage(imageUrl);
        if (savedId) {
          await supabase.from("vs_marketing_posts" as any).update({ image_url: imageUrl }).eq("id", savedId);
        }
        qc.invalidateQueries({ queryKey: ["vs-marketing-posts-history"] });
        qc.invalidateQueries({ queryKey: ["vs-marketing-posts-gallery"] });
        if (newBgUrl) {
          toast.success("Arte gerada com foto editorial! ✨");
        } else {
          toast.success("Arte gerada! (sem foto de fundo desta vez)");
        }
      } catch (e: any) {
        console.error(e);
        toast.error("Texto gerado, mas houve um erro na arte. Tente regerar.");
      } finally {
        setImageLoading(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar post. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!generatedPost) return;
    setImageLoading(true);
    try {
      const nextVariant = (imageVariant + 1) % 3;
      setImageVariant(nextVariant);
      const imageUrl = await renderAndUpload({
        headline: generatedPost.image_headline || generatedPost.caption.split("\n")[0].slice(0, 30),
        tagline: "",
        format: postFormat,
        variant: nextVariant,
        logoUrl: vsLogoUrl,
        platform,
        bgImageUrl: bgImage || undefined,
        supabase,
      });
      setGeneratedImage(imageUrl);
      toast.success(`Layout ${nextVariant + 1}/3 — regere para alternar`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao regerar arte.");
    } finally {
      setImageLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const copyFull = () => {
    if (!generatedPost) return;
    const full = `${generatedPost.caption}\n\n${generatedPost.hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" ")}`;
    copy(full);
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `vs-post-${platform.toLowerCase()}-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const FORMAT_ASPECT: Record<string, string> = {
    feed: "aspect-[4/5]",
    story: "aspect-[9/16]",
    square: "aspect-square",
  };

  const FORMAT_LABEL: Record<string, string> = {
    feed: "Feed 4:5",
    story: "Stories 9:16",
    square: "1:1",
  };

  return (
    <div className="space-y-4">
      <Card className="border-accent/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Gerador de Posts — Nível Agência
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Descreva o tema. A IA cria copy B2B brutalista + arte no padrão VS. Instagram Feed: formato 4:5 atualizado.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Ex: Post sobre como automatizar o follow-up de leads no WhatsApp para clínicas de estética..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Instagram">📸 Instagram</SelectItem>
                <SelectItem value="LinkedIn">💼 LinkedIn</SelectItem>
                <SelectItem value="Facebook">📘 Facebook</SelectItem>
                <SelectItem value="WhatsApp">💬 WhatsApp</SelectItem>
              </SelectContent>
            </Select>

            <Select value={nicho} onValueChange={setNicho}>
              <SelectTrigger><SelectValue placeholder="Nicho alvo (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem nicho específico</SelectItem>
                {nichoLabels.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={postFormat} onValueChange={(v: "feed" | "story" | "square") => setPostFormat(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feed">Feed 4:5 (1080×1350)</SelectItem>
                <SelectItem value="story">Stories 9:16</SelectItem>
                <SelectItem value="square">Quadrado 1:1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setShowBrandAssets((v) => !v)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Central de Marca
              {((brandAssets as any[])?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[9px] ml-1">
                  {(brandAssets as any[])?.length} ativos
                </Badge>
              )}
            </Button>
            <Button onClick={handleGenerate} disabled={loading || imageLoading} className="ml-auto">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Gerando...</>
                : <><Sparkles className="h-4 w-4 mr-1" />Gerar Post + Imagem</>}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_IDEAS.map((idea) => (
              <button
                key={idea}
                onClick={() => setPrompt(idea)}
                className="text-[10px] px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Lightbulb className="h-2.5 w-2.5 inline mr-1" />{idea}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {showBrandAssets && <BrandAssetsPanel onClose={() => setShowBrandAssets(false)} />}

      {(loading || imageLoading) && !generatedPost && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Criando post com a identidade VS...</p>
          </CardContent>
        </Card>
      )}

      {generatedPost && !loading && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-accent/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-accent" />
                    Imagem do Post
                    <Badge variant="secondary" className="text-[9px] gap-1">
                      <Smartphone className="h-2.5 w-2.5" />
                      {FORMAT_LABEL[postFormat]}
                    </Badge>
                    {generatedImage && (
                      <Badge variant="outline" className="text-[9px]">
                        Layout {imageVariant + 1}/3
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-1.5">
                    {generatedImage && (
                      <Button size="sm" variant="outline" onClick={downloadImage}>
                        <Download className="h-3 w-3 mr-1" />Baixar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleRegenerateImage} disabled={imageLoading}>
                      {imageLoading
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><Sparkles className="h-3 w-3 mr-1" />Regerar</>}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {imageLoading && !generatedImage ? (
                  <div className={`${FORMAT_ASPECT[postFormat]} rounded-lg bg-[#050814] border border-accent/10 flex flex-col items-center justify-center gap-3`}>
                    <Loader2 className="h-8 w-8 animate-spin text-[#FF5300]" />
                    <p className="text-xs text-muted-foreground">Gerando arte com IA...</p>
                    <p className="text-[10px] text-muted-foreground/50">Pode levar 20–40 segundos</p>
                  </div>
                ) : generatedImage ? (
                  <div className="relative group">
                    <img
                      src={generatedImage}
                      alt="Post gerado"
                      className="w-full rounded-lg border border-accent/20 shadow-lg"
                    />
                    <div className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={downloadImage}>
                        <Download className="h-3 w-3 mr-1" />Baixar PNG
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleRegenerateImage} disabled={imageLoading}>
                        <Sparkles className="h-3 w-3 mr-1" />Regerar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={`${FORMAT_ASPECT[postFormat]} rounded-lg bg-[#050814] border border-accent/10 flex flex-col items-center justify-center gap-2`}>
                    <Image className="h-8 w-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground/60">Arte não gerada</p>
                    <Button size="sm" variant="outline" onClick={handleRegenerateImage}>
                      <Sparkles className="h-3 w-3 mr-1" />Gerar Arte
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-accent/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{PLATFORM_EMOJI[platform]}</span>
                    Post para {platform}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={copyFull}>
                    <Copy className="h-3 w-3 mr-1" />Copiar Tudo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <div className="p-4 rounded-lg bg-secondary/50 whitespace-pre-wrap text-sm leading-relaxed max-h-[300px] overflow-y-auto">
                    {generatedPost.caption}
                  </div>
                  <button
                    onClick={() => copy(generatedPost.caption)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background"
                    title="Copiar legenda"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedPost.hashtags.map((h, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] cursor-pointer hover:bg-accent/20"
                        onClick={() => copy(h.startsWith("#") ? h : `#${h}`)}
                      >
                        <Hash className="h-2.5 w-2.5 mr-0.5" />{h.replace(/^#/, "")}
                      </Badge>
                    ))}
                  </div>
                  <button
                    onClick={() => copy(generatedPost.hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" "))}
                    className="text-[10px] text-accent hover:underline mt-1.5"
                  >
                    Copiar todas as hashtags
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4 text-accent" />
                  <p className="text-xs font-semibold">Sugestão Visual</p>
                </div>
                <p className="text-xs text-muted-foreground">{generatedPost.visual_suggestion}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  <p className="text-xs font-semibold">Dicas da Plataforma</p>
                </div>
                <p className="text-xs text-muted-foreground">{generatedPost.platform_tips}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-accent" />
                  <p className="text-xs font-semibold">Melhor Horário</p>
                </div>
                <p className="text-xs text-muted-foreground">{generatedPost.best_time}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {((history as any[])?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Histórico de Posts Gerados
          </h3>
          <div className="space-y-2">
            {(history as any[]).map((h) => (
              <Card
                key={h.id}
                className="hover:border-accent/20 transition-colors cursor-pointer"
                onClick={() => {
                  setGeneratedPost({
                    caption: h.caption,
                    hashtags: h.hashtags || [],
                    platform_tips: "",
                    visual_suggestion: "",
                    best_time: h.best_time || "",
                  });
                  if (h.image_url) {
                    setGeneratedImage(h.image_url);
                    setBgImage(null); // Clear background image when loading history since we just have the composed image
                  }
                  if (h.platform) setPlatform(h.platform);
                }}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {h.image_url ? (
                    <img src={h.image_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-accent/20" />
                  ) : (
                    <span className="text-lg">{PLATFORM_EMOJI[h.platform || "Instagram"]}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{h.prompt}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{h.caption?.slice(0, 80)}...</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">{h.platform}</Badge>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(h.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}