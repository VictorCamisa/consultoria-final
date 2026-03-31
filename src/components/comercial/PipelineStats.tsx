import { Prospect, PIPELINE_STAGES } from "./types";
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
    { label: "Total", value: total, icon: Users, color: "text-foreground" },
    { label: "Novos", value: novos, icon: Users, color: "text-primary" },
    { label: "Quentes", value: quentes, icon: Flame, color: "text-red-500" },
    { label: "Em Cadência", value: emCadencia, icon: RefreshCw, color: "text-indigo-500" },
    { label: "Responderam", value: responderam, icon: MessageSquare, color: "text-amber-500" },
    { label: "Calls", value: callsAgendadas, icon: CalendarCheck, color: "text-purple-500" },
    { label: "Fechados", value: fechados, icon: Trophy, color: "text-green-600" },
  ];

  return (
    <div className="grid grid-cols-7 gap-2">
      {stats.map(s => (
        <div key={s.label} className="bg-card rounded-lg border p-3 text-center">
          <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
          <p className="text-xl font-bold tabular">{s.value}</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
