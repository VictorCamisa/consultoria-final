import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  aguardando_imersao: { label: "Aguardando Imersão", className: "bg-warning text-warning-foreground" },
  imersao_realizada: { label: "Imersão Realizada", className: "bg-primary text-primary-foreground" },
  diagnostico_em_andamento: { label: "Diagnóstico em Andamento", className: "bg-primary text-primary-foreground" },
  devolutiva_agendada: { label: "Devolutiva Agendada", className: "bg-purple-600 text-white" },
  devolutiva_realizada: { label: "Devolutiva Realizada", className: "bg-success text-success-foreground" },
  convertido_recorrente: { label: "Convertido Recorrente", className: "bg-green-800 text-white" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
};

export default function Clientes() {
  const navigate = useNavigate();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <div className="bg-card rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Nicho</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Valor Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Imersão</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum cliente cadastrado.
                </TableCell>
              </TableRow>
            )}
            {clientes?.map((c) => {
              const sc = statusConfig[c.status] ?? { label: c.status, className: "bg-muted text-muted-foreground" };
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome_negocio}</TableCell>
                  <TableCell><Badge variant="outline">{c.nicho}</Badge></TableCell>
                  <TableCell>{c.cidade}</TableCell>
                  <TableCell>R$ {Number(c.valor_fee).toLocaleString("pt-BR")}</TableCell>
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
    </div>
  );
}
