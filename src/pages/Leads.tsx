import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search, Filter, Users2, Phone, Mail, Globe, MapPin, Tag,
  ChevronDown, ChevronRight, ExternalLink, Eye, TrendingUp,
  Flame, Snowflake, Thermometer, X, Building2, Calendar,
  ArrowUpDown, LayoutGrid, LayoutList, SlidersHorizontal,
  Database, UserCheck, Inbox, Rocket, Loader2, Megaphone, PlayCircle, Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { buildLeadIdentityKey } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { NICHO_CATEGORIES, nichoCategory } from "@/components/comercial/types";

type Prospect = Tables<"consultoria_prospects">;
type LeadRaw = Tables<"leads_raw">;

/* ── Unified Lead type ─────────────────────────── */
type UnifiedLead = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  nicho: string | null;
  site: string | null;
  instagram: string | null;
  decisor: string | null;
  status: string;
  classificacao_ia: string | null;
  score: number | null;
  origem: string | null;
  created_at: string | null;
  data_abordagem: string | null;
  data_ultima_interacao: string | null;
  data_proxima_acao: string | null;
  dia_cadencia: number | null;
  observacoes: string | null;
  resumo_conversa: string | null;
  handoff_reason: string | null;
  handoff_at: string | null;
  faturamento_estimado: string | null;
  responsavel: string | null;
  script_usado: string | null;
  tags: string[] | null;
  enrichment_data: Record<string, any> | null;
  fonte: "prospect" | "lead_raw";
  raw_status: string;
};

function getLeadPriority(lead: UnifiedLead) {
  if (lead.fonte === "prospect") return 3;
  if (lead.raw_status === "promoted") return 1;
  return 2;
}

function mergeLeadData(primary: UnifiedLead, secondary: UnifiedLead): UnifiedLead {
  return {
    ...secondary,
    ...primary,
    email: primary.email ?? secondary.email,
    cidade: primary.cidade ?? secondary.cidade,
    nicho: primary.nicho ?? secondary.nicho,
    site: primary.site ?? secondary.site,
    instagram: primary.instagram ?? secondary.instagram,
    decisor: primary.decisor ?? secondary.decisor,
    score: primary.score ?? secondary.score,
    origem: primary.origem ?? secondary.origem,
    observacoes: primary.observacoes ?? secondary.observacoes,
    resumo_conversa: primary.resumo_conversa ?? secondary.resumo_conversa,
    faturamento_estimado: primary.faturamento_estimado ?? secondary.faturamento_estimado,
    tags: primary.tags ?? secondary.tags,
    enrichment_data: primary.enrichment_data ?? secondary.enrichment_data,
  };
}

function prospectToUnified(p: Prospect): UnifiedLead {
  return {
    id: p.id,
    nome: p.nome_negocio,
    telefone: p.whatsapp,
    email: null,
    cidade: p.cidade,
    nicho: p.nicho,
    site: p.site,
    instagram: p.instagram,
    decisor: p.decisor,
    status: p.status,
    classificacao_ia: p.classificacao_ia,
    score: p.score_qualificacao,
    origem: p.origem,
    created_at: p.created_at,
    data_abordagem: p.data_abordagem,
    data_ultima_interacao: p.data_ultima_interacao,
    data_proxima_acao: p.data_proxima_acao,
    dia_cadencia: p.dia_cadencia,
    observacoes: p.observacoes,
    resumo_conversa: p.resumo_conversa,
    handoff_reason: p.handoff_reason,
    handoff_at: p.handoff_at,
    faturamento_estimado: p.faturamento_estimado,
    responsavel: p.responsavel,
    script_usado: p.script_usado,
    tags: null,
    enrichment_data: null,
    fonte: "prospect",
    raw_status: p.status,
  };
}

