import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNichos } from "@/hooks/useNichos";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Pencil, Search, Users } from "lucide-react";
import { TableSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import ClienteModal from "@/components/cliente/ClienteModal";

const statusConfig: Record<string, { label: string; className: string }> = {
  aguardando_imersao:         { label: "Aguardando Imersão",       className: "bg-warning text-warning-foreground" },
  imersao_realizada:          { label: "Imersão Realizada",        className: "bg-primary text-primary-foreground" },
  diagnostico_em_andamento:   { label: "Diagnóstico em Andamento", className: "bg-primary text-primary-foreground" },
  devolutiva_agendada:        { label: "Devolutiva Agendada",      className: "bg-purple-500/80 text-white" },
  devolutiva_realizada:       { label: "Devolutiva Realizada",     className: "bg-success text-success-foreground" },
  convertido_recorrente:      { label: "Convertido Recorrente",    className: "bg-green-600 text-white" },
  encerrado:                  { label: "Encerrado",                className: "bg-muted text-muted-foreground" },
};

function HealthBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls =
    score >= 8 ? "bg-green-600 text-white" :
    score >= 5 ? "bg-warning text-warning-foreground" :
    "bg-destructive text-destructive-foreground";
  return <Badge className={`text-[10px] ${cls}`}>{score}/10</Badge>;
}

function CheckinBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const past = new Date(date) < new Date();
  return (
    <Badge className={`text-[10px] ${past ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
      {new Date(date).toLocaleDateString("pt-BR")}
    </Badge>
  );
}

const STATUSES = Object.keys(statusConfig);

export default function Clientes() {
  const { labels: NICHOS_CLIENTE } = useNichos();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterNicho, setFilterNicho] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");
  const [filterUpsell, setFilterUpsell] = useState("todos");

  const [modalOpen, setModalOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<Record<string, any> | null>(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!clientes) return [];
    return clientes.filter(c => {
      if (filterNicho !== "todos" && c.nicho !== filterNicho) return false;
      if (filterStatus !== "todos" && c.status !== filterStatus) return false;
      if (filterResponsavel !== "todos") {
        const r = (c as any).responsavel ?? c.responsavel_imersao;
        if (r !== filterResponsavel) return false;
      }
      if (filterUpsell !== "todos" && (c as any).potencial_upsell !== filterUpsell) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.nome_negocio.toLowerCase().includes(q) ||
          c.cidade.toLowerCase().includes(q) ||
          c.decisor.toLowerCase().includes(q) ||
          c.whatsapp.includes(q)
        );
      }
      return true;
    });
  }, [clientes, filterNicho, filterStatus, filterResponsavel, filterUpsell, searchQuery]);

  function openEdit(c: Record<string, any>) {
    setEditCliente(c);
    setModalOpen(true);
  }

  function openNew() {
    setEditCliente(null);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="vs-h1">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientes?.length ?? 0} clientes cadastrados
          </p>
        </div>
        <Button size="sm" onClick={openNew}>+ Novo Cliente</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card rounded-lg border border-border p-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-9 pl-8 text-sm bg-background" />
        </div>
        <Select value={filterNicho} onValueChange={setFilterNicho}>
          <SelectTrigger className="w-32 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos nichos</SelectItem>
            {NICHOS_CLIENTE.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
          <SelectTrigger className="w-32 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Responsável</SelectItem>
            <SelectItem value="victor">Victor</SelectItem>
            <SelectItem value="danilo">Danilo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterUpsell} onValueChange={setFilterUpsell}>
          <SelectTrigger className="w-32 h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Upsell</SelectItem>
            <SelectItem value="imediato">Imediato</SelectItem>
            <SelectItem value="alto">Alto</SelectItem>
            <SelectItem value="medio">Médio</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>
        {(searchQuery || filterNicho !== "todos" || filterStatus !== "todos" || filterResponsavel !== "todos" || filterUpsell !== "todos") && (
          <Badge variant="secondary" className="text-xs shrink-0">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</Badge>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={9} />
      ) : filtered.length === 0 ? (
        clientes?.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente cadastrado" description="Clientes são criados automaticamente ao fechar uma venda, ou manualmente com o botão acima." />
        ) : (
          <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste os filtros." actionLabel="Limpar" onAction={() => { setSearchQuery(""); setFilterNicho("todos"); setFilterStatus("todos"); setFilterResponsavel("todos"); setFilterUpsell("todos"); }} />
        )
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          {/* Mobile */}
          <div className="sm:hidden divide-y divide-border">
            {filtered.map((c) => {
              const sc = statusConfig[c.status] ?? { label: c.status, className: "bg-muted text-muted-foreground" };
              return (
                <div key={c.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                      <p className="text-sm font-semibold truncate">{c.nome_negocio}</p>
                      <p className="text-xs text-muted-foreground">{c.decisor} · {c.cidade}</p>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${sc.className}`}>{sc.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{c.nicho}</Badge>
                    <span className="text-xs text-foreground font-medium">R$ {Number(c.valor_fee).toLocaleString("pt-BR")}</span>
                    <HealthBadge score={(c as any).health_score ?? null} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => navigate(`/clientes/${c.id}`)}>
                      <Eye className="h-3 w-3 mr-1" />Ver
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openEdit(c)}>
                      <Pencil className="h-3 w-3 mr-1" />Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop */}
          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Upsell</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const sc = statusConfig[c.status] ?? { label: c.status, className: "bg-muted text-muted-foreground" };
                const responsavel = (c as any).responsavel ?? c.responsavel_imersao;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.nome_negocio}</p>
                        <p className="text-xs text-muted-foreground">{c.decisor} · {c.cidade}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{c.nicho}</Badge></TableCell>
                    <TableCell className="tabular text-sm">R$ {Number(c.valor_fee).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge className={`text-[10px] ${sc.className}`}>{sc.label}</Badge></TableCell>
                    <TableCell><HealthBadge score={(c as any).health_score ?? null} /></TableCell>
                    <TableCell><CheckinBadge date={(c as any).proximo_checkin ?? null} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{(c as any).potencial_upsell ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={responsavel === "victor" ? "secondary" : "default"} className="text-xs capitalize">
                        {responsavel === "victor" ? "Victor" : responsavel === "danilo" ? "Danilo" : responsavel ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/clientes/${c.id}`)}>
                          <Eye className="h-3 w-3 mr-1" />Ver
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(c)}>
                          <Pencil className="h-3 w-3 mr-1" />Editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ClienteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        cliente={editCliente}
        onSaved={(id) => { if (!editCliente) navigate(`/clientes/${id}`); }}
      />
    </div>
  );
}
