import { Skeleton } from "@/components/ui/skeleton";
import { Target, Flame, Thermometer, Snowflake, Activity, MessageSquare } from "lucide-react";

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
    );
  }

  const taxaResposta = props.total > 0 ? Math.round((props.responderam / props.total) * 100) : 0;

  const kpis = [
    {
      icon: Target,
      label: "Cobertura IA",
      value: `${props.cobertura}%`,
      detail: `${props.total} total`,
      accent: "text-primary",
      bar: props.cobertura,
    },
    {
      icon: Flame,
      label: "Temperatura",
      value: props.quentes,
      detail: (
        <span className="flex items-center gap-2">
          <Flame className="h-3 w-3 text-destructive" />{props.quentes}
          <Thermometer className="h-3 w-3 text-warning" />{props.mornos}
          <Snowflake className="h-3 w-3 text-primary" />{props.frios}
        </span>
      ),
      accent: "text-destructive",
    },
    {
      icon: Activity,
      label: "Pipeline",
      value: props.emCadencia,
      detail: `${props.novos} aguardando`,
      accent: "text-primary",
    },
    {
      icon: MessageSquare,
      label: "Respostas",
      value: props.responderam,
      detail: `${taxaResposta}% taxa`,
      accent: "text-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-lg border bg-card p-4 space-y-2">
          {/* Label row */}
          <div className="flex items-center gap-2">
            <kpi.icon className={`h-3.5 w-3.5 ${kpi.accent}`} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {kpi.label}
            </span>
          </div>

          {/* Value */}
          <p className={`text-2xl font-bold tabular leading-none ${kpi.accent}`}>
            {kpi.value}
          </p>

          {/* Detail */}
          <div className="text-xs text-muted-foreground">{kpi.detail}</div>

          {/* Optional bar */}
          {kpi.bar !== undefined && (
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${kpi.bar}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