function leadRawToUnified(l: LeadRaw): UnifiedLead {
  const enrichment = (l.enrichment_data && typeof l.enrichment_data === "object" && !Array.isArray(l.enrichment_data))
    ? l.enrichment_data as Record<string, any>
    : null;
  return {
    id: l.id,
    nome: l.name || "Sem nome",
    telefone: l.phone,
    email: l.email,
    cidade: enrichment?.cidade || enrichment?.city || null,
    nicho: enrichment?.nicho || enrichment?.segment || null,
    site: enrichment?.site || enrichment?.website || null,
    instagram: enrichment?.instagram || null,
    decisor: enrichment?.decisor || enrichment?.contact_name || null,
    status: l.status === "promoted" ? "promovido" : l.status,
    classificacao_ia: null,
    score: enrichment?.score ?? null,
    origem: l.source === "web" ? "prospecção_web" : l.source,
    created_at: l.created_at,
    data_abordagem: null,
    data_ultima_interacao: null,
    data_proxima_acao: null,
    dia_cadencia: null,
    observacoes: null,
    resumo_conversa: null,
    handoff_reason: null,
    handoff_at: null,
    faturamento_estimado: null,
    responsavel: null,
    script_usado: null,
    tags: l.tags,
    enrichment_data: enrichment,
    fonte: "lead_raw",
    raw_status: l.status,
  };
}

