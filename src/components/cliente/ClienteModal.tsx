import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useNichos } from "@/hooks/useNichos";
import { Loader2, Save } from "lucide-react";

type ClienteRow = Record<string, any>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: ClienteRow | null;
  /** Called after successful save with the saved record id */
  onSaved?: (id: string) => void;
}

const PRODUTOS = [
  { value: "sales", label: "VS Sales" },
  { value: "marketing", label: "VS Marketing" },
  { value: "departamentos", label: "VS Departamentos" },
  { value: "360", label: "VS 360" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_CICLO = [
  { value: "aguardando_imersao", label: "Aguardando Imersão" },
  { value: "imersao_realizada", label: "Imersão Realizada" },
  { value: "diagnostico_em_andamento", label: "Diagnóstico em Andamento" },
  { value: "devolutiva_agendada", label: "Devolutiva Agendada" },
  { value: "devolutiva_realizada", label: "Devolutiva Realizada" },
  { value: "convertido_recorrente", label: "Convertido Recorrente" },
  { value: "encerrado", label: "Encerrado" },
];

const UPSELL = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Médio" },
  { value: "alto", label: "Alto" },
  { value: "imediato", label: "Imediato" },
];

function toDateInput(iso?: string | null) {
  if (!iso) return "";
  return iso.split("T")[0];
}

function fromDateInput(s: string) {
  if (!s) return null;
  return new Date(s).toISOString();
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ClienteModal({ open, onOpenChange, cliente, onSaved }: Props) {
  const { labels: NICHOS } = useNichos();
  const queryClient = useQueryClient();
  const isEdit = !!cliente?.id;

  const blank = {
    // Tab 1
    nome_negocio: "", decisor: "", whatsapp: "", email: "", site: "",
    instagram: "", cidade: "", nicho: "Estética", segmento: "",
    // Tab 2
    produto_vs: "departamentos", valor_fee: "", tipo_cobranca: "fee_mensal",
    data_fechamento: "", data_inicio: "", data_prev_entrega: "", obs_contrato: "",
    // Tab 3
    descricao_negocio: "", dores_mapeadas: "", sistemas_atuais: "",
    equipe_info: "", faturamento_est: "", historico: "",
    // Tab 4
    status: "aguardando_imersao", responsavel: "victor",
    health_score: 5, proximo_checkin: "", obs_internas: "",
    // Tab 5
    resultados: "", metricas_antes_depois: "", depoimento: "",
    nps: 8, potencial_upsell: "medio",
  };

  const [form, setForm] = useState<typeof blank>(blank);

  useEffect(() => {
    if (!open) return;
    if (cliente) {
      setForm({
        nome_negocio: cliente.nome_negocio ?? "",
        decisor: cliente.decisor ?? "",
        whatsapp: cliente.whatsapp ?? "",
        email: cliente.email ?? "",
        site: cliente.site ?? "",
        instagram: cliente.instagram ?? "",
        cidade: cliente.cidade ?? "",
        nicho: cliente.nicho ?? "Estética",
        segmento: cliente.segmento ?? "",
        produto_vs: cliente.produto_vs ?? "departamentos",
        valor_fee: String(cliente.valor_fee ?? ""),
        tipo_cobranca: cliente.tipo_cobranca ?? "fee_mensal",
        data_fechamento: toDateInput(cliente.data_fechamento),
        data_inicio: toDateInput(cliente.data_inicio),
        data_prev_entrega: toDateInput(cliente.data_prev_entrega),
        obs_contrato: cliente.obs_contrato ?? "",
        descricao_negocio: cliente.descricao_negocio ?? "",
        dores_mapeadas: cliente.dores_mapeadas ?? "",
        sistemas_atuais: cliente.sistemas_atuais ?? "",
        equipe_info: cliente.equipe_info ?? "",
        faturamento_est: cliente.faturamento_est ?? cliente.faturamento_estimado ?? "",
        historico: cliente.historico ?? "",
        status: cliente.status ?? "aguardando_imersao",
        responsavel: cliente.responsavel ?? cliente.responsavel_imersao ?? "victor",
        health_score: cliente.health_score ?? 5,
        proximo_checkin: toDateInput(cliente.proximo_checkin),
        obs_internas: cliente.obs_internas ?? "",
        resultados: cliente.resultados ?? "",
        metricas_antes_depois: cliente.metricas_antes_depois ?? "",
        depoimento: cliente.depoimento ?? "",
        nps: cliente.nps ?? 8,
        potencial_upsell: cliente.potencial_upsell ?? "medio",
      });
    } else {
      setForm({ ...blank, data_fechamento: toDateInput(new Date().toISOString()) });
    }
  }, [open, cliente?.id]);

  const set = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome_negocio: form.nome_negocio.trim(),
        decisor: form.decisor.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim() || null,
        site: form.site.trim() || null,
        instagram: form.instagram.trim() || null,
        cidade: form.cidade.trim(),
        nicho: form.nicho,
        produto_vs: form.produto_vs,
        valor_fee: Number(form.valor_fee) || 0,
        tipo_cobranca: form.tipo_cobranca,
        data_fechamento: fromDateInput(form.data_fechamento) ?? new Date().toISOString(),
        data_inicio: fromDateInput(form.data_inicio),
        data_prev_entrega: fromDateInput(form.data_prev_entrega),
        obs_contrato: form.obs_contrato || null,
        descricao_negocio: form.descricao_negocio || null,
        dores_mapeadas: form.dores_mapeadas || null,
        sistemas_atuais: form.sistemas_atuais || null,
        equipe_info: form.equipe_info || null,
        faturamento_est: form.faturamento_est || null,
        historico: form.historico || null,
        status: form.status,
        responsavel: form.responsavel,
        responsavel_imersao: form.responsavel,
        health_score: form.health_score,
        proximo_checkin: fromDateInput(form.proximo_checkin),
        obs_internas: form.obs_internas || null,
        resultados: form.resultados || null,
        metricas_antes_depois: form.metricas_antes_depois || null,
        depoimento: form.depoimento || null,
        nps: form.nps,
        potencial_upsell: form.potencial_upsell,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("consultoria_clientes")
          .update(payload)
          .eq("id", cliente!.id);
        if (error) throw error;
        return cliente!.id as string;
      } else {
        const { data, error } = await supabase
          .from("consultoria_clientes")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Cliente atualizado!" : "Cliente criado!");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar cliente."),
  });

  const canSave =
    form.nome_negocio.trim() &&
    form.decisor.trim() &&
    form.whatsapp.trim() &&
    form.cidade.trim() &&
    form.valor_fee;

  const ta = "min-h-[80px] resize-y text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar — ${cliente?.nome_negocio}` : "Novo Cliente"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="identificacao" className="mt-2">
          <TabsList className="grid grid-cols-5 h-8 text-xs">
            <TabsTrigger value="identificacao" className="text-[11px]">Identificação</TabsTrigger>
            <TabsTrigger value="contrato" className="text-[11px]">Contrato</TabsTrigger>
            <TabsTrigger value="contexto" className="text-[11px]">Contexto</TabsTrigger>
            <TabsTrigger value="status" className="text-[11px]">Status</TabsTrigger>
            <TabsTrigger value="resultados" className="text-[11px]">Resultados</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Identificação ── */}
          <TabsContent value="identificacao" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do Negócio" required>
                <Input value={form.nome_negocio} onChange={e => set("nome_negocio", e.target.value)} placeholder="Ex: Clínica Beleza Pura" />
              </Field>
              <Field label="Decisor" required>
                <Input value={form.decisor} onChange={e => set("decisor", e.target.value)} placeholder="Nome + Cargo" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp" required>
                <Input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="5512999999999" />
              </Field>
              <Field label="E-mail">
                <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="contato@empresa.com" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade" required>
                <Input value={form.cidade} onChange={e => set("cidade", e.target.value)} placeholder="São Paulo" />
              </Field>
              <Field label="Nicho" required>
                <Select value={form.nicho} onValueChange={v => set("nicho", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NICHOS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site">
                <Input value={form.site} onChange={e => set("site", e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Instagram">
                <Input value={form.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@handle" />
              </Field>
            </div>
          </TabsContent>

          {/* ── Tab 2: Contrato ── */}
          <TabsContent value="contrato" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Produto VS" required>
                <Select value={form.produto_vs} onValueChange={v => set("produto_vs", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de Cobrança" required>
                <Select value={form.tipo_cobranca} onValueChange={v => set("tipo_cobranca", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fee_mensal">Fee Mensal</SelectItem>
                    <SelectItem value="projeto_fechado">Projeto Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fee Mensal (R$)" required>
                <Input type="number" value={form.valor_fee} onChange={e => set("valor_fee", e.target.value)} placeholder="1500" />
              </Field>
              <Field label="Data de Fechamento" required>
                <Input type="date" value={form.data_fechamento} onChange={e => set("data_fechamento", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início do Contrato">
                <Input type="date" value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
              </Field>
              <Field label="Entrega Prevista">
                <Input type="date" value={form.data_prev_entrega} onChange={e => set("data_prev_entrega", e.target.value)} />
              </Field>
            </div>
            <Field label="Observações do Contrato">
              <Textarea className={ta} value={form.obs_contrato} onChange={e => set("obs_contrato", e.target.value)} placeholder="Condições especiais, descontos, SLAs..." />
            </Field>
          </TabsContent>

          {/* ── Tab 3: Contexto ── */}
          <TabsContent value="contexto" className="space-y-3 pt-3">
            <Field label="Descrição do Negócio">
              <Textarea className={ta} value={form.descricao_negocio} onChange={e => set("descricao_negocio", e.target.value)} placeholder="O que a empresa faz, tamanho, mercado..." />
            </Field>
            <Field label="Dores Principais Identificadas">
              <Textarea className={ta} value={form.dores_mapeadas} onChange={e => set("dores_mapeadas", e.target.value)} placeholder="Dores mapeadas na imersão..." />
            </Field>
            <Field label="Sistemas e Ferramentas Atuais">
              <Textarea className={ta} value={form.sistemas_atuais} onChange={e => set("sistemas_atuais", e.target.value)} placeholder="CRM, WhatsApp, ERP, planilhas..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Equipe">
                <Input value={form.equipe_info} onChange={e => set("equipe_info", e.target.value)} placeholder="Ex: 3 vendedores, 1 SDR" />
              </Field>
              <Field label="Faturamento Estimado">
                <Input value={form.faturamento_est} onChange={e => set("faturamento_est", e.target.value)} placeholder="Ex: R$120k/mês" />
              </Field>
            </div>
            <Field label="Histórico Relevante">
              <Textarea className={ta} value={form.historico} onChange={e => set("historico", e.target.value)} placeholder="Contexto histórico da empresa, tentativas anteriores..." />
            </Field>
          </TabsContent>

          {/* ── Tab 4: Status & Progresso ── */}
          <TabsContent value="status" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status do Ciclo" required>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_CICLO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Responsável">
                <Select value={form.responsavel} onValueChange={v => set("responsavel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="victor">Victor</SelectItem>
                    <SelectItem value="danilo">Danilo</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={`Health Score — ${form.health_score}/10`}>
              <Slider
                min={0} max={10} step={1}
                value={[form.health_score]}
                onValueChange={([v]) => set("health_score", v)}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0 — Crítico</span><span>5 — Neutro</span><span>10 — Excelente</span>
              </div>
            </Field>

            <Field label="Próximo Check-in">
              <Input type="date" value={form.proximo_checkin} onChange={e => set("proximo_checkin", e.target.value)} />
            </Field>
            <Field label="Observações Internas">
              <Textarea className={ta} value={form.obs_internas} onChange={e => set("obs_internas", e.target.value)} placeholder="Notas internas — não visíveis ao cliente..." />
            </Field>
          </TabsContent>

          {/* ── Tab 5: Resultados ── */}
          <TabsContent value="resultados" className="space-y-3 pt-3">
            <Field label="Resultados Entregues">
              <Textarea className={ta} value={form.resultados} onChange={e => set("resultados", e.target.value)} placeholder="Descreva os resultados entregues até agora..." />
            </Field>
            <Field label="Métricas Antes / Depois">
              <Textarea className={ta} value={form.metricas_antes_depois} onChange={e => set("metricas_antes_depois", e.target.value)} placeholder="Ex: Taxa de resposta: 20% → 68% | Leads/mês: 40 → 95..." />
            </Field>
            <Field label="Depoimento do Cliente">
              <Textarea className={ta} value={form.depoimento} onChange={e => set("depoimento", e.target.value)} placeholder="Depoimento ou feedback do decisor..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`NPS — ${form.nps}/10`}>
                <Slider
                  min={0} max={10} step={1}
                  value={[form.nps]}
                  onValueChange={([v]) => set("nps", v)}
                  className="mt-2"
                />
              </Field>
              <Field label="Potencial de Upsell">
                <Select value={form.potencial_upsell} onValueChange={v => set("potencial_upsell", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UPSELL.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending}>
            {mutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Salvando...</>
              : <><Save className="h-4 w-4 mr-1" />{isEdit ? "Salvar alterações" : "Criar cliente"}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
