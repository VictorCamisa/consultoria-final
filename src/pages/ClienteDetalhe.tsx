import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import ImersaoTab from "@/components/cliente/ImersaoTab";
import DiagnosticoTab from "@/components/cliente/DiagnosticoTab";
import DevolutivaTab from "@/components/cliente/DevolutivaTab";

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_clientes")
        .select("*")
        .eq("id", id!)
        .single();
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

  if (!cliente) {
    return <p className="text-muted-foreground">Cliente não encontrado.</p>;
  }

  const imersaoRealizada = ["imersao_realizada", "diagnostico_em_andamento", "devolutiva_agendada", "devolutiva_realizada", "convertido_recorrente"].includes(cliente.status);
  const diagnosticoConcluido = ["devolutiva_agendada", "devolutiva_realizada", "convertido_recorrente"].includes(cliente.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{cliente.nome_negocio}</h1>
        <Badge variant="outline">{cliente.nicho}</Badge>
        <Badge variant="outline">{cliente.cidade}</Badge>
      </div>

      <Tabs defaultValue="imersao">
        <TabsList>
          <TabsTrigger value="imersao">Imersão</TabsTrigger>
          <TabsTrigger value="diagnostico" disabled={!imersaoRealizada}>
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="devolutiva" disabled={!diagnosticoConcluido}>
            Devolutiva
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imersao" className="mt-4">
          <ImersaoTab clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="diagnostico" className="mt-4">
          {imersaoRealizada && <DiagnosticoTab clienteId={cliente.id} />}
        </TabsContent>
        <TabsContent value="devolutiva" className="mt-4">
          {diagnosticoConcluido && <DevolutivaTab clienteId={cliente.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
