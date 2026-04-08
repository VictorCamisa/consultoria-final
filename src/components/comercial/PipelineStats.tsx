import { Prospect } from "./types";
import { Users, Flame, RefreshCw, MessageSquare, CalendarCheck, Trophy } from "lucide-react";

interface Props {
  prospects: Prospect[] | undefined;
}

export function PipelineStats({ prospects }: Props) {
  const total = prospects?.length ?? 0;
  const novos = prospects?.filter(p => p.status === "novo").length ?? 0;
  const quentes = prospects?.filter(p => p.classificacao_ia === "quente").length ?? 0;
  const emCadencia = prospects?.filter(p => p.status === "em_cadencia").length ?? 0;
  const responderam = prospects?.filter(p => p.status === "respondeu" || p.status === "quente").length ?? 0;
  const callsAgendadas = prospects?.filter(p => p.status === "call_agendada").length ?? 0;
  const fechados = prospects?.filter(p => p.status === "fechado").length ?? 0;

  const stats = [
    { label: "Total", value: total, icon: Users, accent: "bg-foreground/5 text-foreground" },
    { label: "Novos", value: novos, icon: Users, accent: "bg-primary/15 text-primary" },
    { label: "Quentes", value: quentes, icon: Flame, accent: "bg-red-500/15 text-red-400" },
    { label: "Cadência", value: emCadencia, icon: RefreshCw, accent: "bg-violet-500/15 text-violet-400" },
    { label: "Responderam", value: responderam, icon: MessageSquare, accent: "bg-amber-500/15 text-amber-400" },
    { label: "Calls", value: callsAgendadas, icon: CalendarCheck, accent: "bg-purple-500/15 text-purple-400" },
    { label: "Fechados", value: fechados, icon: Trophy, accent: "bg-emerald-500/15 text-emerald-400" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar sm:grid sm:grid-cols-7 sm:overflow-visible">
      {stats.map(s => (
        <div key={s.label} className="bg-background rounded-lg border border-border p-2.5 sm:p-3 text-center min-w-[90px] sm:min-w-0 shrink-0">
          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mx-auto mb-1.5 sm:mb-2 ${s.accent}`}>
            <s.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-bold tabular text-foreground">{s.value}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
