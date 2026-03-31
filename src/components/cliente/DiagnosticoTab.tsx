import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface Props {
  clienteId: string;
}

const PERGUNTAS: Record<string, { codigo: string; texto: string }[]> = {
  atendimento: [
    { codigo: "P01", texto: "O tempo de resposta ao lead é inferior a 5 minutos?" },
    { codigo: "P02", texto: "Existe atendimento fora do horário comercial?" },
    { codigo: "P03", texto: "O atendimento é feito por pessoa dedicada ou dono?" },
    { codigo: "P04", texto: "Há script padronizado de atendimento?" },
    { codigo: "P05", texto: "O atendimento usa WhatsApp Business com catálogo?" },
    { codigo: "P06", texto: "Existe processo de qualificação do lead?" },
    { codigo: "P07", texto: "O cliente recebe confirmação automática de agendamento?" },
    { codigo: "P08", texto: "Há controle de no-show e reagendamento?" },
  ],
  comercial: [
    { codigo: "P09", texto: "Existe um CRM ou ferramenta de gestão de leads?" },
    { codigo: "P10", texto: "O follow-up é feito de forma sistemática?" },
    { codigo: "P11", texto: "Há processo de reativação de base inativa?" },
    { codigo: "P12", texto: "O time comercial tem metas definidas?" },
    { codigo: "P13", texto: "Existe processo de upsell/cross-sell?" },
    { codigo: "P14", texto: "A taxa de conversão é medida e acompanhada?" },
    { codigo: "P15", texto: "Há treinamento recorrente do time comercial?" },
    { codigo: "P16", texto: "Existe script de objeções mapeado?" },
  ],
  marketing: [
    { codigo: "P17", texto: "Tem presença ativa em redes sociais?" },
    { codigo: "P18", texto: "Faz tráfego pago com estratégia definida?" },
    { codigo: "P19", texto: "Tem landing page otimizada para conversão?" },
    { codigo: "P20", texto: "Mede ROI das campanhas de marketing?" },
    { codigo: "P21", texto: "Tem estratégia de conteúdo/autoridade?" },
    { codigo: "P22", texto: "Google Meu Negócio otimizado e com avaliações?" },
    { codigo: "P23", texto: "Faz remarketing/retargeting?" },
    { codigo: "P24", texto: "Tem funil de nutrição de leads?" },
  ],
  operacao: [
    { codigo: "P25", texto: "O dono dedica menos de 30% do tempo em operação?" },
    { codigo: "P26", texto: "Os processos são documentados?" },
    { codigo: "P27", texto: "Usa ferramentas de automação?" },
    { codigo: "P28", texto: "Tem indicadores operacionais definidos?" },
    { codigo: "P29", texto: "A equipe é treinada com frequência?" },
    { codigo: "P30", texto: "Existe controle financeiro estruturado?" },
    { codigo: "P31", texto: "Há processos de qualidade/satisfação do cliente?" },
    { codigo: "P32", texto: "A tecnologia suporta o crescimento do negócio?" },
  ],
};

const DIMENSOES = [
  { key: "atendimento", label: "Atendimento", scoreField: "score_atendimento" },
  { key: "comercial", label: "Comercial", scoreField: "score_comercial" },
  { key: "marketing", label: "Marketing", scoreField: "score_marketing" },
  { key: "operacao", label: "Operação", scoreField: "score_operacao" },
];

const scoreColor = (score: number) => {
  if (score <= 3) return "bg-destructive text-destructive-foreground";
  if (score <= 5) return "bg-warning text-warning-foreground";
  if (score <= 7) return "bg-primary text-primary-foreground";
  return "bg-success text-success-foreground";
};

const scoreLabel = (score: number) => {
  if (score <= 3) return "Crítico";
  if (score <= 5) return "Alerta";
  if (score <= 7) return "Ok";
  return "Ótimo";
};

