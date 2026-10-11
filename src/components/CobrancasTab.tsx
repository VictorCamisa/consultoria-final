import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Copy, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";

const METODOS = [
  { id: "pix", label: "PIX" },
  { id: "credit_card", label: "Cartão de crédito (até 12x)" },
  { id: "debit_card", label: "Cartão de débito" },
  { id: "bolbradesco", label: "Boleto bancário" },
];

const STATUS_BADGE: Record<string, { label: string; class: string; icon: any }> = {
  pendente: { label: "Pendente", class: "bg-warning/20 text-warning-foreground border-warning/30", icon: Clock },
  pago: { label: "Pago", class: "bg-green-600/20 text-green-400 border-green-600/30", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", class: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  cancelado: { label: "Cancelado", class: "bg-muted text-muted-foreground border-muted", icon: XCircle },
  reembolsado: { label: "Reembolsado", class: "bg-muted text-muted-foreground border-muted", icon: XCircle },
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CobrancasTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const [clienteId, setClienteId] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [razao, setRazao] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [metodos, setMetodos] = useState<string[]>(["pix", "credit_card", "bolbradesco"]);
  const [enviarWhats, setEnviarWhats] = useState(true);
  const [mensagem, setMensagem] = useState<string>("");
  const [expira, setExpira] = useState<string>("7");

  const { data: clientes } = useQuery({
    queryKey: ["cobrancas-clientes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_clientes")
        .select("id, nome_negocio, decisor, whatsapp")
        .order("nome_negocio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cobrancas, isLoading } = useQuery({
    queryKey: ["cobrancas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_cobrancas" as any)
        .select("*, consultoria_clientes(nome_negocio, decisor)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const stats = useMemo(() => {
    const list = cobrancas ?? [];
    const pendente = list.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0);
    const pago = list.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor), 0);
    return { pendente, pago, count: list.length };
  }, [cobrancas]);

  const reset = () => {
    setClienteId("");
    setValor("");
    setRazao("");
    setDescricao("");
    setMetodos(["pix", "credit_card", "bolbradesco"]);
    setEnviarWhats(true);
    setMensagem("");
    setExpira("7");
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Selecione um cliente");
      const v = Number(valor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Informe um valor válido");
      if (!razao.trim()) throw new Error("Informe a razão da cobrança");
      if (metodos.length === 0) throw new Error("Selecione ao menos uma forma de pagamento");

      const { data, error } = await supabase.functions.invoke("mercado-pago-cobranca", {
        body: {
          cliente_id: clienteId,
          valor: v,
          razao: razao.trim(),
          descricao: descricao.trim() || null,
          metodos,
          enviar_whatsapp: enviarWhats,
          mensagem_personalizada: mensagem.trim() || null,
          expira_em_dias: Number(expira) || 7,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cobrancas-list"] });
      const wppOk = data?.whatsapp?.ok;
      toast({
        title: "Cobrança criada",
        description: wppOk
          ? "Link gerado e enviado por WhatsApp."
          : enviarWhats
            ? `Link gerado, mas WhatsApp falhou: ${data?.whatsapp?.error ?? "erro desconhecido"}`
            : "Link gerado.",
      });
      setOpen(false);
      reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar cobrança", description: e.message, variant: "destructive" });
    },
  });

  const reenviar = useMutation({
    mutationFn: async (cobranca: any) => {
      // Recria a cobrança? Não — apenas reenvia o link existente.
      // Para isso reutilizamos a função send-whatsapp via prospect_id, mas aqui o cliente pode não ter prospect.
      // Solução: chamar a função criar com mesmos dados, ou copiar link manualmente.
      // Vamos invocar a função novamente com os mesmos campos para regerar e reenviar.
      const { data, error } = await supabase.functions.invoke("mercado-pago-cobranca", {
        body: {
          cliente_id: cobranca.cliente_id,
          valor: Number(cobranca.valor),
          razao: cobranca.razao,
          descricao: cobranca.descricao,
          metodos: cobranca.metodos_pagamento,
          enviar_whatsapp: true,
          expira_em_dias: 7,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas-list"] });
      toast({ title: "Reenviado", description: "Nova cobrança gerada e enviada por WhatsApp." });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao reenviar", description: e.message, variant: "destructive" });
    },
  });

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado" });
  };

  const toggleMetodo = (id: string) => {
    setMetodos((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Pago</p>
              <p className="text-xl font-bold text-green-400 tabular">{fmtBRL(stats.pago)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
              <p className="text-xl font-bold text-warning tabular">{fmtBRL(stats.pendente)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Cobranças</p>
              <p className="text-xl font-bold tabular">{stats.count}</p>
            </CardContent>
          </Card>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1.5" /> Nova cobrança
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova cobrança — Mercado Pago</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_negocio} {c.decisor ? `— ${c.decisor}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="1500,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Vence em (dias)</Label>
                  <Input type="number" min={1} max={30} value={expira} onChange={(e) => setExpira(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Razão (título)</Label>
                <Input
                  placeholder="Ex.: Mensalidade Consultoria — Maio/2026"
                  value={razao}
                  onChange={(e) => setRazao(e.target.value)}
                />
              </div>

              <div>
                <Label>Explicação prática (vai no WhatsApp)</Label>
                <Textarea
                  placeholder="Ex.: Cobrança referente à mensalidade da consultoria, com 4 reuniões semanais e suporte ilimitado..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Formas de pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={metodos.includes(m.id)}
                        onCheckedChange={() => toggleMetodo(m.id)}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={enviarWhats} onCheckedChange={(v) => setEnviarWhats(!!v)} />
                  Enviar pelo WhatsApp automaticamente
                </label>
                {enviarWhats && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Mensagem personalizada (opcional — sobrescreve o template)
                    </Label>
                    <Textarea
                      placeholder="Deixe em branco para usar a mensagem padrão com razão, valor, métodos e link."
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                {criar.isPending ? "Criando..." : "Criar e enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de cobranças</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Razão</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : (cobrancas ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      Nenhuma cobrança criada ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  (cobrancas ?? []).map((c) => {
                    const s = STATUS_BADGE[c.status] ?? STATUS_BADGE.pendente;
                    const Icon = s.icon;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{c.consultoria_clientes?.nome_negocio ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.consultoria_clientes?.decisor}</p>
                        </TableCell>
                        <TableCell className="text-sm max-w-[240px] truncate">{c.razao}</TableCell>
                        <TableCell className="tabular font-semibold text-sm">{fmtBRL(Number(c.valor))}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${s.class}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {s.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.whatsapp_enviado ? (
                            <span className="text-green-400">✓ enviado</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {c.mp_init_point && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => copy(c.mp_init_point)}
                                  title="Copiar link"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => window.open(c.mp_init_point, "_blank")}
                                  title="Abrir checkout"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {c.status === "pendente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                disabled={reenviar.isPending}
                                onClick={() => reenviar.mutate(c)}
                                title="Reenviar via WhatsApp (gera nova cobrança)"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
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
    </div>
  );
}
