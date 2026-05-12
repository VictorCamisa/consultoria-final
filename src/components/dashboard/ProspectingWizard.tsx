import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNichos } from "@/hooks/useNichos";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Rocket, Loader2, Check, X, ChevronRight, ChevronLeft, MapPin,
  Building2, Target, Globe, Phone, Mail, Star, ThumbsUp, ThumbsDown, SkipForward,
  Sparkles, ArrowRight,
} from "lucide-react";
import { nichoCategory } from "@/components/comercial/types";

type ScrapeResult = {
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  city: string | null;
  website: string | null;
  segment: string | null;
  company_size: string | null;
  icp_score: number;
  icp_reason: string | null;
};

// PRESET_SEGMENTS now loaded dynamically via useNichos hook

const INTENT_PRESETS: Record<string, string> = {
  estetica: "Clínicas de estética com Instagram ativo (posts de antes/depois), sem sistema de agendamento online. Priorizar quem atende só pelo WhatsApp manual e tem mais de 100 seguidores.",
  revendas: "Lojas de veículos seminovos com mais de 10 carros no estoque, presença no OLX ou WebMotors, sem automação de atendimento no WhatsApp. Priorizar donos que dependem de vendedor para responder leads.",
  odonto: "Clínicas odontológicas com Google Business ativo e sem confirmação automática de consultas. Faturamento estimado acima de R$30k/mês.",
  advocacia: "Escritórios de advocacia sem captação digital estruturada, que dependem de indicação e não têm automação de qualificação de leads.",
};

const ICP_CRITERIA: Record<string, { label: string; colorBorder: string; colorText: string; items: string[] }> = {
  estetica: {
    label: "ICP Estética",
    colorBorder: "border-pink-500/30 bg-pink-500/5",
    colorText: "text-pink-600",
    items: [
      "Instagram com posts antes/depois (+2pts)",
      "Sem Booksy / Fresha / agendamento online (+2pts)",
      "Mais de 100 seguidores no Instagram (+1pt)",
      "Avaliações no Google Business (+1pt)",
      "Score mín. 5pts para abordar",
    ],
  },
  revendas: {
    label: "ICP VS AUTO",
    colorBorder: "border-blue-500/30 bg-blue-500/5",
    colorText: "text-blue-600",
    items: [
      "Estoque mín. 10 veículos no OLX/WebMotors (+2pts)",
      "Sem automação de atendimento no WhatsApp (+2pts)",
      "Instagram ativo com fotos dos veículos (+1pt)",
      "Sistema atual identificável (Autocerto, etc.) (+1pt)",
      "Score mín. 5pts para abordar",
    ],
  },
};

const NICHO_SEARCH_STAGES: Record<string, string[]> = {
  estetica: [
    "Analisando perfil ICP de clínicas estéticas...",
    "Buscando clínicas no Google Maps e Instagram...",
    "Verificando sistema de agendamento (Booksy/Fresha)...",
    "Raspando WhatsApp e Instagram das clínicas...",
    "Qualificando com score ICP estética...",
    "Priorizando clínicas sem agendamento online...",
  ],
  revendas: [
    "Analisando perfil ICP de revendas VS AUTO...",
    "Buscando lojas no OLX Autos e WebMotors...",
    "Verificando estoque e portais de cada loja...",
    "Raspando WhatsApp e Instagram das lojas...",
    "Qualificando com score ICP VS AUTO...",
    "Priorizando lojas sem automação de atendimento...",
  ],
};

