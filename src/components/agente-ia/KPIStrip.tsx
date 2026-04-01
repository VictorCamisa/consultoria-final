import { Skeleton } from "@/components/ui/skeleton";
import { Target, Flame, Thermometer, Snowflake, Activity, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  cobertura: number;
  quentes: number;
  mornos: number;
  frios: number;
  emCadencia: number;
  novos: number;
  responderam: number;
  total: number;
  isLoading: boolean;
};

export default function KPIStrip(props: Props) {
  if (props.isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }

  const taxaResposta = props.total > 0 ? Math.round((props.responderam / props.total) * 100) : 0;

  const kpis: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    detail: ReactNode;
    accentClass: string;
    barValue?: number;
  }[] = [
    {
      icon: Target,
      label: "Cobertura IA",
      value: `${props.cobertura}%`,
      detail: <span>{props.total} prospects no total</span>,
      accentClass: "text-primary",
      barValue: props.cobertura,
    },
    {
      icon: Flame,
      label: "Temperatura",
      value: `${props.quentes + props.mornos + props.frios}`,
      detail: (
        <span className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-destructive" />
            <span className="font-semibold text-foreground">{props.quentes}</span>
            <span className="text-muted-foreground">quentes</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Thermometer className="h-3.5 w-3.5 text-warning" />
            <span className="font-semibold text-foreground">{props.mornos}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Snowflake className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{props.frios}</span>
          </span>
        </span>
      ),
      accentClass: "text-destructive",
    },
    {
      icon: Activity,
      label: "Pipeline Ativo",
      value: props.emCadencia,
      detail: <span>{props.novos} aguardando 1ª abordagem</span>,
      accentClass: "text-warning",
    },
    {
      icon: MessageSquare,
      label: "Respostas",
      value: props.responderam,
      detail: <span>{taxaResposta}% de taxa de resposta</span>,
      accentClass: "text-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border bg-card p-5 space-y-1"
        >
          {/* Label + icon */}
          <div className="flex items-center justify-between mb-2">
            <span className="vs-overline">{kpi.label}</span>
            <kpi.icon className={`h-4.5 w-4.5 ${kpi.accentClass} opacity-70`} />
          </div>

          {/* Big value */}
          <p className={`text-3xl font-bold tabular leading-none tracking-tight ${kpi.accentClass}`}>
            {kpi.value}
          </p>

          {/* Sub-detail */}
          <div className="text-xs text-muted-foreground pt-1">{kpi.detail}</div>

          {/* Progress bar */}
          {kpi.barValue !== undefined && (
            <div className="pt-2">
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${kpi.barValue}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
