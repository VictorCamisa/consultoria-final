import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Prospect = Tables<"consultoria_prospects">;
export type ProspectInsert = TablesInsert<"consultoria_prospects">;
export type Conversa = Tables<"consultoria_conversas">;
export type Cadencia = Tables<"consultoria_cadencia">;

export const PIPELINE_STAGES = [
  { key: "novo", label: "Novo", color: "bg-slate-500" },
  { key: "abordado", label: "Abordado", color: "bg-blue-500" },
  { key: "em_cadencia", label: "Em Cadência", color: "bg-indigo-500" },
  { key: "respondeu", label: "Respondeu", color: "bg-amber-500" },
  { key: "quente", label: "Quente", color: "bg-red-500" },
  { key: "call_agendada", label: "Call Agendada", color: "bg-purple-500" },
  { key: "call_realizada", label: "Call Realizada", color: "bg-violet-500" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "bg-emerald-500" },
  { key: "fechado", label: "Fechado", color: "bg-green-600" },
  { key: "aguardando_humano", label: "Aguardando Humano", color: "bg-orange-500" },
  { key: "frio", label: "Frio", color: "bg-cyan-500" },
  { key: "blacklist", label: "Blacklist", color: "bg-gray-500" },
] as const;

export const NICHOS = ["Estética", "Odonto", "Advocacia", "Revendas de Veículos"] as const;

export const classificacaoConfig = (c: string | null) => {
  if (c === "quente") return { label: "Quente", color: "text-red-600", bg: "bg-red-50 border-red-200 text-red-700", icon: "🔥" };
  if (c === "morno") return { label: "Morno", color: "text-amber-600", bg: "bg-amber-50 border-amber-200 text-amber-700", icon: "🌡️" };
  if (c === "frio") return { label: "Frio", color: "text-blue-600", bg: "bg-blue-50 border-blue-200 text-blue-700", icon: "❄️" };
  return { label: "—", color: "text-muted-foreground", bg: "bg-muted text-muted-foreground", icon: "" };
};

export const scoreColor = (score: number | null) => {
  if (!score) return "text-muted-foreground";
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-warning";
  return "text-primary";
};

export function timeAgo(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days}d`;
}
