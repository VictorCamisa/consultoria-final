import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNichos } from "@/hooks/useNichos";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";
import { Save, Copy, CheckCircle, XCircle, Loader2, Wifi, Plus, Trash2, QrCode, Smartphone, RefreshCw, Bot, Package, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import NichosManager from "@/components/NichosManager";

type Produto = {
  id: string;
  nome: string;
  categoria: string;
  tipo: string;
  ativo: boolean;
  nichos: string[];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

export default function Configuracoes() {
  const { nichos: nichosRecords } = useNichos();
  const queryClient = useQueryClient();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testingEvolution, setTestingEvolution] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "ok" | "erro" | null>>({});

  const evo = useEvolutionInstances();
  const [globalInstance, setGlobalInstance] = useState("");

  const { data: configs, isLoading } = useQuery({
    queryKey: ["configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultoria_config").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["vs-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vs_produtos" as any)
        .select("id, nome, categoria, tipo, ativo, nichos")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as Produto[];
    },
  });

  // Nichos únicos derivados de TODOS os produtos (todas as categorias)
  const nichosDosProdutos = useMemo(() => {
    if (!produtos) return [];
    const all = produtos.flatMap((p) => p.nichos ?? []);
    return [...new Set(all)].filter(Boolean).sort();
  }, [produtos]);

  const updateConfig = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const { error } = await supabase
        .from("consultoria_config")
        .upsert(config as any, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configs"] });
      toast({ title: "Configuração salva!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Salva apenas Script A/B/C + system_prompt + horário + ia_auto_reply
  const handleSaveScript = (
    e: React.FormEvent<HTMLFormElement>,
    nicho: string,
    existing: Record<string, unknown> | undefined
  ) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const config: Record<string, unknown> = {
      ...(existing?.id ? { id: existing.id } : {}),
      nicho,
      script_a: fd.get("script_a") as string,
      script_b: fd.get("script_b") as string,
      script_c: fd.get("script_c") as string,
      system_prompt: fd.get("system_prompt") as string,
      instancia_evolution: globalInstance || (existing?.instancia_evolution as string) || "",
      horario_inicio: Number(fd.get("horario_inicio") ?? existing?.horario_inicio ?? 9),
      horario_fim: Number(fd.get("horario_fim") ?? existing?.horario_fim ?? 18),
      // Preserva valores de cadência existentes
      followup_d1: existing?.followup_d1 ?? "",
      followup_d3: existing?.followup_d3 ?? "",
      followup_d7: existing?.followup_d7 ?? "",
      followup_d14: existing?.followup_d14 ?? "",
      followup_d30: existing?.followup_d30 ?? "",
      criterios_qualificacao: existing?.criterios_qualificacao ?? {},
    };
    updateConfig.mutate(config);
  };

  // Salva apenas D1/D3/D7/D14/D30 (cadência)
  const handleSaveCadencia = (
    e: React.FormEvent<HTMLFormElement>,
    nicho: string,
    existing: Record<string, unknown> | undefined
  ) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const config: Record<string, unknown> = {
      ...(existing?.id ? { id: existing.id } : {}),
      nicho,
      followup_d1: fd.get("followup_d1") as string,
      followup_d3: fd.get("followup_d3") as string,
      followup_d7: fd.get("followup_d7") as string,
      followup_d14: fd.get("followup_d14") as string,
      followup_d30: fd.get("followup_d30") as string,
      // Preserva valores de script existentes
      script_a: existing?.script_a ?? "",
      script_b: existing?.script_b ?? "",
      script_c: existing?.script_c ?? "",
      system_prompt: existing?.system_prompt ?? "",
      instancia_evolution: existing?.instancia_evolution ?? globalInstance ?? "",
      horario_inicio: existing?.horario_inicio ?? 9,
      horario_fim: existing?.horario_fim ?? 18,
      criterios_qualificacao: existing?.criterios_qualificacao ?? {},
    };
    updateConfig.mutate(config);
  };

  const handleSetGlobalInstance = async (instanceName: string) => {
    setGlobalInstance(instanceName);
    if (!configs?.length) return;
    for (const c of configs) {
      await supabase.from("consultoria_config").update({ instancia_evolution: instanceName }).eq("id", c.id);
    }
    queryClient.invalidateQueries({ queryKey: ["configs"] });
    toast({ title: "Instância atualizada para todos os nichos!" });
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleTestEvolution = async (nicho: string, instancia: string) => {
    if (!instancia) {
      toast({ title: "Defina a instância Evolution antes de testar", variant: "destructive" });
      return;
    }
    setTestingEvolution(nicho);
    setTestResults((prev) => ({ ...prev, [nicho]: null }));
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { _test: true, instancia },
      });
      const ok = !error || (data && !data.error?.includes("Evolution API error"));
      setTestResults((prev) => ({ ...prev, [nicho]: ok ? "ok" : "erro" }));
      toast({
        title: ok ? "Conexão Evolution OK" : "Erro na conexão Evolution",
        variant: ok ? "default" : "destructive",
      });
    } catch {
      setTestResults((prev) => ({ ...prev, [nicho]: "erro" }));
      toast({ title: "Erro ao testar conexão", variant: "destructive" });
    } finally {
      setTestingEvolution(null);
    }
  };

  useEffect(() => {
    const firstInstance = configs?.[0]?.instancia_evolution;
    if (firstInstance && !globalInstance) {
      setGlobalInstance(firstInstance as string);
    }
  }, [configs, globalInstance]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  const getStateBadge = (state: string) => {
    if (state === "open") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Conectado</Badge>;
    if (state === "connecting") return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">Conectando...</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Desconectado</Badge>;
  };

  const categoriaLabel: Record<string, string> = { servico: "Serviço", produto: "Produto" };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Tabs defaultValue="scripts">
        <TabsList className="w-full flex overflow-x-auto hide-scrollbar">
          <TabsTrigger value="scripts" className="flex-1 min-w-0 text-xs sm:text-sm">Scripts por Vertical</TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1 min-w-0 text-xs sm:text-sm">WhatsApp</TabsTrigger>
          <TabsTrigger value="cadencia" className="flex-1 min-w-0 text-xs sm:text-sm">Cadência</TabsTrigger>
          <TabsTrigger value="nichos" className="flex-1 min-w-0 text-xs sm:text-sm">Nichos</TabsTrigger>
        </TabsList>

        {/* ── Scripts por Vertical ── */}
        <TabsContent value="scripts" className="mt-4 space-y-6">
          {loadingProdutos ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
          ) : nichosDosProdutos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum nicho encontrado nos produtos. Cadastre produtos com nichos em{" "}
                <strong>Produtos &amp; Serviços</strong>.
              </CardContent>
            </Card>
          ) : (
            nichosDosProdutos.map((nicho) => {
              const existing = configs?.find((c) => c.nicho === nicho);
              // Produtos vinculados a este nicho
              const produtosDoNicho = produtos?.filter((p) => p.nichos?.includes(nicho)) ?? [];

              return (
                <Card key={nicho}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-lg">{nicho}</CardTitle>
                        {produtosDoNicho.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {produtosDoNicho.map((p) => (
                              <Badge key={p.id} variant="outline" className="text-[10px] gap-1">
                                <Package className="h-2.5 w-2.5" />
                                {p.nome}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {existing ? (
                        <Badge variant="secondary" className="text-xs">Configurado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Não configurado</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={(e) => handleSaveScript(e, nicho, existing as Record<string, unknown> | undefined)}
                      className="space-y-4"
                    >
                      <div>
                        <p className="text-sm font-medium mb-2 text-muted-foreground">Scripts de abordagem inicial</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div><Label>Script A</Label><Textarea name="script_a" defaultValue={existing?.script_a ?? ""} rows={3} className="text-xs" /></div>
                          <div><Label>Script B</Label><Textarea name="script_b" defaultValue={existing?.script_b ?? ""} rows={3} className="text-xs" /></div>
                          <div><Label>Script C</Label><Textarea name="script_c" defaultValue={existing?.script_c ?? ""} rows={3} className="text-xs" /></div>
                        </div>
                      </div>

                      <div>
                        <Label>System Prompt do Agente IA</Label>
                        <Textarea
                          name="system_prompt"
                          defaultValue={existing?.system_prompt ?? ""}
                          rows={4}
                          placeholder="Descreva o contexto do nicho, tom de voz, objeções comuns..."
                          className="text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Horário início (h)</Label>
                          <Input type="number" name="horario_inicio" defaultValue={existing?.horario_inicio ?? 9} min={0} max={23} />
                        </div>
                        <div>
                          <Label>Horário fim (h)</Label>
                          <Input type="number" name="horario_fim" defaultValue={existing?.horario_fim ?? 18} min={0} max={23} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Bot className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">IA Auto-Reply</p>
                            <p className="text-xs text-muted-foreground">Resposta automática da IA quando o lead responde</p>
                          </div>
                        </div>
                        <Switch
                          checked={(existing as any)?.ia_auto_reply !== false}
                          onCheckedChange={async (checked) => {
                            if (!existing?.id) return;
                            await supabase.from("consultoria_config").update({ ia_auto_reply: checked } as any).eq("id", existing.id);
                            queryClient.invalidateQueries({ queryKey: ["configs"] });
                            toast({ title: checked ? "IA Auto-Reply ativada" : "IA Auto-Reply desativada" });
                          }}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateConfig.isPending}>
                          <Save className="h-4 w-4 mr-2" />Salvar {nicho}
                        </Button>
                        {existing?.instancia_evolution && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={testingEvolution === nicho}
                            onClick={() => handleTestEvolution(nicho, existing.instancia_evolution as string)}
                          >
                            {testingEvolution === nicho ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : testResults[nicho] === "ok" ? (
                              <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                            ) : testResults[nicho] === "erro" ? (
                              <XCircle className="h-4 w-4 mr-2 text-destructive" />
                            ) : (
                              <Wifi className="h-4 w-4 mr-2" />
                            )}
                            Testar Evolution
                          </Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── WhatsApp / Evolution ── */}
        <TabsContent value="whatsapp" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5" /> Instâncias WhatsApp
                  </CardTitle>
                  <CardDescription className="text-xs">Crie, conecte e gerencie suas instâncias da Evolution API.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={evo.fetchInstances} disabled={evo.instancesLoading} className="self-start">
                  <RefreshCw className={`h-4 w-4 mr-1 ${evo.instancesLoading ? "animate-spin" : ""}`} /> Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {evo.instances.length > 0 && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                  <Label className="text-sm font-semibold">Instância ativa (usada por todos os nichos)</Label>
                  <select
                    value={globalInstance}
                    onChange={(e) => handleSetGlobalInstance(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecione a instância principal</option>
                    {evo.instances.map((inst) => (
                      <option key={inst.name} value={inst.name}>
                        {inst.name} {inst.state === "open" ? "✅" : "⚠️"}
                      </option>
                    ))}
                  </select>
                  {globalInstance && (
                    <p className="text-xs text-muted-foreground">
                      Todos os nichos usarão <strong>{globalInstance}</strong> para enviar e receber mensagens.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Label>Nome da nova instância</Label>
                  <Input
                    value={evo.newInstanceName}
                    onChange={(e) => evo.setNewInstanceName(e.target.value)}
                    placeholder="ex: vs-estetica-01"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Use letras, números, - ou _. O webhook será configurado automaticamente.</p>
                </div>
                <Button onClick={evo.createInstance} disabled={evo.creatingInstance || !evo.newInstanceName.trim()} className="w-full sm:w-auto">
                  {evo.creatingInstance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Criar Instância
                </Button>
              </div>

              {evo.instancesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : evo.instances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma instância criada ainda. Crie uma acima para começar.
                </div>
              ) : (
                <div className="space-y-3">
                  {evo.instances.map((inst) => (
                    <div key={inst.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{inst.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStateBadge(inst.state)}
                            {inst.state === "open" && (
                              <span className="text-xs text-muted-foreground">Webhook ativo • Pronto para enviar/receber</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {inst.state !== "open" && (
                          <Button variant="outline" size="sm" onClick={() => evo.getQRCode(inst.name)}>
                            <QrCode className="h-4 w-4 mr-1" /> Conectar
                          </Button>
                        )}
                        {inst.state === "open" && (
                          <Button variant="outline" size="sm" onClick={() => evo.getQRCode(inst.name)}>
                            <QrCode className="h-4 w-4 mr-1" /> Reconectar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja excluir a instância "${inst.name}"?`)) {
                              evo.deleteInstance(inst.name);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-muted p-4 text-xs space-y-2 text-muted-foreground">
                <p className="font-medium text-foreground text-sm">Como funciona:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><strong>Crie</strong> uma instância com um nome único (ex: vs-estetica-01)</li>
                  <li><strong>Escaneie o QR Code</strong> com o WhatsApp do número que será usado</li>
                  <li>O <strong>webhook é configurado automaticamente</strong> — mensagens recebidas já entram no sistema</li>
                  <li>Na aba <strong>Scripts por Vertical</strong>, vincule a instância ao nicho desejado</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cadência — FUNCIONAL ── */}
        <TabsContent value="cadencia" className="mt-4 space-y-4">
          {/* Info: sequência */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sequência de Cadência</CardTitle>
              <CardDescription>
                Configure as mensagens de follow-up automático por vertical. Os textos são enviados nos dias D1, D3, D7, D14 e D30 após a abordagem inicial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {["D1", "D3", "D7", "D14", "D30"].map((d, i, arr) => (
                  <span key={d} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{d}</Badge>
                    {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </span>
                ))}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs">Frio</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Respeita o horário configurado por vertical. Prospect que responde sai automaticamente da cadência.
              </p>

              {/* Webhook URL */}
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground">URL do Webhook (referência)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs flex-1 truncate" />
                  <Button variant="outline" size="sm" onClick={handleCopyWebhook} className="shrink-0">
                    {copiedWebhook ? (
                      <><CheckCircle className="h-4 w-4 mr-1 text-green-400" />Copiado</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" />Copiar</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração funcional por vertical */}
          {loadingProdutos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : nichosDosProdutos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma vertical encontrada. Cadastre produtos com nichos em <strong>Produtos &amp; Serviços</strong>.
              </CardContent>
            </Card>
          ) : (
            nichosDosProdutos.map((nicho) => {
              const existing = configs?.find((c) => c.nicho === nicho);
              return (
                <Card key={nicho}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{nicho}</CardTitle>
                    <CardDescription className="text-xs">
                      Mensagens de follow-up automático para a vertical <strong>{nicho}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={(e) => handleSaveCadencia(e, nicho, existing as Record<string, unknown> | undefined)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs font-semibold">D1 — 1º dia</Label>
                          <Textarea
                            name="followup_d1"
                            defaultValue={existing?.followup_d1 ?? ""}
                            rows={3}
                            placeholder="Mensagem enviada no dia 1..."
                            className="text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">D3 — 3º dia</Label>
                          <Textarea
                            name="followup_d3"
                            defaultValue={existing?.followup_d3 ?? ""}
                            rows={3}
                            placeholder="Mensagem enviada no dia 3..."
                            className="text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">D7 — 7º dia</Label>
                          <Textarea
                            name="followup_d7"
                            defaultValue={existing?.followup_d7 ?? ""}
                            rows={3}
                            placeholder="Mensagem enviada no dia 7..."
                            className="text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">D14 — 14º dia</Label>
                          <Textarea
                            name="followup_d14"
                            defaultValue={existing?.followup_d14 ?? ""}
                            rows={3}
                            placeholder="Mensagem enviada no dia 14..."
                            className="text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">D30 — 30º dia</Label>
                          <Textarea
                            name="followup_d30"
                            defaultValue={existing?.followup_d30 ?? ""}
                            rows={3}
                            placeholder="Mensagem enviada no dia 30..."
                            className="text-xs mt-1"
                          />
                        </div>
                      </div>

                      <Button type="submit" disabled={updateConfig.isPending} size="sm">
                        <Save className="h-4 w-4 mr-2" />Salvar cadência — {nicho}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Nichos vinculados a Produtos ── */}
        <TabsContent value="nichos" className="mt-4 space-y-4">
          <NichosManager />

          {/* Produtos por nicho */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Produtos vinculados por Nicho
              </CardTitle>
              <CardDescription className="text-xs">
                Todos os produtos cadastrados (todas as categorias) organizados por nicho/vertical.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProdutos ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : nichosDosProdutos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum produto com nicho cadastrado. Vá em <strong>Produtos &amp; Serviços</strong> e associe produtos a nichos.
                </p>
              ) : (
                <div className="space-y-4">
                  {nichosDosProdutos.map((nicho) => {
                    const produtosDoNicho = produtos?.filter((p) => p.nichos?.includes(nicho)) ?? [];
                    const nichoRecord = nichosRecords.find((n) => n.label === nicho);
                    return (
                      <div key={nicho} className="space-y-2">
                        <div className="flex items-center gap-2">
                          {nichoRecord && <span className="text-base">{nichoRecord.icon}</span>}
                          <Badge className={nichoRecord ? `${nichoRecord.color} border text-xs` : "text-xs"}>
                            {nicho}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{produtosDoNicho.length} produto(s)</span>
                        </div>
                        {produtosDoNicho.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                            {produtosDoNicho.map((p) => (
                              <div
                                key={p.id}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${!p.ativo ? "opacity-40" : "bg-card"}`}
                              >
                                <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{p.nome}</p>
                                  <p className="text-muted-foreground">{categoriaLabel[p.categoria] ?? p.categoria} · {p.tipo === "recorrente" ? "Recorrente" : "Único"}</p>
                                </div>
                                {!p.ativo && <Badge variant="outline" className="text-[9px] shrink-0 ml-auto">Inativo</Badge>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground pl-2">Nenhum produto associado.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={evo.qrDialogOpen} onOpenChange={evo.setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Conectar {evo.qrInstanceName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {evo.connectionStatus === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle className="h-16 w-16 text-green-400" />
                <p className="text-lg font-medium text-green-400">WhatsApp conectado!</p>
                <p className="text-sm text-muted-foreground">Webhook configurado automaticamente.</p>
              </div>
            ) : evo.qrLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : evo.qrCode ? (
              <>
                <div className="border-4 border-primary rounded-xl p-2 bg-white">
                  <img
                    src={evo.qrCode.startsWith("data:") ? evo.qrCode : `data:image/png;base64,${evo.qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 object-contain"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Escaneie com o WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Abra o WhatsApp → Aparelhos conectados → Conectar aparelho</p>
                  <div className="flex items-center gap-2 justify-center mt-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Aguardando leitura do QR Code...</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <XCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-muted-foreground">Não foi possível gerar o QR Code. Tente novamente.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
