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
    <div className="grid grid-cols-7 gap-2">
      {stats.map(s => (
        <div key={s.label} className="bg-background rounded-lg border border-border p-3 text-center">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center mx-auto mb-2 ${s.accent}`}>
            <s.icon className="h-3.5 w-3.5" />
          </div>
          <p className="text-xl font-bold tabular text-foreground">{s.value}</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
