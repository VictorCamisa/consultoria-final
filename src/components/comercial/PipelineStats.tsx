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
  novo: "bg-slate-100 text-slate-600",
  abordado: "bg-blue-50 text-blue-600",
  em_cadencia: "bg-indigo-50 text-indigo-600",
  respondeu: "bg-amber-50 text-amber-600",
  quente: "bg-red-50 text-red-600",
  call_agendada: "bg-purple-50 text-purple-600",
  call_realizada: "bg-violet-50 text-violet-600",
  proposta_enviada: "bg-emerald-50 text-emerald-600",
  fechado: "bg-green-50 text-green-600",
  aguardando_humano: "bg-orange-50 text-orange-600",
  frio: "bg-cyan-50 text-cyan-600",
  blacklist: "bg-gray-100 text-gray-500",
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
