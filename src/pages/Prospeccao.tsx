import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Globe, MessageCircle, Loader2, Plus, Users2, MessageSquare,
  Contact, Smartphone, QrCode, RefreshCw, Trash2, Wifi, WifiOff,
  CheckCircle2, Tag, X, Zap, Eye,
  Sparkles, Upload, FileSpreadsheet, AlertCircle, MapPin, ArrowRight,
  ExternalLink, Compass, Target, Building2, Check, Circle, Database, Send, Filter,
  TrendingUp, BarChart3, Flame, ChevronDown, ChevronRight
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

const PRESET_SEGMENTS = [
  { label: "Estética", value: "clínicas estéticas", icon: "💆", primary: true },
  { label: "Odontologia", value: "clínicas odontológicas", icon: "🦷", primary: true },
  { label: "Advocacia", value: "escritórios de advocacia", icon: "⚖️", primary: true },
  { label: "Revendas de Veículos", value: "revendas de veículos seminovos usados", icon: "🚗", primary: true },
  { label: "Bares e Restaurantes", value: "bares restaurantes", icon: "🍽️", primary: false },
  { label: "Imobiliárias", value: "imobiliárias", icon: "🏠", primary: false },
  { label: "Clínicas Médicas", value: "clínicas médicas", icon: "🏥", primary: false },
  { label: "Academias", value: "academias fitness", icon: "💪", primary: false },
  { label: "Contabilidade", value: "escritórios contabilidade", icon: "📊", primary: false },
  { label: "Educação", value: "escolas cursos", icon: "📚", primary: false },
  { label: "Marketing", value: "agências marketing digital", icon: "📢", primary: false },
  { label: "Pet Shops", value: "pet shops veterinários", icon: "🐾", primary: false },
  { label: "Tecnologia", value: "empresas tecnologia SaaS", icon: "💻", primary: false },
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const PROSPECTING_STAGES = [
  { label: "Analisando perfil da consultoria e ICP...", delay: 0 },
  { label: "Montando consultas inteligentes para o nicho...", delay: 3000 },
  { label: "Buscando leads em sites públicos...", delay: 8000 },
  { label: "Raspando páginas de contato...", delay: 15000 },
  { label: "Qualificando cada lead com score ICP...", delay: 25000 },
  { label: "Salvando leads no banco de dados...", delay: 40000 },
];

function ProspectingThinkingFeed({ isRunning }: { isRunning: boolean }) {
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
      setCurrentStep(Math.max(0, PROSPECTING_STAGES.filter(s => elapsed >= s.delay).length - 1));
    }, 500);
    return () => clearInterval(timer);
  }, [isRunning]);

  if (!isRunning) return null;
  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

  return (
    <div className="mt-3 space-y-1.5 pl-1">
      {PROSPECTING_STAGES.map((stage, i) => {
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
  const [promotingIds, setPromotingIds] = useState<Set<string>>(new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  
  // Promote dialog
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteTargetIds, setPromoteTargetIds] = useState<string[]>([]);

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

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return phone;
  };
  const capitalizeName = (name: string) => name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  const activeNiche = customNiche || selectedNiche;
  const activeLocation = [selectedCity, selectedBairro, selectedState].filter(Boolean).join(", ");
  const resetWizard = () => { setSelectedNiche(""); setCustomNiche(""); setSelectedState(""); setSelectedCity(""); setSelectedBairro(""); setLeadCount(20); setProspectingIntent(""); };

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
        prospectsToInsert.push({
          nome_negocio: l.name || enrichment.company || "Lead sem nome",
          nicho: enrichment.segment || enrichment.scraped_niche || "Não definido",
          cidade: enrichment.city || enrichment.scraped_location || "Não informada",
          whatsapp: normalizedWhatsapp,
          site: enrichment.website || null,
          decisor: l.name || null,
          observacoes: enrichment.icp_reason || null,
          score_qualificacao: enrichment.icp_score || null,
          origem: l.source === "web" ? "prospeccao_web" : l.source === "whatsapp" ? "whatsapp" : "manual",
          status: "novo",
          responsavel: "danilo",
        });
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

  const filteredLeads = savedLeads.filter(l => {
    const enrichment = (l.enrichment_data as any) || {};
    const score = enrichment.icp_score ?? 50;
    if (leadsFilter === "high" && score < 60) return false;
    if (leadsFilter === "medium" && (score < 40 || score >= 60)) return false;
    if (leadsFilter === "low" && score >= 40) return false;
    if (leadsSourceFilter !== "all" && l.source !== leadsSourceFilter) return false;
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

  // === Web Scraping ===
  const handleScrape = async () => {
    if (!user || !activeNiche) return;
    setScrapingLoading(true);
    setWizardOpen(false);
    const jobId = crypto.randomUUID();
    const newJob: ScrapeJob = {
      id: jobId, niche: activeNiche, city: activeLocation, prospecting_intent: prospectingIntent,
      status: "running", results: [], results_count: 0, total_found: 0,
      duplicates_skipped: 0, pages_searched: 0, avg_icp_score: 0, created_at: new Date().toISOString(),
    };
    setScrapeJobs(prev => [newJob, ...prev]);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-leads", {
        body: { niche: activeNiche, city: selectedCity || undefined, state: selectedState || undefined, bairro: selectedBairro || undefined, limit: leadCount, prospecting_intent: prospectingIntent || undefined },
      });
      if (error || data?.error) {
        const errMsg = data?.error || error?.message || "Erro desconhecido";
        if (errMsg.includes("Créditos de IA esgotados") || errMsg.includes("402")) {
          throw new Error("Créditos de IA esgotados. Vá em Settings → Workspace → Usage no Lovable para adicionar créditos.");
        }
        if (errMsg.includes("Limite de requisições") || errMsg.includes("429")) {
          throw new Error("Limite de requisições atingido. Aguarde 1 minuto e tente novamente.");
        }
        throw new Error(errMsg);
      }
      // Surface Firecrawl errors even when count=0 (no hard error thrown)
      const firecrawlMsg = data?.firecrawl_error ? ` (Firecrawl: ${data.firecrawl_error})` : "";
      setScrapeJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "completed" as const, results_count: data?.count || 0, total_found: data?.total_found || 0, duplicates_skipped: data?.duplicates_skipped || 0, pages_searched: data?.pages_searched || 0, results: data?.results || [], avg_icp_score: data?.avg_icp_score || 0, error_message: data?.firecrawl_error || undefined } : j));
      if (data?.count === 0 && data?.firecrawl_error) {
        toast({ title: "Prospecção com erro ⚠️", description: data.message || data.firecrawl_error, variant: "destructive" });
      } else {
        toast({ title: "Prospecção concluída! 🎯", description: `${data?.count || 0} novos leads salvos${firecrawlMsg}` });
      }
      refetchLeads();
      resetWizard();
    } catch (error: any) {
      setScrapeJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "failed" as const, error_message: error.message } : j));
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
    <div className="space-y-6 max-w-6xl">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prospecção</h1>
          <p className="text-sm text-muted-foreground">Funil de captação e qualificação de leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value="actions" onValueChange={(v) => {
            if (v === "manual") {
              setManualName(""); setManualPhone(""); setManualEmail("");
              // Open manual dialog — we'll use a simple approach
            }
          }}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Importar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actions" disabled>Importar...</SelectItem>
              <SelectItem value="manual">
                <span className="flex items-center gap-1.5"><Plus className="h-3 w-3" />Manual</span>
              </SelectItem>
              <SelectItem value="file">
                <span className="flex items-center gap-1.5"><Upload className="h-3 w-3" />Arquivo CSV</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => { resetWizard(); setWizardOpen(true); }}>
            <Sparkles className="h-3.5 w-3.5" /> Nova Pesquisa
          </Button>
        </div>
      </div>

      {/* KPI BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Leads na semana</span>
          </div>
          <p className="text-2xl font-bold tracking-tight">{kpiMetrics.leadsThisWeek}</p>
          <p className="text-[10px] text-muted-foreground">{kpiMetrics.totalLeads} total</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-green-500/10 flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground">Taxa de promoção</span>
          </div>
          <p className="text-2xl font-bold tracking-tight">{kpiMetrics.conversionRate}%</p>
          <p className="text-[10px] text-muted-foreground">{kpiMetrics.promotedLeads} → pipeline</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-yellow-500/10 flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground">ICP médio</span>
          </div>
          <p className="text-2xl font-bold tracking-tight">{kpiMetrics.avgIcp}</p>
          <p className="text-[10px] text-muted-foreground">Score de aderência</p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground">Melhor fonte</span>
          </div>
          <p className="text-2xl font-bold tracking-tight">{kpiMetrics.bestSource}</p>
          <p className="text-[10px] text-muted-foreground">Mais leads captados</p>
        </div>
      </div>

      {/* SMART QUEUE */}
      {smartQueue.length > 0 && (
        <div className="border rounded-lg p-4 bg-primary/[0.02] border-primary/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Fila Inteligente</h3>
              <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]" variant="outline">
                {smartQueue.length} leads quentes
              </Badge>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs w-full sm:w-auto"
              onClick={() => openPromoteDialog(smartQueue.slice(0, 10).map(l => l.id))}
            >
              <Send className="h-3.5 w-3.5" /> Enviar Top {Math.min(10, smartQueue.length)} ao Pipeline
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {smartQueue.slice(0, 6).map(lead => {
              const enrichment = (lead.enrichment_data as any) || {};
              const score = enrichment.icp_score ?? 0;
              return (
                <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${icpScoreColor(score)}`}>
                    {score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name || "Sem nome"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {enrichment.segment && <span>{enrichment.segment}</span>}
                      {enrichment.city && <span> · {enrichment.city}</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openPromoteDialog([lead.id])}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
          {smartQueue.length > 6 && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">+ {smartQueue.length - 6} leads com ICP ≥ 60 aguardando ação</p>
          )}
        </div>
      )}

      {/* MAIN CONTENT - 2 zones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Leads list (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold">Todos os Leads</h3>
              <p className="text-xs text-muted-foreground">{filteredLeads.length} leads</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedLeadIds.size > 0 && (
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => openPromoteDialog(Array.from(selectedLeadIds))} disabled={promotingIds.size > 0}>
                  <Send className="h-3.5 w-3.5" />
                  Enviar {selectedLeadIds.size} ao Pipeline
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetchLeads()} disabled={leadsLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${leadsLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ICP:</span>
            </div>
            {([
              { key: "all" as const, label: "Todos" },
              { key: "high" as const, label: "Alto (60+)" },
              { key: "medium" as const, label: "Médio" },
              { key: "low" as const, label: "Baixo" },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setLeadsFilter(f.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${leadsFilter === f.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {f.label}
              </button>
            ))}
            <Select value={leadsSourceFilter} onValueChange={setLeadsSourceFilter}>
              <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas fontes</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="import">Importação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select all */}
          {filteredLeads.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedLeadIds.size === filteredLeads.filter(l => l.status !== "promoted").length && filteredLeads.filter(l => l.status !== "promoted").length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedLeadIds(new Set(filteredLeads.filter(l => l.status !== "promoted").map(l => l.id)));
                  } else {
                    setSelectedLeadIds(new Set());
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">Selecionar todos ({filteredLeads.filter(l => l.status !== "promoted").length})</span>
            </div>
          )}

          {leadsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-sm">Carregando...</span></div>
          ) : filteredLeads.length === 0 ? (
            <div className="border border-dashed rounded-lg p-10 text-center">
              <Database className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhum lead salvo</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Faça uma prospecção por nicho ou extraia contatos do WhatsApp</p>
              <Button size="sm" onClick={() => { resetWizard(); setWizardOpen(true); }} className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Iniciar Pesquisa
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-480px)] min-h-[300px] border rounded-lg">
              <div className="divide-y">
                {filteredLeads.map(lead => {
                  const enrichment = (lead.enrichment_data as any) || {};
                  const icpScore = enrichment.icp_score ?? null;
                  const isPromoted = lead.status === "promoted";
                  const isHighIcp = (icpScore ?? 0) >= 60;
                  return (
                    <div key={lead.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors ${isPromoted ? "opacity-40 bg-muted/30" : isHighIcp ? "bg-primary/[0.02] hover:bg-primary/[0.04]" : "hover:bg-secondary/30"}`}>
                      {!isPromoted && (
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={(checked) => {
                            setSelectedLeadIds(prev => {
                              const next = new Set(prev);
                              checked ? next.add(lead.id) : next.delete(lead.id);
                              return next;
                            });
                          }}
                        />
                      )}
                      {isPromoted && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{lead.name || "Sem nome"}</p>
                          {isPromoted && <Badge variant="secondary" className="text-[10px]">No Pipeline</Badge>}
                          {enrichment.segment && <Badge variant="outline" className="text-[10px] max-w-[120px] truncate">{enrichment.segment}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {lead.phone && <span>{lead.phone}</span>}
                          {enrichment.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{enrichment.city}</span>}
                          {enrichment.company && enrichment.company !== lead.name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{enrichment.company}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {icpScore !== null && (
                          <Badge variant="outline" className={`text-[10px] font-bold ${icpScoreColor(icpScore)}`}>ICP {icpScore}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize">{lead.source}</Badge>
                        {!isPromoted && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" title="Enviar ao Pipeline"
                            disabled={promotingIds.has(lead.id)}
                            onClick={() => openPromoteDialog([lead.id])}>
                            {promotingIds.has(lead.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3" />Pipeline</>}
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

        {/* RIGHT — Capture methods (1/3) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Captação</h3>

          {/* Capture tabs */}
          <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
            <button
              onClick={() => setCaptureTab("web")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${captureTab === "web" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Globe className="h-3.5 w-3.5" /> Por Nicho
            </button>
            <button
              onClick={() => setCaptureTab("whatsapp")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${captureTab === "whatsapp" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
          </div>

          {captureTab === "web" && (
            <div className="space-y-3">
              {/* Quick launch */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium">Pesquisa rápida por nicho</p>
                <Button size="sm" className="gap-1.5 text-xs w-full" onClick={() => { resetWizard(); setWizardOpen(true); }}>
                  <Sparkles className="h-3.5 w-3.5" /> Nova Pesquisa
                </Button>
              </div>

              {/* Recent jobs */}
              {scrapeJobs.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Pesquisas recentes</p>
                  {scrapeJobs.slice(0, 5).map(job => {
                    const cfg = statusConfig[job.status];
                    return (
                      <div key={job.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-secondary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{job.niche}</p>
                          {job.city && <p className="text-[10px] text-muted-foreground truncate">{job.city}</p>}
                          {job.status === "running" && <ProspectingThinkingFeed isRunning={true} />}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                          {job.status === "completed" && job.results.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewResults(job)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual & File import */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Adicionar manualmente</p>
                <form onSubmit={handleManualAdd} className="space-y-2">
                  <Input placeholder="Nome" value={manualName} onChange={(e) => setManualName(e.target.value)} required className="text-xs h-8" />
                  <Input placeholder="Telefone" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} required className="text-xs h-8" />
                  <Input type="email" placeholder="Email (opcional)" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="text-xs h-8" />
                  <Button type="submit" size="sm" disabled={manualLoading} className="gap-1.5 text-xs w-full" variant="outline">
                    {manualLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Adicionar
                  </Button>
                </form>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Importar CSV</p>
                <label htmlFor="file-upload-sidebar" className="flex flex-col items-center gap-1 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <p className="text-[10px] font-medium">Selecionar arquivo</p>
                  <input id="file-upload-sidebar" type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
                {fileError && <p className="text-[10px] text-destructive">{fileError}</p>}
                {fileParsedLeads.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">{fileParsedLeads.length} leads encontrados</p>
                    <Button onClick={handleFileImport} size="sm" disabled={fileUploading} className="gap-1.5 text-xs w-full" variant="outline">
                      {fileUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Importar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {captureTab === "whatsapp" && (
            <div className="space-y-3">
              {/* Group Search */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium flex items-center gap-1.5"><Compass className="h-3.5 w-3.5 text-primary" />Buscar Grupos</p>
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
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-green-500" />Instâncias</p>
                  {instances.length > 0 && (
                    <Button variant="ghost" size="icon" onClick={fetchInstances} disabled={instancesLoading} className="h-6 w-6">
                      <RefreshCw className={`h-3 w-3 ${instancesLoading ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
                {instances.map(inst => (
                  <div key={inst.name} className={`flex items-center justify-between p-2 rounded-md border transition-colors text-xs ${selectedInstance === inst.name ? "bg-primary/5 border-primary/30" : "hover:bg-secondary/50"}`}>
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
                  <Input placeholder="Nome instância" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} className="text-xs h-7" onKeyDown={(e) => e.key === "Enter" && createInstance()} />
                  <Button onClick={createInstance} disabled={creatingInstance || !newInstanceName.trim()} size="sm" className="shrink-0 text-xs h-7 px-2">
                    {creatingInstance ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Extract */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium">Extração</p>
                <div className="flex gap-1 flex-wrap">
                  {([{ key: "group" as const, label: "Grupos", icon: Users2 }, { key: "conversation" as const, label: "Conversas", icon: MessageSquare }, { key: "contact" as const, label: "Contatos", icon: Contact }]).map(opt => (
                    <button key={opt.key} onClick={() => { setWhatsappMode(opt.key); if (opt.key === "group" && availableGroups.length === 0 && selectedInstance) handleFetchGroups(); }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${whatsappMode === opt.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <opt.icon className="h-2.5 w-2.5" />{opt.label}
                    </button>
                  ))}
                </div>
                {whatsappMode === "group" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input placeholder="Filtrar..." value={groupSearchFilter} onChange={(e) => setGroupSearchFilter(e.target.value)} className="text-[10px] pl-7 h-7" />
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
                      <ScrollArea className="h-[150px] border rounded-md">
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
                    ) : !selectedInstance ? <p className="text-[10px] text-yellow-600 py-2 text-center">Selecione instância</p> : null}
                    {selectedGroupIds.size > 0 && (
                      <div className="border rounded-md p-2 space-y-1.5 bg-secondary/30">
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
                  Extrair
                </Button>
              </div>
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
            {/* ICP Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
              <Target className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-green-600">ICP configurado — VS Growth Hub</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Qualificação baseada no perfil da consultoria (donos de negócios locais, faturamento acima de R$ 30k/mês)
                </p>
              </div>
            </div>

            {/* Prospecting Intent */}
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

            {/* Segment — Primary nichos highlighted */}
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
                      <button key={n.value} onClick={() => { setSelectedNiche(n.value); setCustomNiche(""); }}
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
                        <button key={n.value} onClick={() => { setSelectedNiche(n.value); setCustomNiche(""); }}
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
    </div>
  );
}
