import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Search, Users } from "lucide-react";
import { TableSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import NewClientDialog from "@/components/cliente/NewClientDialog";

const statusConfig: Record<string, { label: string; className: string }> = {
  aguardando_imersao: { label: "Aguardando Imersão", className: "bg-warning text-warning-foreground" },
  imersao_realizada: { label: "Imersão Realizada", className: "bg-primary text-primary-foreground" },
  diagnostico_em_andamento: { label: "Diagnóstico em Andamento", className: "bg-primary text-primary-foreground" },
  devolutiva_agendada: { label: "Devolutiva Agendada", className: "bg-purple-500/80 text-white" },
  devolutiva_realizada: { label: "Devolutiva Realizada", className: "bg-success text-success-foreground" },
  convertido_recorrente: { label: "Convertido Recorrente", className: "bg-green-600 text-white" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
};

const NICHOS_CLIENTE = ["Estética", "Odonto", "Advocacia", "Revendas de Veículos", "Marketing", "Outro"];
const STATUSES = Object.keys(statusConfig);

export default function Clientes() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNicho, setFilterNicho] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

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
  }, [clientes, filterNicho, filterStatus, searchQuery]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="vs-h1">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientes?.length ?? 0} clientes cadastrados
          </p>
        </div>
        <NewClientDialog />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card rounded-lg border border-border p-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm bg-background"
          />
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
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || filterNicho !== "todos" || filterStatus !== "todos") && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : filtered.length === 0 ? (
        clientes?.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado"
            description="Clientes são criados automaticamente ao fechar uma venda na etapa de Devolutiva."
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Ajuste os filtros ou o termo de busca para encontrar clientes."
            actionLabel="Limpar filtros"
            onAction={() => { setSearchQuery(""); setFilterNicho("todos"); setFilterStatus("todos"); }}
          />
        )
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          {/* Mobile: card list */}
          <div className="sm:hidden divide-y divide-border">
            {filtered.map((c) => {
              const sc = statusConfig[c.status] ?? { label: c.status, className: "bg-muted text-muted-foreground" };
              return (
                <div key={c.id} className="p-3 space-y-2" onClick={() => navigate(`/clientes/${c.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{c.nome_negocio}</p>
                      <p className="text-xs text-muted-foreground">{c.decisor} · {c.cidade}</p>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${sc.className}`}>{sc.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{c.nicho}</Badge>
                    <span className="text-xs text-foreground font-medium">R$ {Number(c.valor_fee).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop: table */}
          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Imersão</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const sc = statusConfig[c.status] ?? { label: c.status, className: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome_negocio}</TableCell>
                    <TableCell><Badge variant="outline">{c.nicho}</Badge></TableCell>
                    <TableCell>{c.cidade}</TableCell>
                    <TableCell>R$ {Number(c.valor_fee).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(c as any).tipo_cobranca === "projeto_fechado" ? "Projeto" : "Fee"}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge className={sc.className}>{sc.label}</Badge></TableCell>
                    <TableCell>
                      {c.data_imersao ? new Date(c.data_imersao).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.responsavel_imersao === "victor" ? "secondary" : "default"}>
                        {c.responsavel_imersao === "victor" ? "Victor" : "Danilo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/clientes/${c.id}`)}>
                        <Eye className="h-4 w-4 mr-1" />Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
