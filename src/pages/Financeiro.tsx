import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, AlertTriangle, Eye, CalendarCheck } from "lucide-react";
import { TableSkeleton } from "@/components/PageSkeleton";

const ATIVOS = ["imersao_realizada", "diagnostico_em_andamento", "devolutiva_agendada", "devolutiva_realizada", "convertido_recorrente"];

const statusLabel: Record<string, string> = {
  aguardando_imersao:       "Aguardando Imersão",
  imersao_realizada:        "Imersão Realizada",
  diagnostico_em_andamento: "Diagnóstico em Andamento",
  devolutiva_agendada:      "Devolutiva Agendada",
  devolutiva_realizada:     "Devolutiva Realizada",
  convertido_recorrente:    "Recorrente",
  encerrado:                "Encerrado",
};

const statusColor: Record<string, string> = {
  aguardando_imersao:       "bg-warning/20 text-warning-foreground border-warning/30",
  imersao_realizada:        "bg-primary/20 text-primary border-primary/30",
  diagnostico_em_andamento: "bg-primary/20 text-primary border-primary/30",
  devolutiva_agendada:      "bg-purple-500/20 text-purple-300 border-purple-500/30",
  devolutiva_realizada:     "bg-success/20 text-success border-success/30",
  convertido_recorrente:    "bg-green-600/20 text-green-400 border-green-600/30",
  encerrado:                "bg-muted/50 text-muted-foreground border-muted",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function KPICard({ title, value, sub, icon: Icon, accent = false }: {
  title: string; value: string; sub: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 tabular ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg ${accent ? "bg-primary/20" : "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Financeiro() {
  const navigate = useNavigate();

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["financeiro-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_clientes")
        .select("id,nome_negocio,status,valor_fee,proximo_checkin,responsavel_imersao,nicho,data_inicio")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!clientes) return null;
    const ativos = clientes.filter(c => ATIVOS.includes(c.status));
    const recorrentes = clientes.filter(c => c.status === "convertido_recorrente");
    const encerrados = clientes.filter(c => c.status === "encerrado");
    const mrr = ativos.reduce((s, c) => s + Number(c.valor_fee ?? 0), 0);
    const mrrRecorrente = recorrentes.reduce((s, c) => s + Number(c.valor_fee ?? 0), 0);
    const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0;
    const checkinVencidos = ativos.filter(c => {
      if (!(c as any).proximo_checkin) return false;
      return new Date((c as any).proximo_checkin) < new Date();
    }).length;
    return { ativos, recorrentes, encerrados, mrr, mrrRecorrente, ticketMedio, checkinVencidos, total: clientes.length };
  }, [clientes]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="vs-h1">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão financeira da base de clientes</p>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : stats ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              icon={DollarSign}
              title="MRR Total"
              value={fmt(stats.mrr)}
              sub={`${stats.ativos.length} clientes ativos`}
              accent
            />
            <KPICard
              icon={TrendingUp}
              title="MRR Recorrente"
              value={fmt(stats.mrrRecorrente)}
              sub={`${stats.recorrentes.length} convertidos`}
            />
            <KPICard
              icon={Users}
              title="Ticket Médio"
              value={fmt(stats.ticketMedio)}
              sub="por cliente ativo"
            />
            <KPICard
              icon={AlertTriangle}
              title="Check-ins Vencidos"
              value={String(stats.checkinVencidos)}
              sub="requerem atenção"
            />
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Object.entries(statusLabel).map(([key, label]) => {
              const count = clientes!.filter(c => c.status === key).length;
              const revenue = clientes!.filter(c => c.status === key).reduce((s, c) => s + Number(c.valor_fee ?? 0), 0);
              return (
                <div key={key} className="bg-card border border-border rounded-lg p-3 space-y-1">
                  <Badge className={`text-[9px] px-1.5 ${statusColor[key] ?? "bg-muted text-muted-foreground"}`}>{label}</Badge>
                  <p className="text-lg font-bold tabular">{count}</p>
                  {revenue > 0 && <p className="text-[10px] text-muted-foreground tabular">{fmt(revenue)}</p>}
                </div>
              );
            })}
          </div>

          {/* Client table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clientes Ativos — Receita Detalhada</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fee/mês</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Próx. Check-in</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.ativos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                          Nenhum cliente ativo ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.ativos.map(c => {
                        const checkinPast = (c as any).proximo_checkin
                          ? new Date((c as any).proximo_checkin) < new Date()
                          : false;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{c.nome_negocio}</p>
                                <p className="text-xs text-muted-foreground">{c.nicho}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${statusColor[c.status] ?? ""}`}>
                                {statusLabel[c.status] ?? c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="tabular font-semibold text-sm text-primary">
                              {fmt(Number(c.valor_fee ?? 0))}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {c.data_inicio
                                ? new Date(c.data_inicio).toLocaleDateString("pt-BR")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {(c as any).proximo_checkin ? (
                                <div className="flex items-center gap-1.5">
                                  {checkinPast && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                                  <span className={`text-xs ${checkinPast ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    {new Date((c as any).proximo_checkin).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {(c as any).responsavel ?? c.responsavel_imersao ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/clientes/${c.id}`)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Encerrados */}
          {stats.encerrados.length > 0 && (
            <Card className="border-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  Encerrados ({stats.encerrados.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {stats.encerrados.map(c => (
                        <TableRow key={c.id} className="opacity-60">
                          <TableCell className="text-sm">{c.nome_negocio}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.nicho}</TableCell>
                          <TableCell className="tabular text-sm">{fmt(Number(c.valor_fee ?? 0))}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/clientes/${c.id}`)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
