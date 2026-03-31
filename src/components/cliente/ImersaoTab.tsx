import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Save, CheckCircle, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  clienteId: string;
}

export default function ImersaoTab({ clienteId }: Props) {
  const queryClient = useQueryClient();

  const { data: imersao, isLoading } = useQuery({
    queryKey: ["imersao", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_imersoes")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (imersao) setForm(imersao);
  }, [imersao]);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const countFilled = () => {
    const fields = [
      "nome_decisor", "canais_ativos", "quem_responde", "faturamento_estimado",
      "tempo_resposta_medio", "cobertura_fora_horario",
      "leads_mes_estimado", "taxa_conversao", "crm_ferramenta", "faz_followup",
      "redes_sociais", "trafego_pago_ativo", "sabe_medir_roi", "tem_lp_site",
      "google_meu_negocio", "google_avaliacoes", "equipe_total", "ferramentas_sistemas",
      "percentual_dono_operacao", "dor_principal_declarada", "observacoes_livres",
      "trafego_pago_valor",
    ];
    return fields.filter((f) => {
      const v = form[f];
      if (v === null || v === undefined || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
  };

  const filled = countFilled();
  const empty = 22 - filled;

  const saveMutation = useMutation({
    mutationFn: async (completa: boolean) => {
      const payload = {
        ...form,
        cliente_id: clienteId,
        completa,
        campos_vazios: empty,
      };
      if (imersao?.id) {
        const { error } = await supabase.from("consultoria_imersoes").update(payload).eq("id", imersao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultoria_imersoes").insert(payload);
        if (error) throw error;
      }
      if (completa) {
        await supabase.from("consultoria_clientes").update({ status: "imersao_realizada" }).eq("id", clienteId);
      }
    },
    onSuccess: (_, completa) => {
      queryClient.invalidateQueries({ queryKey: ["imersao", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      toast({ title: completa ? "Imersão concluída!" : "Rascunho salvo!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />;

  return (
    <div className="space-y-6">
      {/* Bloco 1 — Identificação */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bloco 1 — Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><Label>Nome do decisor</Label><Input value={form.nome_decisor ?? ""} onChange={(e) => set("nome_decisor", e.target.value)} /></div>
          <div><Label>Quem responde</Label><Input value={form.quem_responde ?? ""} onChange={(e) => set("quem_responde", e.target.value)} /></div>
          <div><Label>Faturamento estimado</Label><Input value={form.faturamento_estimado ?? ""} onChange={(e) => set("faturamento_estimado", e.target.value)} /></div>
          <div><Label>Canais ativos</Label><Input placeholder="WhatsApp, Instagram, Telefone..." value={(form.canais_ativos ?? []).join(", ")} onChange={(e) => set("canais_ativos", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} /></div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Atendimento */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bloco 2 — Atendimento e Canais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><Label>Tempo médio de resposta</Label><Input value={form.tempo_resposta_medio ?? ""} onChange={(e) => set("tempo_resposta_medio", e.target.value)} /></div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.cobertura_fora_horario ?? false} onCheckedChange={(v) => set("cobertura_fora_horario", v)} />
            <Label>Cobertura fora do horário</Label>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Processo Comercial */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bloco 3 — Processo Comercial</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><Label>Leads/mês estimado</Label><Input type="number" value={form.leads_mes_estimado ?? ""} onChange={(e) => set("leads_mes_estimado", Number(e.target.value) || null)} /></div>
          <div><Label>Taxa de conversão</Label><Input value={form.taxa_conversao ?? ""} onChange={(e) => set("taxa_conversao", e.target.value)} placeholder="Ex: 10% ou 'não sabe'" /></div>
          <div><Label>CRM / Ferramenta</Label><Input value={form.crm_ferramenta ?? ""} onChange={(e) => set("crm_ferramenta", e.target.value)} /></div>
          <div>
            <Label>Faz follow-up</Label>
            <Select value={form.faz_followup ?? ""} onValueChange={(v) => set("faz_followup", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="as_vezes">Às vezes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 4 — Marketing */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bloco 4 — Marketing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><Label>Redes sociais ativas</Label><Input placeholder="Instagram, Facebook, TikTok..." value={(form.redes_sociais ?? []).join(", ")} onChange={(e) => set("redes_sociais", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} /></div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.trafego_pago_ativo ?? false} onCheckedChange={(v) => set("trafego_pago_ativo", v)} />
            <Label>Tráfego pago ativo</Label>
          </div>
          {form.trafego_pago_ativo && (
            <div><Label>Valor tráfego pago (R$)</Label><Input type="number" value={form.trafego_pago_valor ?? ""} onChange={(e) => set("trafego_pago_valor", Number(e.target.value) || null)} /></div>
          )}
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.sabe_medir_roi ?? false} onCheckedChange={(v) => set("sabe_medir_roi", v)} />
            <Label>Sabe medir ROI</Label>
          </div>
          <div><Label>Tem LP ou site</Label><Input value={form.tem_lp_site ?? ""} onChange={(e) => set("tem_lp_site", e.target.value)} placeholder="URL ou texto" /></div>
        </CardContent>
      </Card>

      {/* Bloco 5 — Operação */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bloco 5 — Operação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch checked={form.google_meu_negocio ?? false} onCheckedChange={(v) => set("google_meu_negocio", v)} />
              <Label>Google Meu Negócio</Label>
            </div>
            {form.google_meu_negocio && (
              <div><Label>Avaliações Google</Label><Input type="number" value={form.google_avaliacoes ?? ""} onChange={(e) => set("google_avaliacoes", Number(e.target.value) || null)} /></div>
            )}
            <div><Label>Equipe total</Label><Input type="number" value={form.equipe_total ?? ""} onChange={(e) => set("equipe_total", Number(e.target.value) || null)} /></div>
            <div><Label>Ferramentas/sistemas</Label><Input placeholder="Planilha, CRM, ERP..." value={(form.ferramentas_sistemas ?? []).join(", ")} onChange={(e) => set("ferramentas_sistemas", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} /></div>
          </div>
          <div>
            <Label>% tempo do dono em operação: {form.percentual_dono_operacao ?? 0}%</Label>
            <Slider value={[form.percentual_dono_operacao ?? 0]} onValueChange={([v]) => set("percentual_dono_operacao", v)} max={100} step={5} className="mt-2" />
          </div>
          <div><Label>Dor principal declarada</Label><Textarea value={form.dor_principal_declarada ?? ""} onChange={(e) => set("dor_principal_declarada", e.target.value)} /></div>
          <div><Label>Observações livres</Label><Textarea value={form.observacoes_livres ?? ""} onChange={(e) => set("observacoes_livres", e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Rodapé */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={filled >= 17 ? "default" : "secondary"}>
              {filled} de 22 campos preenchidos
            </Badge>
            {empty > 5 && (
              <Alert className="py-2 px-3 border-warning">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-xs text-warning">
                  ⚠️ Sessão complementar necessária antes de avançar ({empty} campos vazios)
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>URL da gravação</Label><Input value={form.gravacao_url ?? ""} onChange={(e) => set("gravacao_url", e.target.value)} /></div>
            <div>
              <Label>Realizada por</Label>
              <Select value={form.realizada_por ?? ""} onValueChange={(v) => set("realizada_por", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="victor">Victor</SelectItem>
                  <SelectItem value="danilo">Danilo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />Salvar Rascunho
            </Button>
            <Button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending || filled < 17}>
              <CheckCircle className="h-4 w-4 mr-2" />Concluir Imersão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
