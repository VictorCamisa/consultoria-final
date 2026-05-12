import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNichos } from "@/hooks/useNichos";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare,
  Contact, Smartphone, QrCode, RefreshCw, Trash2, Wifi, WifiOff,
  CheckCircle2, Tag, X, Zap, Eye,
  Sparkles, Upload, FileSpreadsheet, AlertCircle, MapPin, ArrowRight,
  ExternalLink, Compass, Target, Building2, Check, Circle, Database, Send, Filter,
  TrendingUp, BarChart3, Flame, ChevronDown, ChevronRight, History, Clock
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";
import type { Tables } from "@/integrations/supabase/types";
import { buildLeadIdentityKey, normalizePhone } from "@/lib/utils";
import { nichoCategory } from "@/components/comercial/types";

type ProspectIdentity = Pick<Tables<"consultoria_prospects">, "id" | "whatsapp" | "nome_negocio" | "cidade" | "site">;

type ScrapeResult = {
  name: string | null; phone: string | null; email: string | null;
  company: string | null; role: string | null; city: string | null;
  website: string | null; segment: string | null; company_size: string | null;
  icp_score: number; icp_reason: string | null;
};
type ScrapeJob = {
  id: string; niche: string; city: string; prospecting_intent: string;
  status: "running" | "completed" | "failed";
  results: ScrapeResult[]; results_count: number; total_found: number;
  duplicates_skipped: number; pages_searched: number; avg_icp_score: number;
  created_at: string; error_message?: string;
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

const NICHO_SEARCH_STAGES: Record<string, { label: string; delay: number }[]> = {
  estetica: [
    { label: "Analisando perfil ICP de clínicas estéticas...", delay: 0 },
    { label: "Buscando clínicas no Google Maps e Instagram...", delay: 3000 },
    { label: "Verificando sistema de agendamento (Booksy/Fresha)...", delay: 8000 },
    { label: "Raspando WhatsApp e Instagram das clínicas...", delay: 15000 },
    { label: "Qualificando com score ICP estética...", delay: 25000 },
    { label: "Priorizando clínicas sem agendamento online...", delay: 40000 },
  ],
  revendas: [
    { label: "Analisando perfil ICP de revendas VS AUTO...", delay: 0 },
    { label: "Buscando lojas no OLX Autos e WebMotors...", delay: 3000 },
    { label: "Verificando estoque e portais de cada loja...", delay: 8000 },
    { label: "Raspando WhatsApp e Instagram das lojas...", delay: 15000 },
    { label: "Qualificando com score ICP VS AUTO...", delay: 25000 },
    { label: "Priorizando lojas sem automação de atendimento...", delay: 40000 },
  ],
};

const DEFAULT_PROSPECTING_STAGES = [
  { label: "Analisando perfil da consultoria e ICP...", delay: 0 },
  { label: "Montando consultas inteligentes para o nicho...", delay: 3000 },
  { label: "Buscando leads em sites públicos...", delay: 8000 },
  { label: "Raspando páginas de contato...", delay: 15000 },
  { label: "Qualificando cada lead com score ICP...", delay: 25000 },
  { label: "Salvando leads no banco de dados...", delay: 40000 },
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function ProspectingThinkingFeed({ isRunning, nichoKey }: { isRunning: boolean; nichoKey?: string }) {
  const stages = (nichoKey && NICHO_SEARCH_STAGES[nichoKey]) || DEFAULT_PROSPECTING_STAGES;
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isRunning) return;
    startRef.current = Date.now();
    setCurrentStep(0); setElapsedMs(0);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setElapsedMs(elapsed);
      setCurrentStep(Math.max(0, stages.filter(s => elapsed >= s.delay).length - 1));
    }, 500);
    return () => clearInterval(timer);
  }, [isRunning]);

  if (!isRunning) return null;
  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

  return (
    <div className="mt-3 space-y-1.5 pl-1">
      {stages.map((stage, i) => {
        if (i > currentStep) return null;
        return (
          <div key={i} className="flex items-center gap-2 animate-fade-in">
            {i < currentStep ? <Check className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
            <span className={`text-xs ${i < currentStep ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>{stage.label}</span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground mt-2 pl-5">⏱ {formatTime(elapsedMs)}</p>
    </div>
  );
}

export default function Prospeccao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { presetSegments: PRESET_SEGMENTS } = useNichos();

  const {
    instances, instancesLoading, selectedInstance, setSelectedInstance,
    newInstanceName, setNewInstanceName, creatingInstance, createInstance,
    deleteInstance, getQRCode, fetchInstances,
    qrDialogOpen, setQrDialogOpen, qrCode, qrLoading, qrInstanceName, connectionStatus,
  } = useEvolutionInstances();

  const [scrapeJobs, setScrapeJobs] = useState<ScrapeJob[]>([]);
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [viewResults, setViewResults] = useState<ScrapeJob | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedBairro, setSelectedBairro] = useState("");
  const [leadCount, setLeadCount] = useState(20);
  const [prospectingIntent, setProspectingIntent] = useState("");

  // WhatsApp
  const [whatsappMode, setWhatsappMode] = useState<"group" | "conversation" | "contact">("group");
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string; size: number }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupSearchFilter, setGroupSearchFilter] = useState("");
  const [extractTags, setExtractTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Group search
  const [groupSearchNiche, setGroupSearchNiche] = useState("");
  const [groupSearchRegion, setGroupSearchRegion] = useState("");
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [foundGroups, setFoundGroups] = useState<{ name: string; url: string; source: string }[]>([]);

  // Manual
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // File
  const [fileUploading, setFileUploading] = useState(false);
  const [fileParsedLeads, setFileParsedLeads] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [fileError, setFileError] = useState("");

  // Leads salvos
  const [leadsFilter, setLeadsFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [leadsSourceFilter, setLeadsSourceFilter] = useState<string>("all");
  const [leadsSearch, setLeadsSearch] = useState("");
  const [promotingIds, setPromotingIds] = useState<Set<string>>(new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [deletingLeadIds, setDeletingLeadIds] = useState<Set<string>>(new Set());

  // Promote dialog
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteTargetIds, setPromoteTargetIds] = useState<string[]>([]);

  // Manual add dialog
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  // File import dialog
  const [fileDialogOpen, setFileDialogOpen] = useState(false);

  // Secondary sections
  const [showOtherSegments, setShowOtherSegments] = useState(false);

  // Active tab for capture methods
  const [captureTab, setCaptureTab] = useState<"web" | "whatsapp">("web");

  const { data: savedLeads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["leads_raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_raw")
        .select("*")
        .neq("name", "__job_complete__")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Prospects count for conversion rate
  const { data: prospectsCount = 0 } = useQuery({
    queryKey: ["prospects_count_metrics"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("consultoria_prospects")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: prospectIdentities = [] } = useQuery({
    queryKey: ["prospect-identities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_prospects")
        .select("id, whatsapp, nome_negocio, cidade, site");
      if (error) throw error;
      return (data || []) as ProspectIdentity[];
    },
  });

  // Search history derived from leads_raw enrichment_data
  const searchHistory = useMemo(() => {
    const map = new Map<string, { niche: string; location: string; count: number; lastDate: string }>();
    savedLeads.forEach(l => {
      const ed = (l.enrichment_data as any) || {};
      const niche = ed.scraped_niche;
      const location = ed.scraped_location || ed.city;
      if (!niche) return;
      const key = `${niche}||${location || ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if ((l.created_at || "") > existing.lastDate) existing.lastDate = l.created_at || "";
      } else {
        map.set(key, { niche, location: location || "", count: 1, lastDate: l.created_at || "" });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [savedLeads]);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };
  const capitalizeName = (name: string) => name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  const activeNiche = customNiche || selectedNiche;
  const activeLocation = [selectedCity, selectedBairro, selectedState].filter(Boolean).join(", ");
  const activeNichoCategory = nichoCategory(activeNiche);
  const resetWizard = () => { setSelectedNiche(""); setCustomNiche(""); setSelectedState(""); setSelectedCity(""); setSelectedBairro(""); setLeadCount(20); setProspectingIntent(""); };

  const handleSelectNiche = (nicheValue: string) => {
    setSelectedNiche(nicheValue);
    setCustomNiche("");
    const cat = nichoCategory(nicheValue);
    if (cat && INTENT_PRESETS[cat.key] && !prospectingIntent) {
      setProspectingIntent(INTENT_PRESETS[cat.key]);
    }
  };

  // === KPI Metrics ===
  const kpiMetrics = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const leadsThisWeek = savedLeads.filter(l => new Date(l.created_at || "").getTime() > weekAgo).length;
    const totalLeads = savedLeads.length;
    const promotedLeads = savedLeads.filter(l => l.status === "promoted").length;
    const conversionRate = totalLeads > 0 ? Math.round((promotedLeads / totalLeads) * 100) : 0;
    
    const scores = savedLeads.map(l => ((l.enrichment_data as any)?.icp_score ?? 0)).filter(s => s > 0);
    const avgIcp = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const sourceCounts: Record<string, number> = {};
    savedLeads.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1; });
    const bestSource = Object.entries(sourceCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || "—";
    const sourceLabels: Record<string, string> = { web: "Web", whatsapp: "WhatsApp", manual: "Manual", import: "Importação" };

    return { leadsThisWeek, conversionRate, avgIcp, bestSource: sourceLabels[bestSource] || bestSource, totalLeads, promotedLeads };
  }, [savedLeads]);

  // === Smart Queue ===
  const smartQueue = useMemo(() => {
    return savedLeads
      .filter(l => {
        const score = ((l.enrichment_data as any)?.icp_score ?? 0);
        return score >= 60 && l.status !== "promoted";
      })
      .sort((a, b) => {
        const sa = ((a.enrichment_data as any)?.icp_score ?? 0);
        const sb = ((b.enrichment_data as any)?.icp_score ?? 0);
        return sb - sa;
      })
      .slice(0, 20);
  }, [savedLeads]);

  // Promote lead to consultoria_prospects
  const handlePromoteToProspect = async (leadIds: string[]) => {
    const leads = savedLeads.filter(l => leadIds.includes(l.id));
    if (leads.length === 0) return;

    setPromotingIds(prev => { const n = new Set(prev); leadIds.forEach(id => n.add(id)); return n; });
    try {
      const existingProspectKeys = new Set(
        prospectIdentities
          .map((prospect) => buildLeadIdentityKey({
            phone: prospect.whatsapp,
            name: prospect.nome_negocio,
            city: prospect.cidade,
            website: prospect.site,
          }))
          .filter(Boolean) as string[]
      );

      const batchKeys = new Set<string>();
      const prospectsToInsert: any[] = [];
      const leadIdsToMarkPromoted: string[] = [];
      let skippedExisting = 0;

      leads.forEach((l) => {
        const enrichment = (l.enrichment_data as any) || {};
        const normalizedWhatsapp = normalizePhone(l.phone);
        const identityKey = buildLeadIdentityKey({
          phone: normalizedWhatsapp,
          email: l.email,
          name: l.name || enrichment.company || "Lead sem nome",
          city: enrichment.city || enrichment.scraped_location || null,
          website: enrichment.website || null,
        });

        if (!normalizedWhatsapp || !identityKey) return;

        leadIdsToMarkPromoted.push(l.id);

        if (existingProspectKeys.has(identityKey) || batchKeys.has(identityKey)) {
          skippedExisting += 1;
          return;
        }

        batchKeys.add(identityKey);
        const leadNicho = enrichment.segment || enrichment.scraped_niche || "Não definido";
        const leadCat = nichoCategory(leadNicho);
        const isRevenda = leadCat?.key === "revendas";
        prospectsToInsert.push({
          nome_negocio: l.name || enrichment.company || "Lead sem nome",
          nicho: leadNicho,
          cidade: enrichment.city || enrichment.scraped_location || "Não informada",
          whatsapp: normalizedWhatsapp,
          site: enrichment.website || null,
          decisor: l.name || null,
          observacoes: enrichment.icp_reason || null,
          score_qualificacao: enrichment.icp_score || null,
          origem: l.source === "web" ? "prospeccao_web" : l.source === "whatsapp" ? "whatsapp" : "manual",
          status: "novo",
          responsavel: "danilo",
          is_vs_auto: isRevenda,
          mrr_estimado: isRevenda ? 1497 : undefined,
          icp_auto_data: {
            tem_site: !!(enrichment.website),
            instagram_ativo: enrichment.instagram_ativo ?? null,
            sistema_atual: enrichment.sistema_atual ?? null,
            score_pontos: enrichment.icp_score ?? null,
          },
        } as any);
      });

      if (prospectsToInsert.length === 0 && leadIdsToMarkPromoted.length === 0) {
        toast({ title: "Nenhum lead com telefone", description: "Leads sem telefone não podem ser enviados ao pipeline.", variant: "destructive" });
        return;
      }

      if (prospectsToInsert.length > 0) {
        const { error } = await supabase.from("consultoria_prospects").insert(prospectsToInsert);
        if (error) throw error;
      }

      if (leadIdsToMarkPromoted.length > 0) {
        const { error: markError } = await supabase
          .from("leads_raw")
          .update({ status: "promoted" } as any)
          .in("id", leadIdsToMarkPromoted);
        if (markError) throw markError;
      }

      toast({
        title: `${prospectsToInsert.length} lead(s) enviados ao pipeline! 🎯`,
        description: skippedExisting > 0
          ? `${skippedExisting} já existiam no CRM e foram marcados para não duplicar.`
          : "Veja na aba Comercial.",
      });
      setSelectedLeadIds(new Set());
      setPromoteDialogOpen(false);
      setPromoteTargetIds([]);
      queryClient.invalidateQueries({ queryKey: ["leads_raw"] });
      queryClient.invalidateQueries({ queryKey: ["prospects_count_metrics"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setPromotingIds(prev => { const n = new Set(prev); leadIds.forEach(id => n.delete(id)); return n; });
    }
  };

  const openPromoteDialog = (ids: string[]) => {
    setPromoteTargetIds(ids);
    setPromoteDialogOpen(true);
  };

  const handleDeleteLeads = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeletingLeadIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    try {
      const { error } = await supabase.from("leads_raw" as any).delete().in("id", ids);
      if (error) throw error;
      toast({ title: `${ids.length} lead(s) excluído(s)` });
      setSelectedLeadIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["leads_raw"] });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeletingLeadIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
    }
  };

  const filteredLeads = savedLeads.filter(l => {
    const enrichment = (l.enrichment_data as any) || {};
    const score = enrichment.icp_score ?? 50;
    if (leadsFilter === "high" && score < 60) return false;
    if (leadsFilter === "medium" && (score < 40 || score >= 60)) return false;
    if (leadsFilter === "low" && score >= 40) return false;
    if (leadsSourceFilter !== "all" && l.source !== leadsSourceFilter) return false;
    if (leadsSearch.trim()) {
      const q = leadsSearch.toLowerCase();
      const name = (l.name || "").toLowerCase();
      const phone = (l.phone || "").toLowerCase();
      const city = ((enrichment.city || enrichment.scraped_location) || "").toLowerCase();
      if (!name.includes(q) && !phone.includes(q) && !city.includes(q)) return false;
    }
    return true;
  });

  const icpScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400 bg-green-500/10 border-green-500/30";
    if (score >= 60) return "text-primary bg-primary/10 border-primary/30";
    if (score >= 40) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-muted-foreground bg-secondary border-border";
  };

  // Promote dialog data
  const promotePreviewLeads = useMemo(() => {
    return savedLeads.filter(l => promoteTargetIds.includes(l.id));
  }, [savedLeads, promoteTargetIds]);

  const promoteAvgIcp = useMemo(() => {
    const scores = promotePreviewLeads.map(l => ((l.enrichment_data as any)?.icp_score ?? 0)).filter(s => s > 0);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }, [promotePreviewLeads]);

  // === Web Scraping (background job + polling) ===
  const handleScrape = async () => {
    if (!user || !activeNiche) return;
    setScrapingLoading(true);
    setWizardOpen(false);
    const localJobId = crypto.randomUUID();
    const newJob: ScrapeJob = {
      id: localJobId, niche: activeNiche, city: activeLocation, prospecting_intent: prospectingIntent,
      status: "running", results: [], results_count: 0, total_found: 0,
      duplicates_skipped: 0, pages_searched: 0, avg_icp_score: 0, created_at: new Date().toISOString(),
    };
    setScrapeJobs(prev => [newJob, ...prev]);
    try {
      // 1. Start background job
      const { data: startData, error: startError } = await supabase.functions.invoke("scrape-leads", {
        body: { niche: activeNiche, city: selectedCity || undefined, state: selectedState || undefined, bairro: selectedBairro || undefined, limit: leadCount, prospecting_intent: prospectingIntent || undefined },
      });
      if (startError || startData?.error) {
        const errMsg = startData?.error || startError?.message || "Erro desconhecido";
        throw new Error(errMsg);
      }

      const remoteJobId = startData?.job_id || localJobId;
      const jobTag = `job:${remoteJobId}`;

      // 2. Poll DB directly (robust against edge-function timeouts).
      // Stop conditions: sentinel row arrives, or no new leads for 45s, or hard cap 8min.
      const startedAt = Date.now();
      const HARD_CAP_MS = 8 * 60 * 1000;
      const IDLE_LIMIT_MS = 45 * 1000;
      let lastCount = 0;
      let lastChangeAt = Date.now();

      while (true) {
        await new Promise(r => setTimeout(r, 3000));

        // Sentinel?
        const { data: sentinel } = await supabase
          .from("leads_raw")
          .select("status,enrichment_data")
          .eq("name", "__job_complete__")
          .contains("tags", [jobTag])
          .limit(1)
          .maybeSingle();

        // Live leads count
        const { data: liveLeads } = await supabase
          .from("leads_raw")
          .select("id,name,phone,email,enrichment_data")
          .neq("name", "__job_complete__")
          .contains("tags", [jobTag]);

        const currentCount = liveLeads?.length || 0;
        if (currentCount !== lastCount) {
          lastCount = currentCount;
          lastChangeAt = Date.now();
          setScrapeJobs(prev => prev.map(j => j.id === localJobId ? {
            ...j, results_count: currentCount, total_found: currentCount,
          } : j));
        }

        if (sentinel) {
          const ed = (sentinel.enrichment_data as any) || {};
          if (sentinel.status === "job_failed" || ed.status === "failed") {
            throw new Error(ed.error || "Erro no processamento");
          }
          setScrapeJobs(prev => prev.map(j => j.id === localJobId ? {
            ...j, status: "completed" as const,
            results_count: ed.count ?? currentCount,
            total_found: ed.total_found ?? currentCount,
            duplicates_skipped: ed.duplicates_skipped ?? 0,
            pages_searched: ed.pages_searched ?? 0,
            results: ed.results ?? [],
            avg_icp_score: ed.avg_icp_score ?? 0,
          } : j));
          toast({ title: "Prospecção concluída! 🎯", description: `${ed.count ?? currentCount} novos leads salvos` });
          refetchLeads();
          resetWizard();
          return;
        }

        // Idle-stop: worker died silently but already wrote leads
        if (currentCount > 0 && Date.now() - lastChangeAt > IDLE_LIMIT_MS) {
          setScrapeJobs(prev => prev.map(j => j.id === localJobId ? {
            ...j, status: "completed" as const, results_count: currentCount, total_found: currentCount,
          } : j));
          toast({ title: "Prospecção finalizada", description: `${currentCount} leads encontrados (sem sinal de fim, mas dados salvos)` });
          refetchLeads();
          resetWizard();
          return;
        }

        if (Date.now() - startedAt > HARD_CAP_MS) {
          throw new Error("Tempo limite (8min) excedido. Verifique os leads salvos manualmente.");
        }
      }
    } catch (error: any) {
      setScrapeJobs(prev => prev.map(j => j.id === localJobId ? { ...j, status: "failed" as const, error_message: error.message } : j));
      toast({ title: "Erro na prospecção", description: error.message, variant: "destructive" });
    } finally { setScrapingLoading(false); }
  };

  // === WhatsApp ===
  const handleFetchGroups = async () => {
    if (!selectedInstance) return;
    setGroupsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", {
        body: { mode: "list_groups", instance_name: selectedInstance },
      });
      if (error) throw error;
      setAvailableGroups(data?.groups || []);
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro ao buscar grupos", description: error.message, variant: "destructive" });
    } finally { setGroupsLoading(false); }
  };

  const handleWhatsappExtract = async () => {
    if (!user) return;
    setEvolutionLoading(true);
    try {
      const body: any = { mode: whatsappMode, instance_name: selectedInstance || undefined };
      if (whatsappMode === "group") { body.group_ids = Array.from(selectedGroupIds); if (extractTags.length > 0) body.tags = extractTags; }
      const { data, error } = await supabase.functions.invoke("extract-whatsapp", { body });
      if (error) throw error;
      toast({ title: "Extração concluída!", description: `${data?.count || 0} contatos extraídos` });
      setSelectedGroupIds(new Set());
    } catch (error: any) {
      toast({ title: "Erro na extração", description: error.message, variant: "destructive" });
    } finally { setEvolutionLoading(false); }
  };

  const handleSearchGroups = async () => {
    if (!groupSearchNiche.trim()) return;
    setGroupSearchLoading(true); setFoundGroups([]);
    try {
      const { data, error } = await supabase.functions.invoke("search-whatsapp-groups", {
        body: { niche: groupSearchNiche.trim(), region: groupSearchRegion.trim() || undefined, limit: 20 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na busca");
      setFoundGroups(data.groups || []);
      toast({ title: `${data.total || 0} grupos encontrados! 🔍` });
    } catch (error: any) {
      toast({ title: "Erro na busca", description: error.message, variant: "destructive" });
    } finally { setGroupSearchLoading(false); }
  };

  // === Manual ===
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setManualLoading(true);
    try {
      const { error } = await supabase.from("leads_raw" as any).insert({ name: capitalizeName(manualName), phone: formatPhone(manualPhone), email: manualEmail || null, source: "manual", status: "pending" });
      if (error) throw error;
      toast({ title: "Lead adicionado!", description: `${manualName} salvo.` });
      setManualName(""); setManualPhone(""); setManualEmail("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setManualLoading(false); }
  };

  // === File ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(""); setFileParsedLeads([]);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(ext || "")) { setFileError("Use .csv ou .txt"); return; }
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setFileError("Arquivo vazio."); return; }
      const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ""));
      const nameIdx = header.findIndex(h => ["nome", "name", "nome completo"].includes(h));
      const phoneIdx = header.findIndex(h => ["telefone", "phone", "celular", "whatsapp", "tel", "fone"].includes(h));
      const emailIdx = header.findIndex(h => ["email", "e-mail"].includes(h));
      if (phoneIdx === -1 && nameIdx === -1) { setFileError("Colunas 'nome' ou 'telefone' não encontradas."); return; }
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
        return { name: nameIdx >= 0 ? cols[nameIdx] || "" : "", phone: phoneIdx >= 0 ? cols[phoneIdx] || "" : "", email: emailIdx >= 0 ? cols[emailIdx] || "" : "" };
      }).filter(l => l.name || l.phone);
      setFileParsedLeads(parsed);
    } catch { setFileError("Erro ao ler arquivo."); }
    e.target.value = "";
  };

  const handleFileImport = async () => {
    if (!user || fileParsedLeads.length === 0) return;
    setFileUploading(true);
    try {
      const batch = fileParsedLeads.map(l => ({ name: l.name ? capitalizeName(l.name) : null, phone: l.phone ? formatPhone(l.phone) : null, email: l.email || null, source: "import", status: "pending" }));
      for (let i = 0; i < batch.length; i += 500) {
        const { error } = await supabase.from("leads_raw" as any).insert(batch.slice(i, i + 500));
        if (error) throw error;
      }
      toast({ title: "Importação concluída!", description: `${batch.length} leads importados.` });
      setFileParsedLeads([]);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setFileUploading(false); }
  };

  const instanceState = (state: string) => {
    if (state === "open") return <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]" variant="outline"><Wifi className="h-3 w-3 mr-1" />Online</Badge>;
    if (state === "close" || state === "closed") return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]" variant="outline"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">Aguardando</Badge>;
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    running: { color: "bg-yellow-500/15 text-yellow-400", label: "Raspando..." },
    completed: { color: "bg-green-500/15 text-green-400", label: "Concluído" },
    failed: { color: "bg-destructive/15 text-destructive", label: "Falhou" },
  };

  return (
    <div className="space-y-5 max-w-[1600px]">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prospecção</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Captação e qualificação de leads com IA</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-dashed"
            onClick={() => { setManualName(""); setManualPhone(""); setManualEmail(""); setManualDialogOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" /> Manual
          </Button>
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-dashed"
            onClick={() => { setFileParsedLeads([]); setFileError(""); setFileDialogOpen(true); }}
          >
            <Upload className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" className="gap-1.5 text-sm h-9 px-4 font-semibold shadow-md shadow-primary/20" onClick={() => { resetWizard(); setWizardOpen(true); }}>
            <Sparkles className="h-4 w-4" /> Nova Pesquisa
          </Button>
        </div>
      </div>

      {/* KPI BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Leads na semana",
            value: kpiMetrics.leadsThisWeek,
            sub: `${kpiMetrics.totalLeads} total`,
            icon: TrendingUp,
            color: "text-primary",
            bg: "bg-primary/10",
            accent: "border-l-primary",
          },
          {
            label: "Taxa de promoção",
            value: `${kpiMetrics.conversionRate}%`,
            sub: `${kpiMetrics.promotedLeads} → pipeline`,
            icon: BarChart3,
            color: "text-green-400",
            bg: "bg-green-500/10",
            accent: "border-l-green-500",
          },
          {
            label: "ICP médio",
            value: kpiMetrics.avgIcp,
            sub: "Score de aderência",
            icon: Target,
            color: "text-yellow-400",
            bg: "bg-yellow-500/10",
            accent: "border-l-yellow-500",
          },
          {
            label: "Melhor fonte",
            value: kpiMetrics.bestSource,
            sub: "Mais leads captados",
            icon: Zap,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            accent: "border-l-purple-500",
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-l-4 ${kpi.accent} p-4 bg-card flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              <div className={`h-7 w-7 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
            </div>
            <div>
              <p className={`text-3xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* SMART QUEUE */}
      {smartQueue.length > 0 && (
        <div className="rounded-xl border border-primary/25 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/15">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Flame className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Fila Inteligente</h3>
                <p className="text-[11px] text-muted-foreground">{smartQueue.length} leads com ICP ≥ 60 prontos para abordar</p>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs shrink-0 bg-primary hover:bg-primary/90 shadow-md shadow-primary/30"
              onClick={() => openPromoteDialog(smartQueue.slice(0, 6).map(l => l.id))}
            >
              <Send className="h-3.5 w-3.5" /> Enviar Top {Math.min(6, smartQueue.length)} ao Pipeline
            </Button>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {smartQueue.slice(0, 6).map(lead => {
              const enrichment = (lead.enrichment_data as any) || {};
              const score = enrichment.icp_score ?? 0;
              return (
                <div key={lead.id} className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer" onClick={() => openPromoteDialog([lead.id])}>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border-2 ${icpScoreColor(score)}`}>
                    {score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight">{lead.name || "Sem nome"}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[enrichment.segment, enrichment.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
          {smartQueue.length > 6 && (
            <div className="px-4 pb-3">
              <p className="text-[11px] text-muted-foreground text-center border border-dashed rounded-lg py-2">
                + {smartQueue.length - 6} leads com ICP ≥ 60 aguardando ação
              </p>
            </div>
          )}
        </div>
      )}

      {/* MAIN CONTENT — 2 zones */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
        {/* LEFT — Leads list */}
        <div className="space-y-3">
          {/* Section header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-1.5 rounded-full bg-primary shrink-0" />
              <div>
                <h3 className="text-base font-bold leading-tight">Todos os Leads</h3>
                <p className="text-[11px] text-muted-foreground">{filteredLeads.length} de {savedLeads.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedLeadIds.size > 0 && (
                <>
                  <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => openPromoteDialog(Array.from(selectedLeadIds))} disabled={promotingIds.size > 0}>
                    <Send className="h-3.5 w-3.5" />
                    Enviar {selectedLeadIds.size}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleDeleteLeads(Array.from(selectedLeadIds))} disabled={deletingLeadIds.size > 0}>
                    {deletingLeadIds.size > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Excluir {selectedLeadIds.size}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetchLeads()} disabled={leadsLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${leadsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Search + Filters row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou cidade..."
                value={leadsSearch}
                onChange={e => setLeadsSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-secondary/50 border-transparent focus:border-border focus:bg-background"
              />
              {leadsSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setLeadsSearch("")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(["all", "high", "medium", "low"] as const).map((k) => {
                const labels = { all: "Todos", high: "Alto", medium: "Médio", low: "Baixo" };
                return (
                  <button key={k} onClick={() => setLeadsFilter(k)}
                    className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${leadsFilter === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                    {labels[k]}
                  </button>
                );
              })}
              <Select value={leadsSourceFilter} onValueChange={setLeadsSourceFilter}>
                <SelectTrigger className="h-9 w-[120px] text-xs border-border bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas fontes</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="import">Importação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Select all */}
          {filteredLeads.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="select-all"
                checked={selectedLeadIds.size === filteredLeads.filter(l => l.status !== "promoted").length && filteredLeads.filter(l => l.status !== "promoted").length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedLeadIds(new Set(filteredLeads.filter(l => l.status !== "promoted").map(l => l.id)));
                  } else {
                    setSelectedLeadIds(new Set());
                  }
                }}
              />
              <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                Selecionar todos ({filteredLeads.filter(l => l.status !== "promoted").length})
              </label>
            </div>
          )}

          {leadsLoading ? (
            <div className="flex items-center justify-center py-16 rounded-xl border border-dashed">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
              <span className="text-sm text-muted-foreground">Carregando leads...</span>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Database className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold mb-1">Nenhum lead encontrado</p>
              <p className="text-xs text-muted-foreground mb-5">Faça uma prospecção por nicho ou importe de uma planilha</p>
              <Button size="sm" onClick={() => { resetWizard(); setWizardOpen(true); }} className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Iniciar Pesquisa
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[min(62vh,640px)] min-h-[320px] rounded-xl border">
              <div className="divide-y divide-border/60">
                {filteredLeads.map(lead => {
                  const enrichment = (lead.enrichment_data as any) || {};
                  const icpScore = enrichment.icp_score ?? null;
                  const isPromoted = lead.status === "promoted";
                  const isHighIcp = (icpScore ?? 0) >= 60;
                  const sourceLabels: Record<string, string> = { web: "Web", whatsapp: "WA", manual: "Manual", import: "CSV" };
                  return (
                    <div key={lead.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isPromoted ? "opacity-40 bg-muted/20" : isHighIcp ? "hover:bg-primary/[0.03]" : "hover:bg-secondary/20"
                    }`}>
                      {!isPromoted ? (
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={(checked) => {
                            setSelectedLeadIds(prev => { const n = new Set(prev); checked ? n.add(lead.id) : n.delete(lead.id); return n; });
                          }}
                          className="shrink-0"
                        />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      )}

                      {/* Score badge */}
                      {icpScore !== null && (
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${icpScoreColor(icpScore)}`}>
                          {icpScore}
                        </div>
                      )}

                      {/* Lead info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{lead.name || "Sem nome"}</p>
                          {isPromoted && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">Pipeline ✓</Badge>}
                          {enrichment.segment && (
                            <span className="text-[10px] text-muted-foreground border rounded-full px-2 py-0.5 shrink-0 hidden sm:inline">{enrichment.segment}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          {lead.phone && <span className="tabular font-mono">{lead.phone}</span>}
                          {enrichment.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{enrichment.city}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border hidden sm:inline ${
                          lead.source === "web" ? "text-blue-400 border-blue-500/30 bg-blue-500/10" :
                          lead.source === "whatsapp" ? "text-green-400 border-green-500/30 bg-green-500/10" :
                          "text-muted-foreground border-border bg-secondary"
                        }`}>{sourceLabels[lead.source] || lead.source}</span>
                        {!isPromoted && (
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                            disabled={promotingIds.has(lead.id)}
                            onClick={() => openPromoteDialog([lead.id])}>
                            {promotingIds.has(lead.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Pipeline
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* RIGHT — Captação panel */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-1.5 rounded-full bg-green-500 shrink-0" />
            <h3 className="text-base font-bold">Captação</h3>
          </div>

          {/* Capture tabs */}
          <div className="flex gap-1 p-1 bg-secondary/70 rounded-xl">
            <button
              onClick={() => setCaptureTab("web")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                captureTab === "web" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5" /> Por Nicho
            </button>
            <button
              onClick={() => setCaptureTab("whatsapp")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                captureTab === "whatsapp" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
          </div>

          {captureTab === "web" && (
            <div className="space-y-3">
              {scrapeJobs.length === 0 && (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">Nenhuma pesquisa recente</p>
                  <p className="text-xs text-muted-foreground mb-4">Busque leads por nicho e cidade usando IA</p>
                  <Button size="sm" className="gap-1.5 text-xs w-full" onClick={() => { resetWizard(); setWizardOpen(true); }}>
                    <Sparkles className="h-3.5 w-3.5" /> Iniciar Nova Pesquisa
                  </Button>
                </div>
              )}
              {scrapeJobs.length > 0 && (
                <div className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pesquisas Recentes</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={() => { resetWizard(); setWizardOpen(true); }}>
                      <Plus className="h-3 w-3" /> Nova
                    </Button>
                  </div>
                  <div className="divide-y">
                    {scrapeJobs.slice(0, 5).map(job => {
                      const cfg = statusConfig[job.status];
                      return (
                        <div key={job.id} className="flex items-start gap-3 p-3 hover:bg-secondary/20 transition-colors">
                          <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${job.status === "completed" ? "bg-green-500" : job.status === "running" ? "bg-yellow-500 animate-pulse" : "bg-destructive"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{job.niche}</p>
                            {job.city && <p className="text-[10px] text-muted-foreground">{job.city}</p>}
                            {job.status === "running" && <ProspectingThinkingFeed isRunning={true} nichoKey={nichoCategory(job.niche)?.key} />}
                            {job.status === "completed" && (
                              <p className="text-[10px] text-green-400 mt-0.5">{job.results_count} leads salvos</p>
                            )}
                          </div>
                          {job.status === "completed" && job.results.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setViewResults(job)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {captureTab === "whatsapp" && (
            <div className="space-y-3">
              {/* Group Search */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold flex items-center gap-1.5"><Compass className="h-3.5 w-3.5 text-primary" />Buscar Grupos</p>
                <Input placeholder="Nicho..." value={groupSearchNiche} onChange={e => setGroupSearchNiche(e.target.value)} className="text-xs h-8" onKeyDown={e => e.key === "Enter" && handleSearchGroups()} />
                <Input placeholder="Região (opcional)" value={groupSearchRegion} onChange={e => setGroupSearchRegion(e.target.value)} className="text-xs h-8" onKeyDown={e => e.key === "Enter" && handleSearchGroups()} />
                <Button onClick={handleSearchGroups} size="sm" disabled={groupSearchLoading || !groupSearchNiche.trim()} className="gap-1.5 text-xs w-full">
                  {groupSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Buscar
                </Button>
                {foundGroups.length > 0 && (
                  <ScrollArea className="h-[150px] border rounded-md">
                    <div className="p-1.5 space-y-1">
                      {foundGroups.map((g, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-md border hover:bg-secondary/50">
                          <p className="text-[10px] font-medium truncate flex-1">{g.name}</p>
                          <a href={g.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6 px-2"><ExternalLink className="h-2.5 w-2.5" /></Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Connect WhatsApp */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-green-500" />Instâncias WA</p>
                  {instances.length > 0 && (
                    <Button variant="ghost" size="icon" onClick={fetchInstances} disabled={instancesLoading} className="h-6 w-6">
                      <RefreshCw className={`h-3 w-3 ${instancesLoading ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
                {instances.map(inst => (
                  <div key={inst.name} className={`flex items-center justify-between p-2 rounded-lg border transition-colors text-xs ${selectedInstance === inst.name ? "bg-primary/5 border-primary/30" : "hover:bg-secondary/50"}`}>
                    <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={() => setSelectedInstance(inst.name)}>
                      {selectedInstance === inst.name && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                      <span className="truncate">{inst.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {instanceState(inst.state)}
                      {inst.state !== "open" && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => getQRCode(inst.name)}><QrCode className="h-3 w-3" /></Button>}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteInstance(inst.name)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <Input placeholder="Nome da instância" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} className="text-xs h-8" onKeyDown={(e) => e.key === "Enter" && createInstance()} />
                  <Button onClick={createInstance} disabled={creatingInstance || !newInstanceName.trim()} size="sm" className="shrink-0 text-xs h-8 px-3">
                    {creatingInstance ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Extract */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-semibold">Extração de Contatos</p>
                <div className="flex gap-1 flex-wrap">
                  {([{ key: "group" as const, label: "Grupos", icon: Users2 }, { key: "conversation" as const, label: "Conversas", icon: MessageSquare }, { key: "contact" as const, label: "Contatos", icon: Contact }]).map(opt => (
                    <button key={opt.key} onClick={() => { setWhatsappMode(opt.key); if (opt.key === "group" && availableGroups.length === 0 && selectedInstance) handleFetchGroups(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${whatsappMode === opt.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <opt.icon className="h-3 w-3" />{opt.label}
                    </button>
                  ))}
                </div>
                {whatsappMode === "group" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input placeholder="Filtrar grupos..." value={groupSearchFilter} onChange={(e) => setGroupSearchFilter(e.target.value)} className="text-[10px] pl-7 h-7" />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">{availableGroups.filter(g => !groupSearchFilter || g.name.toLowerCase().includes(groupSearchFilter.toLowerCase())).length} grupos</p>
                      <Button variant="outline" size="sm" onClick={handleFetchGroups} disabled={groupsLoading || !selectedInstance} className="text-[10px] h-6 gap-1 px-2">
                        <RefreshCw className={`h-2.5 w-2.5 ${groupsLoading ? "animate-spin" : ""}`} />{availableGroups.length === 0 ? "Carregar" : "↻"}
                      </Button>
                    </div>
                    {groupsLoading ? (
                      <div className="flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /><span className="text-[10px]">Buscando...</span></div>
                    ) : availableGroups.length > 0 ? (
                      <ScrollArea className="h-[150px] border rounded-lg">
                        <div className="p-1 space-y-0.5">
                          {availableGroups.filter(g => !groupSearchFilter || g.name.toLowerCase().includes(groupSearchFilter.toLowerCase())).map(group => (
                            <div key={group.id} onClick={() => setSelectedGroupIds(prev => { const next = new Set(prev); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next; })}
                              className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors ${selectedGroupIds.has(group.id) ? "bg-primary/10" : "hover:bg-secondary"}`}>
                              <Checkbox checked={selectedGroupIds.has(group.id)} className="pointer-events-none h-3.5 w-3.5" />
                              <div className="flex-1 min-w-0"><p className="text-[10px] font-medium truncate">{group.name}</p></div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : !selectedInstance ? <p className="text-[10px] text-yellow-600 py-2 text-center">Selecione uma instância primeiro</p> : null}
                    {selectedGroupIds.size > 0 && (
                      <div className="border rounded-lg p-2 space-y-1.5 bg-secondary/30">
                        <Label className="text-[10px] font-medium flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</Label>
                        <div className="flex gap-1">
                          <Input placeholder="Ex: Fitness..." value={newTag} onChange={(e) => setNewTag(e.target.value)} className="text-[10px] h-6"
                            onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { e.preventDefault(); if (!extractTags.includes(newTag.trim())) setExtractTags(prev => [...prev, newTag.trim()]); setNewTag(""); } }} />
                          <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" disabled={!newTag.trim()} onClick={() => { if (newTag.trim() && !extractTags.includes(newTag.trim())) setExtractTags(prev => [...prev, newTag.trim()]); setNewTag(""); }}><Plus className="h-2.5 w-2.5" /></Button>
                        </div>
                        {extractTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {extractTags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-[10px] gap-0.5 pr-0.5">{tag}<button onClick={() => setExtractTags(prev => prev.filter(t => t !== tag))} className="hover:text-destructive"><X className="h-2 w-2" /></button></Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Button onClick={handleWhatsappExtract} size="sm" className="gap-1.5 text-xs w-full" disabled={evolutionLoading || !selectedInstance || (whatsappMode === "group" && selectedGroupIds.size === 0)}>
                  {evolutionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  Extrair Contatos
                </Button>
              </div>
            </div>
          )}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold">Histórico de Pesquisas</p>
              </div>
              <ScrollArea className="max-h-[260px]">
                <div className="divide-y">
                  {searchHistory.map((item, i) => {
                    const nicheLabel = PRESET_SEGMENTS.find(s => s.value === item.niche)?.label || item.niche;
                    const nicheIcon = PRESET_SEGMENTS.find(s => s.value === item.niche)?.icon;
                    const dateStr = item.lastDate ? new Date(item.lastDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                        <span className="text-base shrink-0">{nicheIcon || "🔍"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{nicheLabel}</p>
                          {item.location && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />{item.location}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-foreground">{item.count}</span>
                          {dateStr && <p className="text-[10px] text-muted-foreground mt-0.5">{dateStr}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* WIZARD DIALOG */}
      <Dialog open={wizardOpen} onOpenChange={v => { if (!scrapingLoading) setWizardOpen(v); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Nova Pesquisa de Demanda</DialogTitle>
            <DialogDescription className="text-xs">A IA busca e qualifica leads automaticamente</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* 1. Segment — Primary nichos highlighted (first, drives intent auto-fill) */}
            <div>
              <Label className="text-sm font-medium">Segmento *</Label>
              <div className="mt-2 space-y-3">
                {/* Primary nichos — Recommended */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Recomendados VS
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_SEGMENTS.filter(n => n.primary).map(n => (
                      <button key={n.value} onClick={() => handleSelectNiche(n.value)}
                        className={`text-left p-3 rounded-lg border-2 transition-all text-xs ${
                          selectedNiche === n.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-primary/20 bg-primary/[0.02] hover:border-primary/40 hover:bg-primary/5"
                        }`}>
                        <span className="text-base">{n.icon}</span>
                        <p className="font-medium mt-1.5">{n.label}</p>
                        <p className="text-[10px] text-primary/60 mt-0.5">Recomendado</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Other segments — collapsed */}
                <Collapsible open={showOtherSegments} onOpenChange={setShowOtherSegments}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                    {showOtherSegments ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Outros segmentos ({PRESET_SEGMENTS.filter(n => !n.primary).length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_SEGMENTS.filter(n => !n.primary).map(n => (
                        <button key={n.value} onClick={() => handleSelectNiche(n.value)}
                          className={`text-left p-3 rounded-lg border transition-all text-xs ${
                            selectedNiche === n.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border hover:border-primary/30 hover:bg-secondary/50"
                          }`}>
                          <span className="text-base">{n.icon}</span>
                          <p className="font-medium mt-1.5">{n.label}</p>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Input value={customNiche} onChange={e => { setCustomNiche(e.target.value); setSelectedNiche(""); }}
                  placeholder="Ou segmento personalizado..." className="text-sm" />
              </div>
            </div>

            {/* ICP Banner — shown after segment selected */}
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
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <Target className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-600">ICP configurado — VS OS</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Qualificação baseada no perfil da consultoria (donos de negócios locais, faturamento acima de R$30k/mês)
                  </p>
                </div>
              </div>
            ) : null}

            {/* Prospecting Intent — after segment so auto-fill makes sense */}
            {activeNiche && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  Intenção
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">(opcional)</span>
                </Label>
                <Textarea
                  value={prospectingIntent}
                  onChange={e => setProspectingIntent(e.target.value)}
                  placeholder="Ex: 'Donos de restaurante sem delivery' ou 'Clínicas que investem em tráfego pago'"
                  className="text-sm min-h-[70px] resize-none"
                  maxLength={300}
                />
                <p className="text-[10px] text-muted-foreground">{prospectingIntent.length}/300</p>
              </div>
            )}

            {/* Location */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Localização *</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estado *</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Cidade *</Label><Input value={selectedCity} onChange={e => setSelectedCity(e.target.value)} placeholder="Ex: Taubaté" className="text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Bairro</Label><Input value={selectedBairro} onChange={e => setSelectedBairro(e.target.value)} placeholder="Ex: Centro" className="text-sm" /></div>
              </div>
            </div>

            {/* Count */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Nº de empresas</Label>
                <Badge variant="outline" className="text-sm font-semibold">{leadCount}</Badge>
              </div>
              <Slider value={[leadCount]} onValueChange={v => setLeadCount(v[0])} min={5} max={50} step={5} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5</span><span>25</span><span>50</span>
              </div>
            </div>

            {/* Summary */}
            {activeNiche && selectedCity && selectedState && (
              <div className="border rounded-lg p-3 bg-secondary/30 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Resumo da busca</p>
                <p className="text-sm"><span className="font-medium">{activeNiche}</span> em <span className="font-medium">{activeLocation}</span> — até <span className="font-medium">{leadCount}</span> empresas</p>
                {prospectingIntent && <p className="text-xs text-primary/80 italic">"{prospectingIntent.slice(0, 100)}{prospectingIntent.length > 100 ? "..." : ""}"</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleScrape} size="sm" disabled={scrapingLoading || !activeNiche || !selectedCity || !selectedState} className="gap-1.5 text-xs w-full">
              {scrapingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Iniciar Pesquisa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PROMOTE DIALOG */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" /> Enviar ao Pipeline
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirme o envio de {promotePreviewLeads.length} lead(s) para o pipeline comercial
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="border rounded-md p-3 text-center">
                <p className="text-lg font-bold">{promotePreviewLeads.length}</p>
                <p className="text-[10px] text-muted-foreground">Leads</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-lg font-bold">{promoteAvgIcp}</p>
                <p className="text-[10px] text-muted-foreground">ICP médio</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-lg font-bold">{promotePreviewLeads.filter(l => l.phone).length}</p>
                <p className="text-[10px] text-muted-foreground">Com telefone</p>
              </div>
            </div>

            {/* Preview list */}
            <ScrollArea className="h-[200px] border rounded-md">
              <div className="divide-y">
                {promotePreviewLeads.map(lead => {
                  const enrichment = (lead.enrichment_data as any) || {};
                  const score = enrichment.icp_score ?? 0;
                  return (
                    <div key={lead.id} className="flex items-center gap-2 px-3 py-2">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${icpScoreColor(score)}`}>
                        {score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{lead.name || "Sem nome"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{enrichment.segment || "—"} · {lead.phone || "Sem tel"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {promotePreviewLeads.filter(l => !l.phone).length > 0 && (
              <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-500/10 rounded-md p-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {promotePreviewLeads.filter(l => !l.phone).length} lead(s) sem telefone serão ignorados
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPromoteDialogOpen(false)} className="text-xs">Cancelar</Button>
            <Button size="sm" onClick={() => handlePromoteToProspect(promoteTargetIds)} disabled={promotingIds.size > 0} className="gap-1.5 text-xs">
              {promotingIds.size > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESULTS DIALOG */}
      <Dialog open={!!viewResults} onOpenChange={() => setViewResults(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">Resultados — {viewResults?.niche}</DialogTitle>
            <DialogDescription className="text-xs">
              {viewResults?.total_found || 0} encontrados · {viewResults?.results_count || 0} salvos
              {(viewResults?.duplicates_skipped || 0) > 0 && ` · ${viewResults?.duplicates_skipped} duplicados`}
            </DialogDescription>
          </DialogHeader>
          {viewResults?.results?.length ? (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-1.5 p-1">
                {viewResults.results.map((r, i) => (
                  <div key={i} className="border rounded-md p-3 hover:bg-secondary/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name || r.company || "Sem nome"}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {r.phone && <span>{r.phone}</span>}
                          {r.email && <span>{r.email}</span>}
                          {r.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${icpScoreColor(r.icp_score)}`}>ICP {r.icp_score}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado</p>}
        </DialogContent>
      </Dialog>

      {/* QR CODE DIALOG */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-xs">Escaneie o QR Code com o WhatsApp em {qrInstanceName}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {connectionStatus === "connected" ? (
              <div className="text-center space-y-2"><CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" /><p className="text-sm font-medium text-green-600">Conectado!</p></div>
            ) : qrLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : qrCode ? (
              <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64 rounded-lg border" />
            ) : (
              <p className="text-sm text-muted-foreground">QR Code não disponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MANUAL ADD DIALOG */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" /> Adicionar Lead Manual
            </DialogTitle>
            <DialogDescription className="text-xs">Insira os dados do lead para salvá-lo na fila.</DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => { e.preventDefault(); await handleManualAdd(e); setManualDialogOpen(false); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome *</Label>
              <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Ex: João Silva" className="text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Telefone / WhatsApp *</Label>
              <Input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Ex: (11) 99999-9999" className="text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">E-mail</Label>
              <Input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="Ex: joao@empresa.com" className="text-sm" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" type="button" className="text-xs" onClick={() => setManualDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" type="submit" className="gap-1.5 text-xs" disabled={manualLoading || !manualName.trim() || !manualPhone.trim()}>
                {manualLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Salvar Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* FILE IMPORT DIALOG */}
      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> Importar CSV / TXT
            </DialogTitle>
            <DialogDescription className="text-xs">
              Arquivo com colunas: <code className="bg-muted px-1 rounded text-[10px]">nome</code>, <code className="bg-muted px-1 rounded text-[10px]">telefone</code>, <code className="bg-muted px-1 rounded text-[10px]">email</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Clique para selecionar ou arraste o arquivo aqui</span>
              <span className="text-[10px] text-muted-foreground">.csv ou .txt</span>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
            {fileError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {fileError}
              </div>
            )}
            {fileParsedLeads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-green-600">{fileParsedLeads.length} leads detectados</p>
                  <Badge variant="secondary" className="text-[10px]">{fileParsedLeads.filter(l => l.phone).length} com telefone</Badge>
                </div>
                <ScrollArea className="h-[140px] border rounded-md">
                  <div className="divide-y">
                    {fileParsedLeads.slice(0, 30).map((l, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                        <p className="text-xs font-medium flex-1 truncate">{l.name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground shrink-0">{l.phone || "Sem tel"}</p>
                      </div>
                    ))}
                    {fileParsedLeads.length > 30 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">+ {fileParsedLeads.length - 30} mais</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setFileDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="gap-1.5 text-xs" disabled={fileUploading || fileParsedLeads.length === 0}
              onClick={async () => { await handleFileImport(); if (!fileUploading) setFileDialogOpen(false); }}>
              {fileUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Importar {fileParsedLeads.length > 0 ? fileParsedLeads.length : ""} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