/* ── Status config ────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  novo: { label: "Novo", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Eye },
  abordado: { label: "Abordado", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Phone },
  respondeu: { label: "Respondeu", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: TrendingUp },
  qualificado: { label: "Qualificado", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: Flame },
  fechado: { label: "Fechado", color: "bg-green-500/15 text-green-400 border-green-500/30", icon: TrendingUp },
  perdido: { label: "Perdido", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: X },
  follow_up: { label: "Follow-up", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", icon: Calendar },
  em_cadencia: { label: "Em Cadência", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", icon: Calendar },
  quente: { label: "Quente", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: Flame },
  call_agendada: { label: "Call Agendada", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: Calendar },
  proposta_enviada: { label: "Proposta Enviada", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: TrendingUp },
  pending: { label: "Pendente", color: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: Inbox },
  promovido: { label: "No CRM", color: "bg-green-500/15 text-green-400 border-green-500/30", icon: UserCheck },
  aguardando_humano: { label: "Aguardando", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Eye },
};

const CLASSIFICACAO_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  quente: { label: "Quente", icon: Flame, color: "text-red-400" },
  morno: { label: "Morno", icon: Thermometer, color: "text-amber-400" },
  frio: { label: "Frio", icon: Snowflake, color: "text-blue-400" },
};

type SortField = "created_at" | "score" | "nome" | "data_ultima_interacao";
type ViewMode = "grid" | "list";
type FonteFilter = "todos" | "lead_raw" | "prospect";

export default function Leads() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const nichoStorageKey = user ? `vs_leads_filterNicho_${user.id}` : "vs_leads_filterNicho";
  const [search, setSearch] = useState("");
  const [fonteFilter, setFonteFilter] = useState<FonteFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [nichoFilter, setNichoFilter] = useState(() => localStorage.getItem(nichoStorageKey) || "todos");
  const [cidadeFilter, setCidadeFilter] = useState<string>("todos");
  const [origemFilter, setOrigemFilter] = useState<string>("todos");
  const [classificacaoFilter, setClassificacaoFilter] = useState<string>("todos");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedLead, setSelectedLead] = useState<UnifiedLead | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [abordandoId, setAbordandoId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(nichoStorageKey, nichoFilter);
  }, [nichoFilter, nichoStorageKey]);

  /* ── Fetch both tables ─────────────────────────── */
  const { data: prospects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ["all-prospects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_prospects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
  });

  const { data: leadsRaw = [], isLoading: loadingRaw } = useQuery({
    queryKey: ["all-leads-raw"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_raw")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRaw[];
    },
  });

  const isLoading = loadingProspects || loadingRaw;

  /* ── Promote lead_raw → CRM prospect ───────────── */
  const handlePromote = useCallback(async (lead: UnifiedLead) => {
    if (lead.fonte !== "lead_raw") return;
    if (!lead.telefone && !lead.email) {
      toast({ title: "Lead sem contato", description: "É necessário pelo menos telefone ou email para promover.", variant: "destructive" });
      return;
    }
    setPromotingId(lead.id);
    try {
      // Normaliza WhatsApp para checar duplicata direto no banco
      const normalizedWhatsapp = (lead.telefone || "").replace(/\D/g, "");

      if (normalizedWhatsapp) {
        const { data: existing } = await supabase
          .from("consultoria_prospects")
          .select("id, nome_negocio")
          .eq("whatsapp", lead.telefone || "")
          .maybeSingle();

        // Tenta também sem formatação
        const { data: existing2 } = !existing ? await supabase
          .from("consultoria_prospects")
          .select("id, nome_negocio")
          .eq("whatsapp", normalizedWhatsapp)
          .maybeSingle() : { data: existing };

        const match = existing || existing2;
        if (match) {
          await supabase.from("leads_raw").update({ status: "promoted" }).eq("id", lead.id);
          queryClient.invalidateQueries({ queryKey: ["all-prospects"] });
          queryClient.invalidateQueries({ queryKey: ["all-leads-raw"] });
          queryClient.invalidateQueries({ queryKey: ["prospects"] });
          setSelectedLead(null);
          toast({ title: `${lead.nome} já estava no CRM`, description: `Já existe como "${match.nome_negocio}". Marquei como promovido.` });
          return;
        }
      }

      const { error: insertError } = await supabase.from("consultoria_prospects").insert({
        nome_negocio: lead.nome,
        whatsapp: lead.telefone || "",
        cidade: lead.cidade || "Não informada",
        nicho: lead.nicho || "Outro",
        decisor: lead.decisor,
        site: lead.site,
        instagram: lead.instagram,
        faturamento_estimado: lead.faturamento_estimado,
        origem: lead.origem || "lista",
        status: "novo",
        observacoes: lead.observacoes || (lead.email ? `Email: ${lead.email}` : null),
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("leads_raw")
        .update({ status: "promoted" })
        .eq("id", lead.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["all-prospects"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads-raw"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setSelectedLead(null);
      toast({ title: `${lead.nome} promovido para o CRM!`, description: "O lead agora aparece no Pipeline Comercial." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
      console.error("Erro ao promover lead:", err);
      toast({ title: "Erro ao promover", description: msg, variant: "destructive" });
    } finally {
      setPromotingId(null);
    }
  }, [queryClient]);

  /* ── Abordar prospect direto do módulo Leads ────── */
  const handleAbordar = useCallback(async (lead: UnifiedLead) => {
    if (lead.fonte !== "prospect") return;
    setAbordandoId(lead.id);
    try {
      const { error } = await supabase.functions.invoke("abordar-prospect", { body: { prospect_id: lead.id } });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["all-prospects"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast({ title: `Script enviado para ${lead.nome}` });
    } catch (err: unknown) {
      toast({ title: "Erro ao abordar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAbordandoId(null);
    }
  }, [queryClient]);

  /* ── Excluir lead ────────────────────────────────── */
  const handleDeleteLead = useCallback(async (lead: UnifiedLead) => {
    if (!confirm(`Excluir "${lead.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const table = lead.fonte === "lead_raw" ? "leads_raw" : "consultoria_prospects";
      const { error } = await supabase.from(table).delete().eq("id", lead.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["all-prospects"] });
      queryClient.invalidateQueries({ queryKey: ["all-leads-raw"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      if (selectedLead?.id === lead.id) setSelectedLead(null);
      toast({ title: `"${lead.nome}" excluído com sucesso` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
      toast({ title: "Erro ao excluir", description: msg, variant: "destructive" });
    }
  }, [queryClient, selectedLead]);

  const allLeads = useMemo(() => {
    const deduped = new Map<string, UnifiedLead>();

    [...leadsRaw.map(leadRawToUnified), ...prospects.map(prospectToUnified)].forEach((lead) => {
      const identity = buildLeadIdentityKey({
        phone: lead.telefone,
        email: lead.email,
        name: lead.nome,
        city: lead.cidade,
        website: lead.site,
      }) ?? `${lead.fonte}:${lead.id}`;

      const current = deduped.get(identity);
      if (!current) {
        deduped.set(identity, lead);
        return;
      }

      if (getLeadPriority(lead) > getLeadPriority(current)) {
        deduped.set(identity, mergeLeadData(lead, current));
        return;
      }

      deduped.set(identity, mergeLeadData(current, lead));
    });

    return Array.from(deduped.values());
  }, [prospects, leadsRaw]);

  /* ── Derived filter options ────────────────────── */
  const filterOptions = useMemo(() => {
    const cidades = new Set<string>();
    const origens = new Set<string>();
    let hasUncategorizedNicho = false;
    allLeads.forEach((l) => {
      if (l.nicho && !nichoCategory(l.nicho)) hasUncategorizedNicho = true;
      if (l.cidade) cidades.add(l.cidade);
      if (l.origem) origens.add(l.origem);
    });
    const nichoOptions: string[] = NICHO_CATEGORIES.map(c => c.label);
    if (hasUncategorizedNicho) nichoOptions.push("Não definido");
    return {
      nichos: nichoOptions,
      cidades: Array.from(cidades).sort(),
      origens: Array.from(origens).sort(),
    };
  }, [allLeads]);

  /* ── Filtering + sorting ───────────────────────── */
  const filtered = useMemo(() => {
    let result = [...allLeads];
    if (fonteFilter !== "todos") result = result.filter((l) => l.fonte === fonteFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          l.decisor?.toLowerCase().includes(q) ||
          l.telefone?.includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.cidade?.toLowerCase().includes(q) ||
          l.nicho?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "todos") result = result.filter((l) => l.status === statusFilter || l.raw_status === statusFilter);
    if (nichoFilter !== "todos") {
      if (nichoFilter === "Não definido") {
        result = result.filter((l) => !l.nicho || !nichoCategory(l.nicho));
      } else {
        const cat = NICHO_CATEGORIES.find(c => c.label === nichoFilter);
        if (cat) {
          result = result.filter((l) => l.nicho && cat.keywords.some(k => l.nicho!.toLowerCase().includes(k)));
        }
      }
    }
    if (cidadeFilter !== "todos") result = result.filter((l) => l.cidade === cidadeFilter);
    if (origemFilter !== "todos") result = result.filter((l) => l.origem === origemFilter);
    if (classificacaoFilter !== "todos") result = result.filter((l) => l.classificacao_ia === classificacaoFilter);

    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "score":
          valA = a.score ?? 0;
          valB = b.score ?? 0;
          break;
        case "nome":
          valA = a.nome.toLowerCase();
          valB = b.nome.toLowerCase();
          break;
        case "data_ultima_interacao":
          valA = a.data_ultima_interacao ?? "";
          valB = b.data_ultima_interacao ?? "";
          break;
        default:
          valA = a.created_at ?? "";
          valB = b.created_at ?? "";
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return result;
  }, [allLeads, fonteFilter, search, statusFilter, nichoFilter, cidadeFilter, origemFilter, classificacaoFilter, sortField, sortAsc]);

  /* ── Stats ─────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = allLeads.length;
    const rawCount = allLeads.filter((l) => l.fonte === "lead_raw").length;
    const prospectCount = allLeads.filter((l) => l.fonte === "prospect").length;
    const pendingCount = allLeads.filter((l) => l.raw_status === "pending").length;
    const promotedCount = allLeads.filter((l) => l.raw_status === "promoted" && l.fonte === "lead_raw").length;
    return { total, rawCount, prospectCount, pendingCount, promotedCount };
  }, [allLeads]);

  const activeFiltersCount = [fonteFilter, statusFilter, nichoFilter, cidadeFilter, origemFilter, classificacaoFilter].filter(
    (f) => f !== "todos"
  ).length;

  const clearFilters = () => {
    setFonteFilter("todos");
    setStatusFilter("todos");
    setNichoFilter("todos");
    setCidadeFilter("todos");
    setOrigemFilter("todos");
    setClassificacaoFilter("todos");
    setSearch("");
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—";
    const clean = phone.replace(/\D/g, "");
    if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    return phone;
  };

  const getScoreColor = (score: number | null) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getNichoShort = (nicho: string | null) => {
    if (!nicho) return "—";
    if (nicho.length <= 30) return nicho;
    return nicho.split(",")[0].trim().slice(0, 28) + "…";
  };

  const getFonteBadge = (fonte: "prospect" | "lead_raw") => {
    if (fonte === "prospect") return { label: "CRM", color: "bg-primary/15 text-primary border-primary/30" };
    return { label: "Lista", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="vs-h1 flex items-center gap-2">
            <Users2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Leads
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Todos os leads — listas de prospecção e CRM
          </p>
        </div>
        {fonteFilter === "todos" && (
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 px-2.5"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 px-2.5"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-primary" },
          { label: "Da Lista", value: stats.rawCount, color: "text-amber-400" },
          { label: "No CRM", value: stats.prospectCount, color: "text-blue-400" },
          { label: "Pendentes", value: stats.pendingCount, color: "text-muted-foreground" },
          { label: "Promovidos", value: stats.promotedCount, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-3.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Fonte tabs ── */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 w-fit overflow-x-auto hide-scrollbar">
        {([
          { key: "todos" as FonteFilter, label: "Todos", icon: Users2, count: stats.total },
          { key: "lead_raw" as FonteFilter, label: "Listas", icon: Database, count: stats.rawCount },
          { key: "prospect" as FonteFilter, label: "CRM", icon: UserCheck, count: stats.prospectCount },
        ]).map((tab) => (
          <Button
            key={tab.key}
            variant={fonteFilter === tab.key ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setFonteFilter(tab.key)}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${fonteFilter === tab.key ? "bg-primary-foreground/20" : "bg-muted"}`}>
              {tab.count}
            </span>
          </Button>
        ))}
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, decisor, telefone, email, cidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              {filtersOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Data de criação</SelectItem>
            <SelectItem value="score">Score</SelectItem>
            <SelectItem value="nome">Nome A-Z</SelectItem>
            <SelectItem value="data_ultima_interacao">Última interação</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setSortAsc(!sortAsc)}>
          {sortAsc ? "↑" : "↓"}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-destructive" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {allLeads.length} leads
        </span>
      </div>

      {/* ── Filters panel ── */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-card border border-border rounded-lg p-3 sm:p-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(STATUS_MAP).map(([key, v]) => (
                    <SelectItem key={key} value={key}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Nicho</label>
              <Select value={nichoFilter} onValueChange={setNichoFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {filterOptions.nichos.map((n) => (
                    <SelectItem key={n} value={n}>{getNichoShort(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Cidade</label>
              <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {filterOptions.cidades.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Origem</label>
              <Select value={origemFilter} onValueChange={setOrigemFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {filterOptions.origens.map((o) => (
                    <SelectItem key={o} value={o}>{o === "prospecção_web" ? "Web" : o === "manual" ? "Manual" : o === "whatsapp" ? "WhatsApp" : o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Classificação IA</label>
              <Select value={classificacaoFilter} onValueChange={setClassificacaoFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="quente">🔥 Quente</SelectItem>
                  <SelectItem value="morno">🌡️ Morno</SelectItem>
                  <SelectItem value="frio">❄️ Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users2 className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">Nenhum lead encontrado</p>
          <p className="text-sm mt-1">Ajuste os filtros ou inicie uma prospecção</p>
        </div>
      ) : (() => {
        const effectiveView = fonteFilter === "lead_raw" ? "list" : fonteFilter === "prospect" ? "grid" : viewMode;
        return effectiveView === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((lead) => (
            <LeadCard
              key={`${lead.fonte}-${lead.id}`}
              lead={lead}
              formatDate={formatDate}
              formatPhone={formatPhone}
              getScoreColor={getScoreColor}
              getNichoShort={getNichoShort}
              getFonteBadge={getFonteBadge}
              onSelect={() => setSelectedLead(selectedLead?.id === lead.id && selectedLead?.fonte === lead.fonte ? null : lead)}
              isSelected={selectedLead?.id === lead.id && selectedLead?.fonte === lead.fonte}
              onPromote={handlePromote}
              onAbordar={handleAbordar}
              promotingId={promotingId}
              abordandoId={abordandoId}
              onDelete={handleDeleteLead}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Nome</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Contato</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Nicho</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Cidade</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Score</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Origem</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs">Criado</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs w-[140px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const st = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-muted text-muted-foreground border-border" };
                const fb = getFonteBadge(lead.fonte);
                return (
                  <tr
                    key={`${lead.fonte}-${lead.id}`}
                    className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedLead(selectedLead?.id === lead.id && selectedLead?.fonte === lead.fonte ? null : lead)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {fonteFilter === "todos" && (
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${fb.color}`}>{fb.label}</Badge>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{lead.nome}</p>
                          {lead.decisor && <p className="text-[11px] text-muted-foreground truncate">{lead.decisor}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {lead.telefone ? (
                        <span className="font-mono">{formatPhone(lead.telefone)}</span>
                      ) : lead.email ? (
                        <span className="truncate block max-w-[180px]">{lead.email}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[120px] truncate">{getNichoShort(lead.nicho)}</td>
                    <td className="p-3 text-xs">{lead.cidade || "—"}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold text-sm ${getScoreColor(lead.score)}`}>
                        {lead.score ?? "—"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      {lead.origem && (
                        <Badge variant="secondary" className="text-[9px]">
                          {lead.origem === "prospecção_web" ? "Web" : lead.origem === "whatsapp" ? "WA" : lead.origem}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {lead.fonte === "lead_raw" && lead.raw_status !== "promoted" && (
                          <Button
                            size="sm"
                            className="text-[10px] h-6 px-2 gap-1"
                            onClick={() => handlePromote(lead)}
                            disabled={promotingId === lead.id}
                          >
                            {promotingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                            CRM
                          </Button>
                        )}
                        {lead.fonte === "lead_raw" && lead.raw_status === "promoted" && (
                          <Badge variant="secondary" className="text-[9px] py-0">
                            <UserCheck className="h-2.5 w-2.5 mr-0.5" /> CRM
                          </Badge>
                        )}
                        {lead.fonte === "prospect" && lead.status === "novo" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-6 px-2 gap-1"
                            onClick={() => handleAbordar(lead)}
                            disabled={abordandoId === lead.id}
                          >
                            {abordandoId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
                            Abordar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 px-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteLead(lead)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      })()}

      {/* ── Detail slide ── */}
      <LeadDetailModal
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        formatDate={formatDate}
        formatPhone={formatPhone}
        getScoreColor={getScoreColor}
        getFonteBadge={getFonteBadge}
        onPromote={handlePromote}
        onAbordar={handleAbordar}
        promotingId={promotingId}
        abordandoId={abordandoId}
      />
    </div>
  );
}

/* ── Lead Card Component ─────────────────────────── */
function LeadCard({
  lead,
  formatDate,
  formatPhone,
  getScoreColor,
  getNichoShort,
  getFonteBadge,
  onSelect,
  isSelected,
  onPromote,
  onAbordar,
  onDelete,
  promotingId,
  abordandoId,
}: {
  lead: UnifiedLead;
  formatDate: (d: string | null) => string;
  formatPhone: (p: string | null) => string;
  getScoreColor: (s: number | null) => string;
  getNichoShort: (n: string | null) => string;
  getFonteBadge: (f: "prospect" | "lead_raw") => { label: string; color: string };
  onSelect: () => void;
  isSelected: boolean;
  onPromote: (lead: UnifiedLead) => void;
  onAbordar: (lead: UnifiedLead) => void;
  onDelete: (lead: UnifiedLead) => void;
  promotingId: string | null;
  abordandoId: string | null;
}) {
  const st = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-muted text-muted-foreground border-border", icon: Eye };
  const cl = lead.classificacao_ia ? CLASSIFICACAO_MAP[lead.classificacao_ia] : null;
  const fb = getFonteBadge(lead.fonte);

  return (
    <div
      onClick={onSelect}
      className={`bg-card border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
        isSelected ? "border-primary ring-1 ring-primary/20 shadow-md" : "border-border"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-foreground text-sm truncate" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {lead.nome}
          </h3>
          {lead.decisor && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.decisor}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant="outline" className={`text-[9px] leading-none ${fb.color}`}>{fb.label}</Badge>
          {cl && <cl.icon className={`h-3.5 w-3.5 ${cl.color}`} />}
          <Badge variant="outline" className={`text-[10px] leading-none ${st.color}`}>
            {st.label}
          </Badge>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {lead.nicho && (
          <div className="flex items-center gap-1.5">
            <Tag className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{getNichoShort(lead.nicho)}</span>
          </div>
        )}
        {lead.cidade && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span>{lead.cidade}</span>
          </div>
        )}
        {lead.telefone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono text-[11px]">{formatPhone(lead.telefone)}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.site && (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 flex-shrink-0" />
            <a
              href={lead.site}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {lead.site.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
            </a>
          </div>
        )}
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{tag}</span>
          ))}
          {lead.tags.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{lead.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
          <span className={`font-bold text-sm ${getScoreColor(lead.score)}`}>
            {lead.score ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {lead.origem && (
            <Badge variant="secondary" className="text-[9px] py-0 px-1.5">
              {lead.origem === "prospecção_web" ? "Web" : lead.origem === "whatsapp" ? "WA" : lead.origem}
            </Badge>
          )}
          <span>{formatDate(lead.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
        {lead.fonte === "lead_raw" && lead.raw_status !== "promoted" && (
          <Button
            size="sm"
            className="text-[11px] h-7 px-2.5 flex-1 gap-1"
            onClick={() => onPromote(lead)}
            disabled={promotingId === lead.id}
          >
            {promotingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
            Enviar pro CRM
          </Button>
        )}
        {lead.fonte === "prospect" && lead.status === "novo" && (
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-7 px-2.5 flex-1 gap-1"
            onClick={() => onAbordar(lead)}
            disabled={abordandoId === lead.id}
          >
            {abordandoId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
            Abordar
          </Button>
        )}
        {lead.fonte === "lead_raw" && lead.raw_status === "promoted" && (
          <Badge variant="secondary" className="text-[10px]">
            <UserCheck className="h-3 w-3 mr-1" /> Já no CRM
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-[11px] h-7 w-7 px-0 ml-auto text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(lead)}
          title="Excluir lead"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/* ── Lead Detail Modal ────────────────────────────── */
function LeadDetailModal({
  lead,
  open,
  onClose,
  formatDate,
  formatPhone,
  getScoreColor,
  getFonteBadge,
  onPromote,
  onAbordar,
  promotingId,
  abordandoId,
}: {
  lead: UnifiedLead | null;
  open: boolean;
  onClose: () => void;
  formatDate: (d: string | null) => string;
  formatPhone: (p: string | null) => string;
  getScoreColor: (s: number | null) => string;
  getFonteBadge: (f: "prospect" | "lead_raw") => { label: string; color: string };
  onPromote: (lead: UnifiedLead) => void;
  onAbordar: (lead: UnifiedLead) => void;
  promotingId: string | null;
  abordandoId: string | null;
}) {
  if (!lead) return null;

  const st = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-muted text-muted-foreground border-border" };
  const cl = lead.classificacao_ia ? CLASSIFICACAO_MAP[lead.classificacao_ia] : null;
  const fb = getFonteBadge(lead.fonte);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${fb.color}`}>{fb.label}</Badge>
            <DialogTitle
              className="text-lg font-bold text-foreground truncate"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {lead.nome}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Action bar */}
        <div className="px-4 py-3 border-b border-border flex gap-2">
          {lead.fonte === "lead_raw" && lead.raw_status !== "promoted" && (
            <Button
              className="flex-1 gap-1.5"
              size="sm"
              onClick={() => onPromote(lead)}
              disabled={promotingId === lead.id}
            >
              {promotingId === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Enviar para o CRM
            </Button>
          )}
          {lead.fonte === "lead_raw" && lead.raw_status === "promoted" && (
            <Badge variant="secondary" className="text-xs py-1.5 px-3">
              <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Já promovido para o CRM
            </Badge>
          )}
          {lead.fonte === "prospect" && lead.status === "novo" && (
            <Button
              className="flex-1 gap-1.5"
              size="sm"
              onClick={() => onAbordar(lead)}
              disabled={abordandoId === lead.id}
            >
              {abordandoId === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
              Abordar via WhatsApp
            </Button>
          )}
          {lead.fonte === "prospect" && lead.telefone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <a
                href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Phone className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </Button>
          )}
        </div>

        <div className="p-4 space-y-5">
          {/* Status + Score */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${st.color}`}>{st.label}</Badge>
            {cl && (
              <div className="flex items-center gap-1 text-xs">
                <cl.icon className={`h-3.5 w-3.5 ${cl.color}`} />
                <span className={cl.color}>{cl.label}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Score:</span>
              <span className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
                {lead.score ?? "—"}
              </span>
            </div>
          </div>

          {/* Contact info */}
          <div className="bg-muted/30 rounded-lg p-3.5 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</h3>
            {lead.decisor && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lead.decisor}</span>
              </div>
            )}
            {lead.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a
                  href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:text-primary transition-colors"
                >
                  {formatPhone(lead.telefone)}
                </a>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="hover:text-primary transition-colors">{lead.email}</a>
              </div>
            )}
            {lead.site && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={lead.site} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary transition-colors">
                  {lead.site}
                </a>
              </div>
            )}
            {lead.instagram && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">IG</span>
                <span>{lead.instagram}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Enrichment data */}
          {lead.enrichment_data && Object.keys(lead.enrichment_data).length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados Enriquecidos</h3>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                {Object.entries(lead.enrichment_data).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground text-xs capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs font-medium max-w-[200px] truncate">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lead.nicho && (
                <div>
                  <span className="text-xs text-muted-foreground block">Nicho</span>
                  <span className="font-medium">{lead.nicho}</span>
                </div>
              )}
              {lead.cidade && (
                <div>
                  <span className="text-xs text-muted-foreground block">Cidade</span>
                  <span className="font-medium">{lead.cidade}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground block">Origem</span>
                <span className="font-medium">{lead.origem || "—"}</span>
              </div>
              {lead.responsavel && (
                <div>
                  <span className="text-xs text-muted-foreground block">Responsável</span>
                  <span className="font-medium capitalize">{lead.responsavel}</span>
                </div>
              )}
              {lead.faturamento_estimado && (
                <div>
                  <span className="text-xs text-muted-foreground block">Faturamento</span>
                  <span className="font-medium">{lead.faturamento_estimado}</span>
                </div>
              )}
              {lead.script_usado && (
                <div>
                  <span className="text-xs text-muted-foreground block">Script</span>
                  <span className="font-medium uppercase">{lead.script_usado.replace("_", " ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{formatDate(lead.created_at)}</span>
              </div>
              {lead.data_abordagem && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abordado em</span>
                  <span>{formatDate(lead.data_abordagem)}</span>
                </div>
              )}
              {lead.data_ultima_interacao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última interação</span>
                  <span>{formatDate(lead.data_ultima_interacao)}</span>
                </div>
              )}
              {lead.data_proxima_acao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Próxima ação</span>
                  <span className="text-primary font-medium">{formatDate(lead.data_proxima_acao)}</span>
                </div>
              )}
              {lead.dia_cadencia != null && lead.dia_cadencia > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dia cadência</span>
                  <span>D{lead.dia_cadencia}</span>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          {lead.observacoes && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</h3>
              <p className="text-sm text-foreground/80 bg-muted/30 rounded-lg p-3 leading-relaxed">{lead.observacoes}</p>
            </div>
          )}

          {/* Resumo conversa */}
          {lead.resumo_conversa && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo da Conversa (IA)</h3>
              <p className="text-sm text-foreground/80 bg-primary/5 rounded-lg p-3 leading-relaxed border border-primary/10">
                {lead.resumo_conversa}
              </p>
            </div>
          )}

          {/* Handoff */}
          {lead.handoff_reason && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handoff</h3>
              <p className="text-sm bg-warning/10 rounded-lg p-3 border border-warning/20">{lead.handoff_reason}</p>
              {lead.handoff_at && <p className="text-xs text-muted-foreground">Em {formatDate(lead.handoff_at)}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
