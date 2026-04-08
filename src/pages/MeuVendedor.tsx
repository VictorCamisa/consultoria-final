import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  Building2, Save, Plus, Trash2, Send, Loader2, MessageSquare,
  Bot, User, RotateCcw, Sparkles, Target, Shield, Zap,
  ClipboardCheck, TrendingUp, AlertTriangle, CheckCircle2, Star,
  BookOpen, BrainCircuit,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string;
  segment: string;
  description: string;
  target_audience: string;
  tone_of_voice: string;
  products_services: string;
  differentials: string;
  common_objections: string;
  created_at: string;
  updated_at: string;
}

interface Scenario {
  id: string;
  profile_id: string;
  name: string;
  description: string;
  system_prompt: string;
  customer_persona: string;
  difficulty: string;
  created_at: string;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

interface ChatEvaluation {
  nota_geral: number;
  rapport: number;
  diagnostico: number;
  objecoes: number;
  cta: number;
  pontos_fortes: string[];
  pontos_fracos: string[];
  dica_principal: string;
}

// ─── Streaming helper ────────────────────────────────────────────────────────

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vendedor-chat`;

async function streamChat({
  messages,
  profile,
  scenario,
  knowledge,
  onDelta,
  onDone,
  signal,
}: {
  messages: ChatMsg[];
  profile: CompanyProfile | null;
  scenario: Scenario | null;
  knowledge?: any[];
  onDelta: (text: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, profile, scenario, knowledge }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro na resposta" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

// ─── Difficulty config ───────────────────────────────────────────────────────

const DIFFICULTIES = [
  { value: "facil", label: "Fácil", icon: Zap, color: "text-green-400" },
  { value: "medio", label: "Médio", icon: Target, color: "text-amber-400" },
  { value: "dificil", label: "Difícil", icon: Shield, color: "text-red-400" },
];

const PRESET_SCENARIOS = [
  {
    name: "Abordagem Fria — Estética",
    description: "Primeiro contato via WhatsApp com dona de clínica de estética. Nunca ouviu falar da VS. Usar Script A (dor direta): perguntar quantos leads chegam no WhatsApp e quantos viram agendamento.",
    customer_persona: "Dona de clínica de estética, 30-45 anos, faz tudo sozinha. Recebe muitas mensagens de vendedores e ignora a maioria. Tem Instagram ativo mas WhatsApp Business mal configurado. Demora 2-3h pra responder leads. Faturamento ~R$40k/mês. Desconfiada com 'soluções mágicas'.",
    difficulty: "medio",
    system_prompt: "Você é dona de uma clínica de estética em Taubaté. Trabalha com harmonização facial, lipo enzimática e skincare. Tem 3.500 seguidores no Instagram, posta 2-3x por semana. Não tem site. Responde WhatsApp quando dá (demora horas). Já foi abordada por agências e não gostou. Seu principal problema é que leads somem porque demora pra responder, mas você não sabe exatamente quantos perde.",
    dica: "Use o Script A: 'Vi que vocês fazem [serviço]. Quantas mensagens chegam no WhatsApp por dia? Dessas, quantas viram agendamento?' — Foque na DOR, não no produto.",
  },
  {
    name: "Abordagem Fria — Odonto",
    description: "Primeiro contato com dentista/dono de consultório. Usar Script A (dor de cancelamento): perguntar a taxa de faltas e cancelamentos.",
    customer_persona: "Dentista dono de consultório, 35-50 anos. Tem secretária que atende telefone e WhatsApp no horário comercial. Sofre com faltas e cancelamentos (20-30%). Tem base de pacientes inativos que nunca reativou. Faturamento ~R$60k/mês. Acha que marketing é 'coisa de clínica grande'.",
    difficulty: "medio",
    system_prompt: "Você é dentista dono de um consultório em São José dos Campos. Atende implantes e ortodontia. Tem uma secretária que cuida do WhatsApp e agenda. Taxa de cancelamento é alta (~25%) mas você não mede exatamente. Tem uns 800 pacientes cadastrados mas só 200 são ativos. Nunca tentou reativar a base. Acha que IA é 'coisa futurista' e prefere o toque humano.",
    dica: "Script A: 'Dr(a), qual a taxa de cancelamento da agenda hoje? E a base de pacientes inativos, já tentou reativar?' — Faça ele perceber o dinheiro que deixa na mesa.",
  },
  {
    name: "Abordagem Fria — Advocacia",
    description: "Primeiro contato com advogado/sócio de escritório. Usar Script A (dor comercial): perguntar quantas consultas chegam pelo WhatsApp e quantas viram contrato.",
    customer_persona: "Advogado sócio de escritório pequeno, 35-55 anos. Trabalha por indicação e acha que marketing é antiético. Não tem presença digital forte. Perde 60%+ das consultas por falta de follow-up. Conservador digitalmente.",
    difficulty: "dificil",
    system_prompt: "Você é advogado trabalhista com escritório em Taubaté. Tem 2 sócios e 1 estagiário. A maioria dos clientes vem por indicação. Tem site antigo que quase não atualiza. Recebe consultas pelo WhatsApp pessoal e esquece de responder. Acha que marketing jurídico é 'apelação'. Não sabe quantos leads perde. É cético com tecnologia e IA.",
    dica: "Abordagem sutil: não fale de 'marketing'. Pergunte 'das consultas que chegam por WhatsApp, quantas viram contrato?' — Deixe ele perceber o gap sozinho.",
  },
  {
    name: "Call Inicial de 30 min",
    description: "Simulação da call gratuita (Fase F2). Objetivo: fazer o empresário perceber o tamanho do problema. Usar os 4 blocos: Rapport (5min), Diagnóstico Rápido (12-15min), Síntese + Dados (8-10min), CTA (3-5min).",
    customer_persona: "Empresário que respondeu à abordagem e aceitou a call. Curioso mas cauteloso. Vai revelar gaps se fizer as perguntas certas. Quando disser 'não sei', 'acho que', 'não tenho isso' — essa é a dor.",
    difficulty: "medio",
    system_prompt: "Você é dono de uma clínica de estética que aceitou uma call de 30min. Está curioso mas ocupado. Seus problemas: demora 2-3h pra responder WhatsApp, não tem CRM (controla tudo em planilha/cabeça), não sabe de onde vêm os clientes, posta no Instagram 'quando dá tempo', gasta 70% do dia operando. Se perguntarem 'quantos leads perdeu no último mês', você não sabe responder. Seja honesto sobre os gaps quando perguntado, mas não entregue tudo de bandeja.",
    dica: "Estrutura: 1) Rapport — crie conexão genuína. 2) Diagnóstico — pergunte 'como funciona hoje?' e cave os gaps. 3) Síntese — 'Se você perde X leads/mês × ticket médio = R$Y perdido'. 4) CTA — 'Faz sentido a gente investigar isso a fundo?'",
  },
  {
    name: "Objeção: 'Tá caro'",
    description: "O prospect recebeu a proposta (R$2.500-4.500) e diz que está caro. Treinar a resposta com cálculo de ROI e mecanismo de abatimento de 50%.",
    customer_persona: "Empresário que fez a call, entendeu o valor, mas acha o investimento alto. Vai comparar com preço de 'agência' ou 'freelancer'. Quer desconto. Precisa ouvir a conta de quanto perde por mês sem resolver o problema.",
    difficulty: "dificil",
    system_prompt: "Você é dona de clínica de estética que fez a call e gostou. Recebeu a proposta de R$3.500 pelo diagnóstico. Acha caro. Vai dizer 'uma agência cobra R$500/mês' e 'preciso pensar'. Seu ticket médio é R$350, recebe ~80 leads/mês mas converte só 20. Se o vendedor fizer a conta de quanto você perde, vai se interessar. Se mencionar o abatimento de 50% no recorrente, vai ficar mais aberta.",
    dica: "Conta de ROI: 80 leads × 50% perda × R$350 = R$14k/mês perdido. O diagnóstico custa R$3.5k (1x) e se contratar o recorrente, 50% vira crédito. Nunca dê desconto — mostre o custo de NÃO fazer.",
  },
  {
    name: "Objeção: 'Já tentei automação'",
    description: "Prospect cético que já teve experiência ruim com chatbot ou CRM. Treinar diferenciação do ecossistema VS vs ferramentas genéricas.",
    customer_persona: "Empresário que já pagou por chatbot/CRM e não funcionou. Está frustrado e cético. Precisa entender que VS é ecossistema completo, não ferramenta avulsa.",
    difficulty: "dificil",
    system_prompt: "Você é dono de consultório odontológico que já contratou um chatbot por R$200/mês e cancelou em 2 meses porque 'respondia tudo errado e irritava os pacientes'. Também tentou um CRM que ninguém da equipe usava. Está convicto de que 'essas coisas não funcionam'. Se o vendedor conseguir explicar a diferença real (IA que entende contexto, ecossistema completo, 98,9% assertividade, 2.500+ leads processados), você pode reconsiderar.",
    dica: "Valide a frustração primeiro: 'Total, chatbot genérico é péssimo mesmo.' Diferencie: VS não é ferramenta, é ecossistema (IA + processo + acompanhamento humano). Use dados: 98,9% assertividade, 2.500 leads processados. Ofereça prova: 'posso mostrar prints reais de conversas que a IA conduziu?'",
  },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MeuVendedor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Profile ──
  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["vendedor-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_company_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CompanyProfile[];
    },
  });

  const activeProfile = profiles?.[0] ?? null;

  const saveProfile = useMutation({
    mutationFn: async (form: Record<string, string>) => {
      const payload = {
        company_name: form.company_name,
        segment: form.segment,
        description: form.description,
        target_audience: form.target_audience,
        tone_of_voice: form.tone_of_voice,
        products_services: form.products_services,
        differentials: form.differentials,
        common_objections: form.common_objections,
      };
      if (activeProfile) {
        const { error } = await supabase
          .from("vendedor_company_profiles")
          .update(payload)
          .eq("id", activeProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vendedor_company_profiles")
          .insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedor-profiles"] });
      toast({ title: "Perfil salvo!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveProfile.mutate({
      company_name: fd.get("company_name") as string,
      segment: fd.get("segment") as string,
      description: fd.get("description") as string,
      target_audience: fd.get("target_audience") as string,
      tone_of_voice: fd.get("tone_of_voice") as string,
      products_services: fd.get("products_services") as string,
      differentials: fd.get("differentials") as string,
      common_objections: fd.get("common_objections") as string,
    });
  };

  // ── Scenarios ──
  const { data: scenarios, isLoading: loadingScenarios } = useQuery({
    queryKey: ["vendedor-scenarios", activeProfile?.id],
    enabled: !!activeProfile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_scenarios")
        .select("*")
        .eq("profile_id", activeProfile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Scenario[];
    },
  });

  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);

  const createScenario = useMutation({
    mutationFn: async (s: Omit<Scenario, "id" | "created_at" | "profile_id"> & { profile_id: string }) => {
      const { error } = await supabase.from("vendedor_scenarios").insert(s);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedor-scenarios"] });
      setScenarioDialogOpen(false);
      toast({ title: "Cenário criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendedor_scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedor-scenarios"] });
      toast({ title: "Cenário removido" });
    },
  });

  const handleCreateScenario = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeProfile) return;
    const fd = new FormData(e.currentTarget);
    createScenario.mutate({
      profile_id: activeProfile.id,
      name: fd.get("name") as string,
      description: fd.get("description") as string,
      system_prompt: fd.get("system_prompt") as string,
      customer_persona: fd.get("customer_persona") as string,
      difficulty: fd.get("difficulty") as string || "medio",
    });
  };

  const handleUsePreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    if (!activeProfile) return;
    createScenario.mutate({
      profile_id: activeProfile.id,
      name: preset.name,
      description: preset.description,
      system_prompt: preset.system_prompt,
      customer_persona: preset.customer_persona,
      difficulty: preset.difficulty,
    });
  };

  // ── Chat Simulator ──
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [evaluation, setEvaluation] = useState<ChatEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showDica, setShowDica] = useState(true);
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Knowledge base ──
  const { data: knowledgeItems } = useQuery({
    queryKey: ["vendedor-knowledge", activeProfile?.id],
    enabled: !!activeProfile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_knowledge" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const activeScenario = scenarios?.find((s) => s.id === selectedScenario) ?? null;

  // Find matching preset for tips
  const matchingPreset = activeScenario
    ? PRESET_SCENARIOS.find((p) => p.name === activeScenario.name)
    : null;

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isStreaming) return;

    setShowDica(false);
    setEvaluation(null);

    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setIsStreaming(true);

    let assistantSoFar = "";
    abortRef.current = new AbortController();

    try {
      await streamChat({
        messages: newMessages,
        profile: activeProfile,
        scenario: activeScenario,
        knowledge: knowledgeItems || [],
        signal: abortRef.current.signal,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setChatMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        },
        onDone: () => setIsStreaming(false),
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast({ title: "Erro no chat", description: (err as Error).message, variant: "destructive" });
      }
      setIsStreaming(false);
    }
  }, [chatInput, isStreaming, chatMessages, activeProfile, activeScenario]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const resetChat = () => {
    abortRef.current?.abort();
    setChatMessages([]);
    setChatInput("");
    setIsStreaming(false);
    setEvaluation(null);
    setShowDica(true);
  };

  // ── Evaluation ──
  const handleEvaluate = async () => {
    if (chatMessages.length < 4) {
      toast({ title: "Conversa muito curta", description: "Troque pelo menos 2 mensagens antes de avaliar.", variant: "destructive" });
      return;
    }

    setIsEvaluating(true);
    try {
      const transcript = chatMessages
        .map((m) => `[${m.role === "user" ? "Vendedor" : "Cliente"}]: ${m.content}`)
        .join("\n");

      const evalPrompt = `Analise esta conversa de vendas e avalie o desempenho do VENDEDOR.

${activeScenario ? `Cenário: ${activeScenario.name}\nDificuldade: ${activeScenario.difficulty}\n` : ""}

Transcrição:
${transcript}

Responda APENAS em JSON válido com esta estrutura:
{
  "nota_geral": 0-100,
  "rapport": 0-100,
  "diagnostico": 0-100,
  "objecoes": 0-100,
  "cta": 0-100,
  "pontos_fortes": ["...", "..."],
  "pontos_fracos": ["...", "..."],
  "dica_principal": "Uma dica concreta e acionável para melhorar"
}

Critérios VS Growth:
- Rapport: Criou conexão genuína? Personalizou a abordagem?
- Diagnóstico: Fez perguntas que revelam gaps? Usou "como funciona hoje?"
- Objeções: Respondeu com ROI/dados? Nunca deu desconto?
- CTA: Propôs próximo passo claro? Criou urgência sem pressão?`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: evalPrompt }],
          profile: activeProfile,
          scenario: null,
        }),
      });

      if (!resp.ok) throw new Error("Erro ao avaliar");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
      }

      // Extract JSON from SSE stream
      const jsonParts: string[] = [];
      for (const line of full.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const d = line.slice(6).trim();
        if (d === "[DONE]") break;
        try {
          const parsed = JSON.parse(d);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) jsonParts.push(c);
        } catch {}
      }

      const rawJson = jsonParts.join("");
      // Extract JSON from possible markdown code block
      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Resposta inválida da IA");

      const evalData = JSON.parse(jsonMatch[0]) as ChatEvaluation;
      setEvaluation(evalData);
    } catch (err) {
      toast({ title: "Erro na avaliação", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Generate Knowledge from Evaluation ──
  const handleCreateKnowledge = async () => {
    if (!evaluation || !user) return;
    setIsSavingKnowledge(true);

    try {
      const transcript = chatMessages
        .map((m) => `[${m.role === "user" ? "Vendedor" : "Cliente"}]: ${m.content}`)
        .join("\n");

      const knowledgePrompt = `Com base nesta avaliação de treino de vendas, extraia os APRENDIZADOS-CHAVE que devem ser lembrados para melhorar futuras simulações.

Cenário: ${activeScenario?.name || "Conversa livre"}

Avaliação:
- Nota geral: ${evaluation.nota_geral}/100
- Rapport: ${evaluation.rapport} | Diagnóstico: ${evaluation.diagnostico} | Objeções: ${evaluation.objecoes} | CTA: ${evaluation.cta}
- Pontos fortes: ${evaluation.pontos_fortes.join(", ")}
- Pontos fracos: ${evaluation.pontos_fracos.join(", ")}
- Dica: ${evaluation.dica_principal}

Transcrição:
${transcript}

Responda APENAS em JSON válido:
{
  "title": "Título curto do aprendizado (max 60 chars)",
  "category": "rapport" | "diagnostico" | "objecoes" | "cta" | "geral",
  "content": "Aprendizado detalhado em 2-4 frases: o que fazer/evitar, com exemplos concretos da conversa. Escreva como instrução para a IA usar como contexto em futuras simulações."
}`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: knowledgePrompt }],
          profile: activeProfile,
          scenario: null,
        }),
      });

      if (!resp.ok) throw new Error("Erro ao gerar conhecimento");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
      }

      const jsonParts: string[] = [];
      for (const line of full.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const d = line.slice(6).trim();
        if (d === "[DONE]") break;
        try {
          const parsed = JSON.parse(d);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) jsonParts.push(c);
        } catch {}
      }

      const rawJson = jsonParts.join("");
      const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Resposta inválida da IA");

      const knowledge = JSON.parse(jsonMatch[0]);

      const { error } = await supabase.from("vendedor_knowledge" as any).insert({
        user_id: user.id,
        profile_id: activeProfile?.id || null,
        scenario_name: activeScenario?.name || "Conversa livre",
        category: knowledge.category || "geral",
        title: knowledge.title,
        content: knowledge.content,
        source_evaluation: evaluation,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["vendedor-knowledge"] });
      toast({ title: "Conhecimento salvo!", description: knowledge.title });
    } catch (err) {
      toast({ title: "Erro ao criar conhecimento", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSavingKnowledge(false);
    }
  };


  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  const scoreBarColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  // ── Render ──
  if (loadingProfiles) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Meu Vendedor</h1>
        <p className="text-sm text-muted-foreground">
          Treine suas habilidades de venda com IA — simule abordagens, calls e objeções do dia a dia
        </p>
      </div>

      <Tabs defaultValue="simulador" className="space-y-4">
        <TabsList className="w-full flex overflow-x-auto hide-scrollbar">
          <TabsTrigger value="simulador" className="flex-1 min-w-0 gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4 hidden sm:block" /> Simulador
          </TabsTrigger>
          <TabsTrigger value="cenarios" className="flex-1 min-w-0 gap-1.5 text-xs sm:text-sm">
            <Sparkles className="h-4 w-4 hidden sm:block" /> Cenários
          </TabsTrigger>
          <TabsTrigger value="perfil" className="flex-1 min-w-0 gap-1.5 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 hidden sm:block" /> Perfil
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Simulador ── */}
        <TabsContent value="simulador">
          {!activeProfile ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Configure seu perfil primeiro</p>
                <p className="text-sm">Vá na aba "Perfil" e preencha os dados da VS Growth.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
              {/* Sidebar config */}
              <div className="space-y-3">
                <Card className="h-fit">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Configuração</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cenário</Label>
                      <Select value={selectedScenario} onValueChange={(v) => { setSelectedScenario(v); resetChat(); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um cenário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Conversa livre</SelectItem>
                          {scenarios?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {activeScenario && (
                      <div className="rounded-lg bg-accent/50 p-3 space-y-1.5">
                        <p className="text-xs font-medium">{activeScenario.name}</p>
                        {activeScenario.description && (
                          <p className="text-xs text-muted-foreground">{activeScenario.description}</p>
                        )}
                        <Badge variant="outline" className={`text-xs ${DIFFICULTIES.find((d) => d.value === activeScenario.difficulty)?.color ?? ""}`}>
                          {DIFFICULTIES.find((d) => d.value === activeScenario.difficulty)?.label ?? activeScenario.difficulty}
                        </Badge>
                      </div>
                    )}

                    <Separator />

                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={resetChat}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleEvaluate}
                        disabled={isEvaluating || chatMessages.length < 4}
                      >
                        {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                        Avaliar Desempenho
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Evaluation Card */}
                {evaluation && (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary" />
                        Avaliação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-center">
                        <span className={`text-3xl font-bold ${scoreColor(evaluation.nota_geral)}`}>
                          {evaluation.nota_geral}
                        </span>
                        <span className="text-sm text-muted-foreground">/100</span>
                      </div>

                      <div className="space-y-2">
                        {[
                          { label: "Rapport", value: evaluation.rapport },
                          { label: "Diagnóstico", value: evaluation.diagnostico },
                          { label: "Objeções", value: evaluation.objecoes },
                          { label: "CTA", value: evaluation.cta },
                        ].map((item) => (
                          <div key={item.label} className="space-y-0.5">
                            <div className="flex justify-between text-xs">
                              <span>{item.label}</span>
                              <span className={scoreColor(item.value)}>{item.value}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${scoreBarColor(item.value)}`}
                                style={{ width: `${item.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {evaluation.pontos_fortes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium flex items-center gap-1 mb-1">
                            <CheckCircle2 className="h-3 w-3 text-green-400" /> Pontos fortes
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {evaluation.pontos_fortes.map((p, i) => (
                              <li key={i}>• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evaluation.pontos_fracos.length > 0 && (
                        <div>
                          <p className="text-xs font-medium flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3 w-3 text-amber-400" /> A melhorar
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {evaluation.pontos_fracos.map((p, i) => (
                              <li key={i}>• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="rounded-lg bg-primary/5 p-2.5 border border-primary/20">
                        <p className="text-xs font-medium flex items-center gap-1 mb-1">
                          <TrendingUp className="h-3 w-3 text-primary" /> Dica principal
                        </p>
                        <p className="text-xs text-muted-foreground">{evaluation.dica_principal}</p>
                      </div>

                      <Separator />

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleCreateKnowledge}
                        disabled={isSavingKnowledge}
                      >
                        {isSavingKnowledge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
                        Criar Conhecimento (RAG)
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Knowledge Base */}
                {knowledgeItems && knowledgeItems.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Conhecimento ({knowledgeItems.length})
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Aprendizados usados como contexto pela IA
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {knowledgeItems.slice(0, 5).map((k: any) => (
                            <div key={k.id} className="rounded-md border border-border p-2">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{k.category}</Badge>
                                <span className="text-xs font-medium truncate">{k.title}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{k.content}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Chat */}
              <Card className="flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: "400px" }}>
                <CardHeader className="pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      {activeScenario ? activeScenario.name : "Conversa Livre"}
                    </CardTitle>
                    {chatMessages.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {chatMessages.filter((m) => m.role === "user").length} msgs enviadas
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <Separator />

                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                      <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                      <p className="font-medium text-sm">
                        {activeScenario ? "Cenário carregado — comece sua abordagem" : "Comece a conversa"}
                      </p>
                      <p className="text-xs text-center max-w-xs mt-1">
                        Escreva sua mensagem como se estivesse mandando um WhatsApp real para o prospect.
                      </p>

                      {/* Dica do cenário */}
                      {showDica && matchingPreset?.dica && (
                        <div className="mt-4 max-w-sm rounded-lg bg-primary/5 border border-primary/20 p-3">
                          <p className="text-xs font-medium flex items-center gap-1 mb-1 text-primary">
                            <Sparkles className="h-3 w-3" /> Dica para este cenário
                          </p>
                          <p className="text-xs text-muted-foreground">{matchingPreset.dica}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted text-foreground rounded-bl-md"
                            }`}
                          >
                            {msg.content}
                            {isStreaming && i === chatMessages.length - 1 && msg.role === "assistant" && (
                              <span className="inline-block w-1.5 h-4 bg-current opacity-60 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                          </div>
                          {msg.role === "user" && (
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <Separator />

                {/* Input */}
                <div className="p-3 flex-shrink-0">
                  <div className="flex gap-2">
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleChatKeyDown}
                      placeholder="Digite sua mensagem de vendas..."
                      className="resize-none min-h-[44px] max-h-[120px]"
                      rows={1}
                      disabled={isStreaming}
                    />
                    <Button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim() || isStreaming}
                      size="icon"
                      className="h-[44px] w-[44px] flex-shrink-0"
                    >
                      {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">
                    Enter para enviar · Shift+Enter para quebrar linha
                  </p>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Cenários ── */}
        <TabsContent value="cenarios">
          {!activeProfile ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Crie seu perfil primeiro</p>
                <p className="text-sm">Preencha a aba "Perfil" para desbloquear os cenários.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Presets */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cenários Prontos</CardTitle>
                  <CardDescription>Clique para adicionar à sua lista — cada cenário já vem com persona e instruções de IA</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PRESET_SCENARIOS.map((p) => {
                      const diff = DIFFICULTIES.find((d) => d.value === p.difficulty);
                      return (
                        <button
                          key={p.name}
                          onClick={() => handleUsePreset(p)}
                          className="text-left p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{p.name}</span>
                            {diff && <Badge variant="outline" className={`text-xs ${diff.color}`}>{diff.label}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Custom + list */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Seus Cenários</h3>
                <Dialog open={scenarioDialogOpen} onOpenChange={setScenarioDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Cenário</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Novo Cenário</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateScenario} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Nome *</Label>
                        <Input name="name" required placeholder="Ex: Cliente que já usa concorrente" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Descrição do cenário</Label>
                        <Textarea name="description" placeholder="Descreva a situação de venda..." rows={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Persona do cliente</Label>
                        <Textarea
                          name="customer_persona"
                          placeholder="Quem é esse cliente? Como ele se comporta?"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Instruções extras para a IA</Label>
                        <Textarea name="system_prompt" placeholder="Instruções adicionais (opcional)" rows={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Dificuldade</Label>
                        <select
                          name="difficulty"
                          defaultValue="medio"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {DIFFICULTIES.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit" className="w-full" disabled={createScenario.isPending}>
                        {createScenario.isPending ? "Criando..." : "Criar Cenário"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {loadingScenarios ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : !scenarios?.length ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum cenário criado. Use um dos prontos acima ou crie o seu.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scenarios.map((s) => {
                    const diff = DIFFICULTIES.find((d) => d.value === s.difficulty);
                    const DiffIcon = diff?.icon ?? Target;
                    return (
                      <Card key={s.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <DiffIcon className={`h-4 w-4 ${diff?.color ?? ""}`} />
                                <span className="font-medium text-sm truncate">{s.name}</span>
                                <Badge variant="outline" className={`text-xs ${diff?.color ?? ""}`}>
                                  {diff?.label ?? s.difficulty}
                                </Badge>
                              </div>
                              {s.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                              )}
                              {s.customer_persona && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  <span className="font-medium">Persona:</span> {s.customer_persona}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteScenario.mutate(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Perfil ── */}
        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Perfil da Empresa
              </CardTitle>
              <CardDescription>
                Dados da VS Growth usados pela IA para contextualizar as simulações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="company_name">Nome da empresa *</Label>
                    <Input
                      id="company_name"
                      name="company_name"
                      required
                      defaultValue={activeProfile?.company_name ?? "VS Growth"}
                      placeholder="VS Growth"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="segment">Segmento *</Label>
                    <Input
                      id="segment"
                      name="segment"
                      required
                      defaultValue={activeProfile?.segment ?? "Consultoria de crescimento para negócios locais"}
                      placeholder="Consultoria de crescimento para negócios locais"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição do negócio</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={activeProfile?.description ?? "Consultoria que une diagnóstico estratégico + ecossistema de IA para resolver gargalos de atendimento, comercial, marketing e operação de negócios locais."}
                    placeholder="O que a VS Growth faz..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="target_audience">Público-alvo</Label>
                    <Textarea
                      id="target_audience"
                      name="target_audience"
                      defaultValue={activeProfile?.target_audience ?? "Donos de clínicas de estética, consultórios odontológicos, escritórios de advocacia e negócios locais com faturamento de R$30k-200k/mês que perdem leads por falta de processo comercial."}
                      placeholder="Quem são seus clientes ideais?"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tone_of_voice">Tom de voz</Label>
                    <Input
                      id="tone_of_voice"
                      name="tone_of_voice"
                      defaultValue={activeProfile?.tone_of_voice ?? "Direto, consultivo e orientado a dados"}
                      placeholder="Direto, consultivo e orientado a dados"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="products_services">Produtos / Serviços</Label>
                  <Textarea
                    id="products_services"
                    name="products_services"
                    defaultValue={activeProfile?.products_services ?? "1) Diagnóstico Estratégico (R$2.500-4.500, fee único) — Imersão + diagnóstico 360° + devolutiva com plano de ação\n2) Ecossistema de IA Recorrente (R$1.200-3.500/mês) — Assistente IA WhatsApp, automações, CRM, dashboards\n3) Acompanhamento Mensal — Reuniões de performance + otimização contínua"}
                    placeholder="Liste seus produtos e serviços com valores..."
                    rows={4}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="differentials">Diferenciais</Label>
                  <Textarea
                    id="differentials"
                    name="differentials"
                    defaultValue={activeProfile?.differentials ?? "• Diagnóstico antes de vender solução (não empurramos produto)\n• IA com 98,9% de assertividade (2.500+ leads processados)\n• Ecossistema completo (não é só chatbot)\n• 50% do fee do diagnóstico vira crédito no recorrente\n• ROI mensurável desde o primeiro mês"}
                    placeholder="O que diferencia a VS Growth..."
                    rows={4}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="common_objections">Objeções comuns dos clientes</Label>
                  <Textarea
                    id="common_objections"
                    name="common_objections"
                    defaultValue={activeProfile?.common_objections ?? "• 'Tá caro' → Mostrar conta de ROI: leads perdidos × ticket médio = valor mensal perdido\n• 'Já tentei automação/chatbot' → VS não é ferramenta, é ecossistema com IA contextual + acompanhamento\n• 'Preciso pensar' → Criar urgência: cada dia sem resolver = mais dinheiro perdido\n• 'Não tenho tempo' → Por isso existe o diagnóstico: nós investigamos e entregamos o plano pronto\n• 'Meu negócio é diferente' → Mostrar cases de nichos similares"}
                    placeholder="Quais objeções você mais enfrenta e como responde?"
                    rows={5}
                  />
                </div>

                <Button type="submit" disabled={saveProfile.isPending} className="gap-2">
                  {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {activeProfile ? "Atualizar Perfil" : "Criar Perfil"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
