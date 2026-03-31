import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Save, AlertOctagon, FileDown } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface Props {
  clienteId: string;
}

const CHECKLIST_ITEMS = [
  { key: "resumo_executivo", label: "Resumo executivo elaborado", critico: true },
  { key: "diagnostico_detalhado", label: "Diagnóstico detalhado por dimensão", critico: true },
  { key: "mapa_calor", label: "Mapa de calor incluído", critico: true },
  { key: "impacto_financeiro", label: "Impacto financeiro calculado", critico: true },
  { key: "arquitetura_solucao", label: "Arquitetura de solução definida", critico: true },
  { key: "proposta_mrr", label: "Proposta de MRR incluída", critico: true },
  { key: "cronograma", label: "Cronograma de implementação", critico: false },
  { key: "cases_sucesso", label: "Cases de sucesso anexados", critico: false },
  { key: "contrato_modelo", label: "Modelo de contrato preparado", critico: false },
  { key: "apresentacao", label: "Apresentação formatada", critico: false },
];

export default function DevolutivaTab({ clienteId }: Props) {
  const queryClient = useQueryClient();

  const { data: devolutiva } = useQuery({
    queryKey: ["devolutiva", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_devolutivas")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [resultado, setResultado] = useState("");
  const [mrrProposto, setMrrProposto] = useState(0);
  const [proximoPasso, setProximoPasso] = useState("");
  const [apresentadoPor, setApresentadoPor] = useState("");
  const [decisorPresente, setDecisorPresente] = useState(false);
  const [documentoRevisado, setDocumentoRevisado] = useState(false);
  const [dataDevolutiva, setDataDevolutiva] = useState("");

  useEffect(() => {
    if (devolutiva) {
      setChecklist((devolutiva.checklist as Record<string, boolean>) ?? {});
      setResultado(devolutiva.resultado ?? "");
      setMrrProposto(Number(devolutiva.proposta_mrr) || 0);
      setProximoPasso(devolutiva.proximo_passo ?? "");
      setApresentadoPor(devolutiva.apresentado_por ?? "");
      setDecisorPresente(devolutiva.decisor_presente ?? false);
      setDocumentoRevisado(devolutiva.documento_revisado ?? false);
      setDataDevolutiva(devolutiva.data_devolutiva ? new Date(devolutiva.data_devolutiva).toISOString().slice(0, 16) : "");
    }
  }, [devolutiva]);

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const criticosPendentes = CHECKLIST_ITEMS.filter((i) => i.critico && !checklist[i.key]);
  const allComplete = completedCount === totalCount;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente_id: clienteId,
        checklist,
        checklist_completo: allComplete,
        resultado: resultado || null,
        proposta_mrr: mrrProposto || null,
        proximo_passo: proximoPasso || null,
        apresentado_por: apresentadoPor || null,
        decisor_presente: decisorPresente,
        documento_revisado: documentoRevisado,
        data_devolutiva: dataDevolutiva ? new Date(dataDevolutiva).toISOString() : null,
        itens_criticos_pendentes: criticosPendentes.map((i) => i.key),
      };

      if (devolutiva?.id) {
        const { error } = await supabase.from("consultoria_devolutivas").update(payload).eq("id", devolutiva.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultoria_devolutivas").insert(payload);
        if (error) throw error;
      }

      // If resultado === "fechou", create acompanhamento entries
      if (resultado === "fechou") {
        const now = new Date();
        const tipos = [
          { tipo: "7d", dias: 7 },
          { tipo: "30d", dias: 30 },
          { tipo: "90d", dias: 90 },
        ];
        for (const t of tipos) {
          const agendado = new Date(now.getTime() + t.dias * 24 * 60 * 60 * 1000);
          await supabase.from("consultoria_acompanhamentos").insert({
            cliente_id: clienteId,
            tipo: t.tipo,
            agendado_para: agendado.toISOString(),
            responsavel: "danilo",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devolutiva", clienteId] });
      toast({ title: "Devolutiva salva!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Seção 1 — Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Checklist de Entrega
            <Badge variant={allComplete ? "default" : "secondary"}>
              {completedCount} de {totalCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} className="h-2" />
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <Checkbox
                checked={checklist[item.key] ?? false}
                onCheckedChange={(checked) =>
                  setChecklist((prev) => ({ ...prev, [item.key]: !!checked }))
                }
              />
              <span className="text-sm">{item.label}</span>
              {item.critico && <Badge variant="destructive" className="text-xs">CRÍTICO</Badge>}
            </div>
          ))}
          {criticosPendentes.length > 0 && (
            <Alert className="border-destructive">
              <AlertOctagon className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-xs text-destructive">
                ⛔ Não é possível gerar o documento com itens críticos pendentes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Seção 2 — Documento */}
      <Card>
        <CardHeader><CardTitle className="text-base">Gerar Documento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button disabled={!allComplete} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />Gerar Devolutiva DOCX
          </Button>
          <p className="text-xs text-muted-foreground">
            {allComplete ? "Checklist completo — pronto para gerar." : "Complete o checklist primeiro."}
          </p>
          <div className="flex items-center gap-2">
            <Switch checked={documentoRevisado} onCheckedChange={setDocumentoRevisado} />
            <Label>Documento revisado ✓</Label>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Reunião */}
      <Card>
        <CardHeader><CardTitle className="text-base">Reunião de Devolutiva</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" value={dataDevolutiva} onChange={(e) => setDataDevolutiva(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={decisorPresente} onCheckedChange={setDecisorPresente} />
            <Label>Decisor presente</Label>
          </div>
          <div>
            <Label>Apresentado por</Label>
            <Select value={apresentadoPor} onValueChange={setApresentadoPor}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="victor">Victor</SelectItem>
                <SelectItem value="danilo">Danilo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Resultado */}
      <Card>
        <CardHeader><CardTitle className="text-base">Resultado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fechou">Fechou na hora</SelectItem>
                <SelectItem value="pediu_tempo">Pediu tempo</SelectItem>
                <SelectItem value="recusou">Recusou</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>MRR proposto (R$)</Label><Input type="number" value={mrrProposto} onChange={(e) => setMrrProposto(Number(e.target.value) || 0)} /></div>
          <div><Label>Próximo passo</Label><Textarea value={proximoPasso} onChange={(e) => setProximoPasso(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        <Save className="h-4 w-4 mr-2" />Salvar Devolutiva
      </Button>
    </div>
  );
}
