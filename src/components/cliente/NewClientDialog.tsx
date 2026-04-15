import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useNichos } from "@/hooks/useNichos";
const RESPONSAVEIS = ["victor", "danilo"];

export default function NewClientDialog() {
  const [open, setOpen] = useState(false);
  const { labels: NICHOS } = useNichos();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    nome_negocio: "",
    nicho: "Estética",
    cidade: "",
    whatsapp: "",
    decisor: "",
    tipo_cobranca: "fee_mensal",
    valor_fee: "",
    faturamento_estimado: "",
    responsavel_imersao: "victor",
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultoria_clientes").insert({
        nome_negocio: form.nome_negocio.trim(),
        nicho: form.nicho,
        cidade: form.cidade.trim(),
        whatsapp: form.whatsapp.trim(),
        decisor: form.decisor.trim(),
        tipo_cobranca: form.tipo_cobranca,
        valor_fee: Number(form.valor_fee) || 0,
        faturamento_estimado: form.faturamento_estimado || null,
        responsavel_imersao: form.responsavel_imersao,
        data_fechamento: new Date().toISOString(),
        status: "aguardando_imersao",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setOpen(false);
      setForm({
        nome_negocio: "", nicho: "Estética", cidade: "", whatsapp: "",
        decisor: "", tipo_cobranca: "fee_mensal", valor_fee: "", faturamento_estimado: "", responsavel_imersao: "victor",
      });
    },
    onError: () => toast.error("Erro ao criar cliente."),
  });

  const canSubmit = form.nome_negocio.trim() && form.cidade.trim() && form.whatsapp.trim() && form.decisor.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Negócio *</Label>
              <Input value={form.nome_negocio} onChange={e => set("nome_negocio", e.target.value)} placeholder="Ex: Clínica Beleza" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nicho *</Label>
              <Select value={form.nicho} onValueChange={v => set("nicho", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NICHOS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cidade *</Label>
              <Input value={form.cidade} onChange={e => set("cidade", e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp *</Label>
              <Input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="5511999999999" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Decisor *</Label>
              <Input value={form.decisor} onChange={e => set("decisor", e.target.value)} placeholder="Nome do decisor" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Cobrança</Label>
              <Select value={form.tipo_cobranca} onValueChange={v => set("tipo_cobranca", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fee_mensal">Fee Mensal</SelectItem>
                  <SelectItem value="projeto_fechado">Projeto Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" value={form.valor_fee} onChange={e => set("valor_fee", e.target.value)} placeholder="2000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Faturamento Estimado</Label>
              <Input value={form.faturamento_estimado} onChange={e => set("faturamento_estimado", e.target.value)} placeholder="Ex: R$ 50k/mês" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Select value={form.responsavel_imersao} onValueChange={v => set("responsavel_imersao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r === "victor" ? "Victor" : "Danilo"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
