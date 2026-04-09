import { Prospect } from "./types";
import { PIPELINE_STAGES } from "./types";
import { Users, Flame, RefreshCw, MessageSquare, CalendarCheck, Trophy, Send, Phone, FileText, UserCheck, Snowflake, Ban } from "lucide-react";

interface Props {
  prospects: Prospect[] | undefined;
  onStageClick?: (stageKey: string) => void;
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  novo: Users,
  abordado: Send,
  em_cadencia: RefreshCw,
  respondeu: MessageSquare,
  quente: Flame,
  call_agendada: CalendarCheck,
  call_realizada: Phone,
  proposta_enviada: FileText,
  fechado: Trophy,
  aguardando_humano: UserCheck,
  frio: Snowflake,
  blacklist: Ban,
};

const STAGE_ACCENTS: Record<string, string> = {
  novo: "bg-slate-500/15 text-slate-400",
  abordado: "bg-blue-500/15 text-blue-400",
  em_cadencia: "bg-indigo-500/15 text-indigo-400",
  respondeu: "bg-amber-500/15 text-amber-400",
  quente: "bg-red-500/15 text-red-400",
  call_agendada: "bg-purple-500/15 text-purple-400",
  call_realizada: "bg-violet-500/15 text-violet-400",
  proposta_enviada: "bg-emerald-500/15 text-emerald-400",
  fechado: "bg-green-500/15 text-green-400",
  aguardando_humano: "bg-orange-500/15 text-orange-400",
  frio: "bg-cyan-500/15 text-cyan-400",
  blacklist: "bg-gray-500/15 text-gray-400",
};

export function PipelineStats({ prospects, onStageClick }: Props) {
  const total = prospects?.length ?? 0;

  const stageCounts = PIPELINE_STAGES.map(stage => ({
    key: stage.key,
    label: stage.label,
    count: prospects?.filter(p => p.status === stage.key).length ?? 0,
  }));

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
      {/* Total */}
      <div className="bg-background rounded-lg border border-border p-2.5 sm:p-3 text-center min-w-[90px] shrink-0">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mx-auto mb-1.5 sm:mb-2 bg-foreground/5 text-foreground">
          <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </div>
        <p className="text-lg sm:text-xl font-bold tabular text-foreground">{total}</p>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Total</p>
      </div>

      {stageCounts.map(s => {
        const Icon = STAGE_ICONS[s.key] ?? Users;
        const accent = STAGE_ACCENTS[s.key] ?? "bg-foreground/5 text-foreground";
        return (
          <div
            key={s.key}
            onClick={() => onStageClick?.(s.key)}
            className="bg-background rounded-lg border border-border p-2.5 sm:p-3 text-center min-w-[90px] shrink-0 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mx-auto mb-1.5 sm:mb-2 ${accent}`}>
              <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
            <p className="text-lg sm:text-xl font-bold tabular text-foreground">{s.count}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}