export default function DiagnosticoTab({ clienteId }: Props) {
  const queryClient = useQueryClient();

  const { data: diagnostico } = useQuery({
    queryKey: ["diagnostico", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_diagnosticos")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: notas } = useQuery({
    queryKey: ["notas-diagnostico", diagnostico?.id],
    enabled: !!diagnostico?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_notas_diagnostico")
        .select("*")
        .eq("diagnostico_id", diagnostico!.id);
      if (error) throw error;
      return data;
    },
  });

  const [notasLocal, setNotasLocal] = useState<Record<string, { nota: number; observacao: string }>>({});
  const [impacto, setImpacto] = useState({
    leads_perdidos: 0,
    base_inativa: 0,
    cancelamentos: 0,
    custo_oportunidade: 0,
  });
  const [arquitetura, setArquitetura] = useState<string[]>([]);
  const [mrrProposto, setMrrProposto] = useState<number>(0);
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    if (notas) {
      const map: Record<string, { nota: number; observacao: string }> = {};
      notas.forEach((n) => {
        map[n.pergunta_codigo] = { nota: n.nota, observacao: n.observacao ?? "" };
      });
      setNotasLocal(map);
    }
  }, [notas]);

  useEffect(() => {
    if (diagnostico) {
      setImpacto({
        leads_perdidos: Number(diagnostico.impacto_leads_perdidos) || 0,
        base_inativa: Number(diagnostico.impacto_base_inativa) || 0,
        cancelamentos: Number(diagnostico.impacto_cancelamentos) || 0,
        custo_oportunidade: Number(diagnostico.impacto_custo_oportunidade) || 0,
      });
      setMrrProposto(Number(diagnostico.mrr_proposto) || 0);
      setJustificativa(diagnostico.justificativa_arquitetura ?? "");
      setArquitetura(diagnostico.produtos_recomendados ?? []);
    }
  }, [diagnostico]);

  const scores = useMemo(() => {
    const result: Record<string, number> = {};
    DIMENSOES.forEach((dim) => {
      const perguntas = PERGUNTAS[dim.key];
      const totalPossivel = perguntas.length * 3;
      const totalObtido = perguntas.reduce((sum, p) => sum + (notasLocal[p.codigo]?.nota ?? 0), 0);
      result[dim.key] = totalPossivel > 0 ? Math.round((totalObtido / totalPossivel) * 10) : 0;
    });
    return result;
  }, [notasLocal]);

  const impactoTotal = impacto.leads_perdidos + impacto.base_inativa + impacto.cancelamentos + impacto.custo_oportunidade;

  const arquiteturaResult = useMemo(() => {
    if (arquitetura.includes("labs") && arquitetura.includes("escale")) return "HÍBRIDO";
    if (arquitetura.includes("labs")) return "LABS";
    return "ESCALE";
  }, [arquitetura]);

  const createOrUpdate = useMutation({
    mutationFn: async () => {
      const diagPayload = {
        cliente_id: clienteId,
        score_atendimento: scores.atendimento,
        score_comercial: scores.comercial,
        score_marketing: scores.marketing,
        score_operacao: scores.operacao,
        impacto_leads_perdidos: impacto.leads_perdidos,
        impacto_base_inativa: impacto.base_inativa,
        impacto_cancelamentos: impacto.cancelamentos,
        impacto_custo_oportunidade: impacto.custo_oportunidade,
        impacto_total: impactoTotal,
        arquitetura: arquiteturaResult,
        produtos_recomendados: arquitetura,
        mrr_proposto: mrrProposto,
        justificativa_arquitetura: justificativa,
      };

      let diagId = diagnostico?.id;
      if (diagId) {
        const { error } = await supabase.from("consultoria_diagnosticos").update(diagPayload).eq("id", diagId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("consultoria_diagnosticos").insert(diagPayload).select("id").single();
        if (error) throw error;
        diagId = data.id;
      }

      // Save notas
      for (const [codigo, { nota, observacao }] of Object.entries(notasLocal)) {
        const dimensao = Object.entries(PERGUNTAS).find(([_, ps]) => ps.some((p) => p.codigo === codigo))?.[0] ?? "";
        const existing = notas?.find((n) => n.pergunta_codigo === codigo);
        if (existing) {
          await supabase.from("consultoria_notas_diagnostico").update({ nota, observacao }).eq("id", existing.id);
        } else {
          await supabase.from("consultoria_notas_diagnostico").insert({
            diagnostico_id: diagId,
            pergunta_codigo: codigo,
            dimensao,
            nota,
            observacao,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diagnostico", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["notas-diagnostico"] });
      toast({ title: "Diagnóstico salvo!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const setNota = (codigo: string, nota: number) => {
    setNotasLocal((prev) => ({ ...prev, [codigo]: { ...prev[codigo], nota, observacao: prev[codigo]?.observacao ?? "" } }));
  };

  const setObs = (codigo: string, observacao: string) => {
    setNotasLocal((prev) => ({ ...prev, [codigo]: { ...prev[codigo], nota: prev[codigo]?.nota ?? 0, observacao } }));
  };

  return (
    <div className="space-y-6">
      {/* Seção 1 — Pontuação */}
      <Accordion type="multiple" defaultValue={DIMENSOES.map((d) => d.key)}>
        {DIMENSOES.map((dim) => (
          <AccordionItem key={dim.key} value={dim.key}>
            <AccordionTrigger className="text-base font-semibold">
              {dim.label} — <Badge className={`ml-2 ${scoreColor(scores[dim.key])}`}>{scores[dim.key]}/10 {scoreLabel(scores[dim.key])}</Badge>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {PERGUNTAS[dim.key].map((p) => (
                <div key={p.codigo} className="border border-border rounded-md p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono text-muted-foreground mr-2">{p.codigo}</span>
                      <span className="text-sm">{p.texto}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {[0, 1, 2, 3].map((n) => (
                        <Button
                          key={n}
                          size="sm"
                          variant={notasLocal[p.codigo]?.nota === n ? "default" : "outline"}
                          className="h-8 w-8 p-0"
                          onClick={() => setNota(p.codigo, n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Input
                    className="mt-2 text-xs"
                    placeholder="Observação (opcional)"
                    value={notasLocal[p.codigo]?.observacao ?? ""}
                    onChange={(e) => setObs(p.codigo, e.target.value)}
                  />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Seção 2 — Scoring / Mapa de Calor */}
      <Card>
        <CardHeader><CardTitle className="text-base">Mapa de Calor</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {DIMENSOES.map((dim) => (
              <div
                key={dim.key}
                className={`rounded-lg p-4 text-center ${scoreColor(scores[dim.key])}`}
              >
                <p className="text-sm font-medium">{dim.label}</p>
                <p className="text-2xl font-bold">{scores[dim.key]}/10</p>
                <p className="text-xs">{scoreLabel(scores[dim.key])}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Impacto Financeiro */}
      <Card>
        <CardHeader><CardTitle className="text-base">Impacto Financeiro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Leads perdidos (R$)</Label><Input type="number" value={impacto.leads_perdidos} onChange={(e) => setImpacto((p) => ({ ...p, leads_perdidos: Number(e.target.value) || 0 }))} /></div>
            <div><Label>Base inativa (R$)</Label><Input type="number" value={impacto.base_inativa} onChange={(e) => setImpacto((p) => ({ ...p, base_inativa: Number(e.target.value) || 0 }))} /></div>
            <div><Label>Cancelamentos evitáveis (R$)</Label><Input type="number" value={impacto.cancelamentos} onChange={(e) => setImpacto((p) => ({ ...p, cancelamentos: Number(e.target.value) || 0 }))} /></div>
            <div><Label>Custo de oportunidade do dono (R$)</Label><Input type="number" value={impacto.custo_oportunidade} onChange={(e) => setImpacto((p) => ({ ...p, custo_oportunidade: Number(e.target.value) || 0 }))} /></div>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Impacto total estimado</p>
            <p className="text-3xl font-bold text-destructive">R$ {impactoTotal.toLocaleString("pt-BR")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Arquitetura de Solução */}
      <Card>
        <CardHeader><CardTitle className="text-base">Arquitetura de Solução</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {[
              { id: "escale", label: "Cliente precisa de agente IA no WhatsApp? → VS Sales" },
              { id: "escale2", label: "Cliente precisa de gestão de conteúdo/postagem? → VS Marketing" },
              { id: "labs", label: "Tem processo específico que exige integração custom? → Labs" },
              { id: "labs2", label: "Volume/complexidade justifica desenvolvimento exclusivo? → Labs" },
            ].map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={arquitetura.includes(item.id)}
                  onCheckedChange={(checked) => {
                    setArquitetura((prev) =>
                      checked ? [...prev, item.id] : prev.filter((i) => i !== item.id)
                    );
                  }}
                />
                <Label className="text-sm">{item.label}</Label>
              </div>
            ))}
          </div>
          <Badge className={`text-lg px-4 py-2 ${arquiteturaResult === "LABS" ? "bg-destructive" : arquiteturaResult === "HÍBRIDO" ? "bg-warning" : "bg-success"}`}>
            {arquiteturaResult}
          </Badge>
          <div><Label>MRR proposto (R$)</Label><Input type="number" value={mrrProposto} onChange={(e) => setMrrProposto(Number(e.target.value) || 0)} /></div>
          <div><Label>Justificativa da arquitetura</Label><Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button onClick={() => createOrUpdate.mutate()} disabled={createOrUpdate.isPending} className="w-full">
        <Save className="h-4 w-4 mr-2" />Salvar Diagnóstico
      </Button>
    </div>
  );
}
