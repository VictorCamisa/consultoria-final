import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Prospect = Tables<"consultoria_prospects">;

/* ── Status config ────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Eye },
  abordado: { label: "Abordado", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Phone },
  respondeu: { label: "Respondeu", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: TrendingUp },
  qualificado: { label: "Qualificado", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Flame },
  fechado: { label: "Fechado", color: "bg-green-100 text-green-800 border-green-200", icon: TrendingUp },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700 border-red-200", icon: X },
  follow_up: { label: "Follow-up", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: Calendar },
};

const CLASSIFICACAO_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  quente: { label: "Quente", icon: Flame, color: "text-red-500" },
  morno: { label: "Morno", icon: Thermometer, color: "text-amber-500" },
  frio: { label: "Frio", icon: Snowflake, color: "text-blue-400" },
};

type SortField = "created_at" | "score_qualificacao" | "nome_negocio" | "data_ultima_interacao";
type ViewMode = "grid" | "list";

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [nichoFilter, setNichoFilter] = useState<string>("todos");
  const [cidadeFilter, setCidadeFilter] = useState<string>("todos");
  const [origemFilter, setOrigemFilter] = useState<string>("todos");
  const [classificacaoFilter, setClassificacaoFilter] = useState<string>("todos");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Prospect | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["all-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_prospects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
  });

  /* ── Derived filter options ────────────────────── */
  const filterOptions = useMemo(() => {
    const nichos = new Set<string>();
    const cidades = new Set<string>();
    const origens = new Set<string>();
    leads.forEach((l) => {
      if (l.nicho) nichos.add(l.nicho);
      if (l.cidade) cidades.add(l.cidade);
      if (l.origem) origens.add(l.origem);
    });
    return {
      nichos: Array.from(nichos).sort(),
      cidades: Array.from(cidades).sort(),
      origens: Array.from(origens).sort(),
    };
  }, [leads]);

  /* ── Filtering + sorting ───────────────────────── */
  const filtered = useMemo(() => {
    let result = [...leads];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.nome_negocio.toLowerCase().includes(q) ||
          l.decisor?.toLowerCase().includes(q) ||
          l.whatsapp?.includes(q) ||
          l.cidade?.toLowerCase().includes(q) ||
          l.nicho?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "todos") result = result.filter((l) => l.status === statusFilter);
    if (nichoFilter !== "todos") result = result.filter((l) => l.nicho === nichoFilter);
    if (cidadeFilter !== "todos") result = result.filter((l) => l.cidade === cidadeFilter);
    if (origemFilter !== "todos") result = result.filter((l) => l.origem === origemFilter);
    if (classificacaoFilter !== "todos") result = result.filter((l) => l.classificacao_ia === classificacaoFilter);

    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "score_qualificacao":
          valA = a.score_qualificacao ?? 0;
          valB = b.score_qualificacao ?? 0;
          break;
        case "nome_negocio":
          valA = a.nome_negocio.toLowerCase();
          valB = b.nome_negocio.toLowerCase();
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
  }, [leads, search, statusFilter, nichoFilter, cidadeFilter, origemFilter, classificacaoFilter, sortField, sortAsc]);

  /* ── Stats ─────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = leads.length;
    const byStatus: Record<string, number> = {};
    let withScore = 0;
    let scoreSum = 0;
    leads.forEach((l) => {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
      if (l.score_qualificacao != null) {
        withScore++;
        scoreSum += l.score_qualificacao;
      }
    });
    return { total, byStatus, avgScore: withScore > 0 ? Math.round(scoreSum / withScore) : 0 };
  }, [leads]);

  const activeFiltersCount = [statusFilter, nichoFilter, cidadeFilter, origemFilter, classificacaoFilter].filter(
    (f) => f !== "todos"
  ).length;

  const clearFilters = () => {
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

  const formatPhone = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    return phone;
  };

  const getScoreColor = (score: number | null) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getNichoShort = (nicho: string) => {
    if (nicho.length <= 30) return nicho;
    return nicho.split(",")[0].trim().slice(0, 28) + "…";
  };

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="vs-h1 flex items-center gap-2.5">
            <Users2 className="h-6 w-6 text-primary" />
            Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize e gerencie todos os leads prospectados
          </p>
        </div>
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
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total de Leads", value: stats.total, color: "text-primary" },
          { label: "Novos", value: stats.byStatus["novo"] || 0, color: "text-blue-600" },
          { label: "Abordados", value: stats.byStatus["abordado"] || 0, color: "text-amber-600" },
          { label: "Responderam", value: stats.byStatus["respondeu"] || 0, color: "text-emerald-600" },
          { label: "Score Médio", value: stats.avgScore, color: "text-purple-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-lg p-3.5 text-center">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, decisor, WhatsApp, cidade ou nicho…"
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

        {/* Sort */}
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Data de criação</SelectItem>
            <SelectItem value="score_qualificacao">Score ICP</SelectItem>
            <SelectItem value="nome_negocio">Nome A-Z</SelectItem>
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
          {filtered.length} de {leads.length} leads
        </span>
      </div>

      {/* ── Filters panel ── */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-5 gap-3 bg-card border border-border rounded-lg p-4">
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
                    <SelectItem key={o} value={o}>{o === "prospeccao_web" ? "Web" : o === "manual" ? "Manual" : o}</SelectItem>
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
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              formatDate={formatDate}
              formatPhone={formatPhone}
              getScoreColor={getScoreColor}
              getNichoShort={getNichoShort}
              onSelect={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
              isSelected={selectedLead?.id === lead.id}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Empresa</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Nicho</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Cidade</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">WhatsApp</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Score</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">IA</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const st = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-muted text-muted-foreground border-border" };
                const cl = lead.classificacao_ia ? CLASSIFICACAO_MAP[lead.classificacao_ia] : null;
                return (
                  <tr
                    key={lead.id}
                    className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                  >
                    <td className="p-3">
                      <p className="font-semibold text-foreground truncate max-w-[200px]">{lead.nome_negocio}</p>
                      {lead.decisor && <p className="text-xs text-muted-foreground">{lead.decisor}</p>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">{getNichoShort(lead.nicho)}</td>
                    <td className="p-3 text-xs">{lead.cidade}</td>
                    <td className="p-3 text-xs font-mono">{formatPhone(lead.whatsapp)}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold text-sm ${getScoreColor(lead.score_qualificacao)}`}>
                        {lead.score_qualificacao ?? "—"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      {cl ? <cl.icon className={`h-4 w-4 mx-auto ${cl.color}`} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail slide ── */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          formatDate={formatDate}
          formatPhone={formatPhone}
          getScoreColor={getScoreColor}
        />
      )}
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
  onSelect,
  isSelected,
}: {
  lead: Prospect;
  formatDate: (d: string | null) => string;
  formatPhone: (p: string) => string;
  getScoreColor: (s: number | null) => string;
  getNichoShort: (n: string) => string;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const st = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-muted text-muted-foreground border-border", icon: Eye };
  const cl = lead.classificacao_ia ? CLASSIFICACAO_MAP[lead.classificacao_ia] : null;

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
            {lead.nome_negocio}
          </h3>
          {lead.decisor && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.decisor}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {cl && <cl.icon className={`h-3.5 w-3.5 ${cl.color}`} />}
          <Badge variant="outline" className={`text-[10px] leading-none ${st.color}`}>
            {st.label}
          </Badge>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Tag className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{getNichoShort(lead.nicho)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span>{lead.cidade}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span className="font-mono text-[11px]">{formatPhone(lead.whatsapp)}</span>
        </div>
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
          <span className={`font-bold text-sm ${getScoreColor(lead.score_qualificacao)}`}>
            {lead.score_qualificacao ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {lead.origem === "prospeccao_web" ? (
            <Badge variant="secondary" className="text-[9px] py-0 px-1.5">Web</Badge>
          ) : (
            <Badge variant="secondary" className="text-[9px] py-0 px-1.5">Manual</Badge>
          )}
          <span>{formatDate(lead.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Lead Detail Panel ───────────────────────────── */
function LeadDetailPanel({
  lead,
  onClose,
  formatDate,
  formatPhone,
  getScoreColor,
}: {
  lead: Prospect;
  onClose: () => void;
  formatDate: (d: string | null) => string;
  formatPhone: (p: string) => string;
  getScoreColor: (s: number | null) => string;
}) {
  const st = STATUS_MAP[lead.status] || { label: lead.status, color: "bg-muted text-muted-foreground border-border" };
  const cl = lead.classificacao_ia ? CLASSIFICACAO_MAP[lead.classificacao_ia] : null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-10 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2
          className="text-lg font-bold text-foreground truncate"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {lead.nome_negocio}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
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
              <span className="text-xs text-muted-foreground">Score ICP:</span>
              <span className={`text-lg font-bold ${getScoreColor(lead.score_qualificacao)}`}>
                {lead.score_qualificacao ?? "—"}
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
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <a
                href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-primary transition-colors"
              >
                {formatPhone(lead.whatsapp)}
              </a>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
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

          {/* Details */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Nicho</span>
                <span className="font-medium">{lead.nicho}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Cidade</span>
                <span className="font-medium">{lead.cidade}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Origem</span>
                <span className="font-medium">{lead.origem === "prospeccao_web" ? "Prospecção Web" : lead.origem || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Responsável</span>
                <span className="font-medium capitalize">{lead.responsavel}</span>
              </div>
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
      </ScrollArea>
    </div>
  );
}
