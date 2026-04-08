import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CalendarCheck } from "lucide-react";

export default function Acompanhamento() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pendente");
  const [checkinId, setCheckinId] = useState<string | null>(null);

  const { data: acompanhamentos, isLoading } = useQuery({
    queryKey: ["acompanhamentos", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("consultoria_acompanhamentos")
        .select("*, consultoria_clientes(nome_negocio)")
        .order("agendado_para", { ascending: true });
      if (filterStatus !== "todos") {
        q = q.eq("status", filterStatus);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const registrarCheckin = useMutation({
    mutationFn: async ({ id, observacoes, oportunidade_upsell }: { id: string; observacoes: string; oportunidade_upsell: boolean }) => {
      const { error } = await supabase
        .from("consultoria_acompanhamentos")
        .update({
          status: "realizado",
          realizado_em: new Date().toISOString(),
          observacoes,
          oportunidade_upsell,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acompanhamentos"] });
      setCheckinId(null);
      toast({ title: "Check-in registrado!" });
    },
  });

  const handleCheckin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    registrarCheckin.mutate({
      id: checkinId!,
      observacoes: fd.get("observacoes") as string,
      oportunidade_upsell: fd.get("upsell") === "on",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Acompanhamento</h1>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="realizado">Realizado</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {acompanhamentos?.length === 0 && (
            <p className="text-muted-foreground col-span-full">Nenhum acompanhamento encontrado.</p>
          )}
          {acompanhamentos?.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">
                      {(a as any).consultoria_clientes?.nome_negocio ?? "Cliente"}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">{a.tipo}</Badge>
                  </div>
                  <Badge variant={a.status === "pendente" ? "default" : "secondary"}>
                    {a.status === "pendente" ? "Pendente" : "Realizado"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Agendado: {new Date(a.agendado_para).toLocaleDateString("pt-BR")}
                </p>
                <Badge variant={a.responsavel === "victor" ? "secondary" : "default"} className="text-xs">
                  {a.responsavel === "victor" ? "Victor" : "Danilo"}
                </Badge>
                {a.status === "pendente" && (
                  <Button size="sm" className="w-full mt-2" onClick={() => setCheckinId(a.id)}>
                    <CalendarCheck className="h-4 w-4 mr-1" />Registrar Check-in
                  </Button>
                )}
                {a.observacoes && (
                  <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{a.observacoes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!checkinId} onOpenChange={() => setCheckinId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Check-in</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckin} className="space-y-4">
            <div>
              <Label>Observações</Label>
              <Textarea name="observacoes" placeholder="Métricas e observações..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch name="upsell" id="upsell" />
              <Label htmlFor="upsell">Oportunidade de upsell identificada</Label>
            </div>
            <Button type="submit" className="w-full" disabled={registrarCheckin.isPending}>
              Registrar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