const getDynamicSearchStages = (niche: string) => [
  `Analisando perfil ICP de ${niche}...`,
  `Buscando ${niche} no Google Maps...`,
  `Verificando presença digital de cada negócio...`,
  `Raspando contatos e sites...`,
  `Qualificando com score ICP para ${niche}...`,
  `Finalizando extração de dados...`,
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

type Step = "config" | "searching" | "review";

export default function ProspectingWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { presetSegments: PRESET_SEGMENTS } = useNichos();

  // Config step
  const [selectedNiche, setSelectedNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [bairro, setBairro] = useState("");
  const [leadCount, setLeadCount] = useState(15);
  const [intent, setIntent] = useState("");

  // Search step
  const [searching, setSearching] = useState(false);
  const [searchStage, setSearchStage] = useState(0);

  // Review step (Tinder-style)
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approved, setApproved] = useState<ScrapeResult[]>([]);
  const [rejected, setRejected] = useState<ScrapeResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>("config");

  const activeNiche = customNiche || selectedNiche;
  const activeNichoCategory = nichoCategory(activeNiche);
  const SEARCH_STAGES = (activeNichoCategory && NICHO_SEARCH_STAGES[activeNichoCategory.key]) || getDynamicSearchStages(activeNiche || "negócios");
  const currentLead = results[currentIndex];
  const reviewDone = currentIndex >= results.length && results.length > 0;

  const handleSelectNiche = (nicheValue: string) => {
    setSelectedNiche(nicheValue);
    setCustomNiche("");
    const cat = nichoCategory(nicheValue);
    if (cat && INTENT_PRESETS[cat.key] && !intent) {
      setIntent(INTENT_PRESETS[cat.key]);
    }
  };

  const reset = () => {
    setSelectedNiche(""); setCustomNiche(""); setState(""); setCity(""); setBairro("");
    setLeadCount(15); setIntent(""); setResults([]); setCurrentIndex(0);
    setApproved([]); setRejected([]); setStep("config"); setSearchStage(0);
  };

  const handleSearch = async () => {
    if (!user || !activeNiche) return;
    setStep("searching");
    setSearching(true);
    setSearchStage(0);

    // Animate stages
    const stageTimers = [3000, 8000, 15000, 25000, 40000];
    stageTimers.forEach((delay, i) => {
      setTimeout(() => setSearchStage(i + 1), delay);
    });

    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: {
          niche: activeNiche,
          city: city || undefined,
          state: state || undefined,
          bairro: bairro || undefined,
          limit: leadCount,
          prospecting_intent: intent || undefined,
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro desconhecido");

      const scraped: ScrapeResult[] = data?.results || [];
      if (scraped.length === 0) {
        toast({ title: "Nenhum lead encontrado", description: "Tente outros termos ou localização.", variant: "destructive" });
        setStep("config");
        return;
      }

      // Sort by ICP score descending
      scraped.sort((a, b) => (b.icp_score ?? 0) - (a.icp_score ?? 0));
      setResults(scraped);
      setCurrentIndex(0);
      setApproved([]);
      setRejected([]);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Erro na prospecção", description: err.message, variant: "destructive" });
      setStep("config");
    } finally {
      setSearching(false);
    }
  };

  const handleApprove = () => {
    if (!currentLead) return;
    setApproved((prev) => [...prev, currentLead]);
    setCurrentIndex((i) => i + 1);
  };

  const handleReject = () => {
    if (!currentLead) return;
    setRejected((prev) => [...prev, currentLead]);
    setCurrentIndex((i) => i + 1);
  };

  const handleSkip = () => {
    setCurrentIndex((i) => i + 1);
  };

  const handleSaveApproved = async () => {
    if (approved.length === 0) return;
    setSaving(true);
    try {
      const isRevenda = activeNichoCategory?.key === "revendas";
      const prospects = approved
        .filter((l) => l.phone)
        .map((l) => ({
          nome_negocio: l.company || l.name || "Lead sem nome",
          nicho: l.segment || activeNiche,
          cidade: l.city || city || "Não informada",
          whatsapp: l.phone!,
          site: l.website || null,
          decisor: l.name || null,
          observacoes: l.icp_reason || null,
          score_qualificacao: l.icp_score || null,
          origem: "prospeccao_web",
          status: "novo",
          responsavel: "danilo",
          is_vs_auto: isRevenda,
          mrr_estimado: isRevenda ? 1497 : undefined,
          icp_auto_data: {
            tem_site: !!(l.website),
            score_pontos: l.icp_score ?? null,
          },
        } as any));

      if (prospects.length === 0) {
        toast({ title: "Nenhum lead com telefone", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("consultoria_prospects").insert(prospects);
      if (error) throw error;

      toast({
        title: `${prospects.length} prospect(s) adicionados ao pipeline! 🎯`,
        description: "Veja na aba Comercial.",
      });

      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const icpColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-warning";
    return "text-muted-foreground";
  };

  const icpBg = (score: number) => {
    if (score >= 80) return "bg-success/10 border-success/30";
    if (score >= 60) return "bg-primary/10 border-primary/30";
    if (score >= 40) return "bg-warning/10 border-warning/30";
    return "bg-muted border-border";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!searching) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        {/* STEP 1: CONFIG */}
        {step === "config" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Rocket className="h-5 w-5 text-primary" />
                Prospecção Inteligente
              </DialogTitle>
              <DialogDescription>
                Descreva o nicho e localização. A IA vai buscar, raspar e qualificar leads automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Niche selection */}
              {/* ICP Banner — nicho-aware */}
              {activeNichoCategory && ICP_CRITERIA[activeNichoCategory.key] ? (
                <div className={`p-3 rounded-lg border space-y-1.5 ${ICP_CRITERIA[activeNichoCategory.key].colorBorder}`}>
                  <div className="flex items-center gap-1.5">
                    <Target className={`h-3.5 w-3.5 shrink-0 ${ICP_CRITERIA[activeNichoCategory.key].colorText}`} />
                    <p className={`text-xs font-semibold ${ICP_CRITERIA[activeNichoCategory.key].colorText}`}>
                      {ICP_CRITERIA[activeNichoCategory.key].label} — critérios de qualificação
                    </p>
                  </div>
                  <ul className="space-y-0.5 pl-5">
                    {ICP_CRITERIA[activeNichoCategory.key].items.map((item, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground list-disc">{item}</li>
                    ))}
                  </ul>
                </div>
              ) : activeNiche ? (
                <div className="p-3 rounded-lg border space-y-1.5 border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="text-xs font-semibold text-primary">
                      ICP Dinâmico — {activeNiche}
                    </p>
                  </div>
                  <ul className="space-y-0.5 pl-5">
                    <li className="text-[10px] text-muted-foreground list-disc">Análise de presença online (Site, Redes) (+15pts)</li>
                    <li className="text-[10px] text-muted-foreground list-disc">Verificação de contato direto via WhatsApp (+10pts)</li>
                    <li className="text-[10px] text-muted-foreground list-disc">Avaliações positivas no Google Business (+10pts)</li>
                    <li className="text-[10px] text-muted-foreground list-disc">Score automático para priorizar melhores leads</li>
                  </ul>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <Target className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-green-600">ICP configurado — VS OS</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Donos de negócios locais, faturamento acima de R$30k/mês</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Nicho / Segmento</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_SEGMENTS.map((seg) => (
                    <button
                      key={seg.value}
                      onClick={() => handleSelectNiche(seg.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        selectedNiche === seg.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-foreground hover:border-primary/50"
                      }`}
                    >
                      {seg.icon} {seg.label}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Ou digite um nicho personalizado..."
                  value={customNiche}
                  onChange={(e) => { setCustomNiche(e.target.value); setSelectedNiche(""); }}
                  className="mt-1"
                />
              </div>

              {/* Location */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input placeholder="Ex: São Paulo" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bairro (opcional)</Label>
                  <Input placeholder="Ex: Moema" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
              </div>

              {/* Lead count */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Quantidade de leads</Label>
                  <Badge variant="secondary" className="font-mono">{leadCount}</Badge>
                </div>
                <Slider
                  value={[leadCount]}
                  onValueChange={([v]) => setLeadCount(v)}
                  min={5}
                  max={50}
                  step={5}
                />
              </div>

              {/* Intent */}
              <div className="space-y-1.5">
                <Label className="text-sm">Intenção de prospecção (opcional)</Label>
                <Textarea
                  placeholder="Ex: Quero encontrar clínicas que investem em tráfego pago e têm equipe de atendimento..."
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSearch} disabled={!activeNiche}>
                <Sparkles className="h-4 w-4 mr-2" />
                Iniciar Prospecção
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 2: SEARCHING */}
        {step === "searching" && (
          <div className="py-12 flex flex-col items-center gap-6">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Buscando leads...</h3>
              <p className="text-sm text-muted-foreground">
                {activeNiche} {city && `em ${city}`} {state && `- ${state}`}
              </p>
            </div>
            <div className="w-full max-w-xs space-y-3">
              {SEARCH_STAGES.map((label, i) => (
                <div key={i} className={`flex items-center gap-2.5 transition-opacity ${i <= searchStage ? "opacity-100" : "opacity-30"}`}>
                  {i < searchStage ? (
                    <Check className="h-4 w-4 text-success shrink-0" />
                  ) : i === searchStage ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                  )}
                  <span className={`text-sm ${i === searchStage ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: TINDER-STYLE REVIEW */}
        {step === "review" && !reviewDone && currentLead && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Revisar Leads
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {currentIndex + 1} / {results.length}
                </span>
              </DialogTitle>
              <Progress value={((currentIndex) / results.length) * 100} className="h-1.5 mt-2" />
            </DialogHeader>

            <Card className="border-2 mt-2">
              <CardContent className="pt-5 space-y-4">
                {/* Header with ICP Score */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate">
                      {currentLead.company || currentLead.name || "Sem nome"}
                    </h3>
                    {currentLead.segment && (
                      <Badge variant="secondary" className="text-xs">{currentLead.segment}</Badge>
                    )}
                  </div>
                  <div className={`flex flex-col items-center rounded-xl border px-4 py-2 ${icpBg(currentLead.icp_score)}`}>
                    <span className={`text-2xl font-bold ${icpColor(currentLead.icp_score)}`}>
                      {currentLead.icp_score}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ICP</span>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {currentLead.name && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{currentLead.name}</span>
                    </div>
                  )}
                  {currentLead.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{currentLead.city}</span>
                    </div>
                  )}
                  {currentLead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate font-mono text-xs">{currentLead.phone}</span>
                    </div>
                  )}
                  {currentLead.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs">{currentLead.email}</span>
                    </div>
                  )}
                  {currentLead.website && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs text-primary">{currentLead.website}</span>
                    </div>
                  )}
                  {currentLead.company_size && (
                    <div className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs">Porte: {currentLead.company_size}</span>
                    </div>
                  )}
                </div>

                {/* ICP Reason */}
                {currentLead.icp_reason && (
                  <div className="rounded-lg bg-muted/50 border p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Análise IA:</span>{" "}
                      {currentLead.icp_reason}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full h-14 w-14 border-2 border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                    onClick={handleReject}
                  >
                    <ThumbsDown className="h-5 w-5 text-destructive" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground text-xs"
                    onClick={handleSkip}
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Pular
                  </Button>
                  <Button
                    size="lg"
                    className="rounded-full h-14 w-14 bg-success hover:bg-success/90 border-2 border-success"
                    onClick={handleApprove}
                  >
                    <ThumbsUp className="h-5 w-5 text-white" />
                  </Button>
                </div>

                {/* Counter */}
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                  <span className="text-success">✓ {approved.length} aprovados</span>
                  <span className="text-destructive">✗ {rejected.length} rejeitados</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* STEP 3b: REVIEW DONE */}
        {step === "review" && reviewDone && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                Revisão Concluída
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-success/10 border border-success/30 p-4">
                  <p className="text-2xl font-bold text-success">{approved.length}</p>
                  <p className="text-xs text-muted-foreground">Aprovados</p>
                </div>
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
                  <p className="text-2xl font-bold text-destructive">{rejected.length}</p>
                  <p className="text-xs text-muted-foreground">Rejeitados</p>
                </div>
                <div className="rounded-lg bg-muted border p-4">
                  <p className="text-2xl font-bold">{results.length - approved.length - rejected.length}</p>
                  <p className="text-xs text-muted-foreground">Pulados</p>
                </div>
              </div>

              {approved.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Leads aprovados para o pipeline:</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg border p-2">
                    {approved.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                        <span className="truncate flex-1">{l.company || l.name || "Sem nome"}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${icpColor(l.icp_score)}`}>{l.icp_score}</span>
                          {l.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                Fechar
              </Button>
              {approved.length > 0 && (
                <Button onClick={handleSaveApproved} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Enviar {approved.length} ao Pipeline
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
