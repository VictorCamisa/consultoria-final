import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

function KPISkeleton() {
  return (
    <Card className="border">
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-10 w-20 mb-3" />
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

export default function KPICards(props: Props) {
  if (props.isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
      </div>
    );
  }

  const kpis = [
    {
      icon: Target,
      label: "Cobertura IA",
      value: `${props.cobertura}%`,
      sub: `${props.total} prospects no total`,
      color: "text-primary",
      bgColor: "surface-info",
      progress: props.cobertura,
    },
    {
      icon: Flame,
      label: "Classificação",
      value: props.quentes,
      sub: (
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Thermometer className="h-3 w-3 text-warning" />
            {props.mornos}
          </span>
          <span className="flex items-center gap-1">
            <Snowflake className="h-3 w-3 text-primary" />
            {props.frios}
          </span>
        </span>
      ),
      color: "text-destructive",
      bgColor: "surface-danger",
      highlight: `${props.quentes} quentes`,
    },
    {
      icon: Activity,
      label: "Pipeline Ativo",
      value: props.emCadencia,
      sub: `${props.novos} aguardando 1ª abordagem`,
      color: "text-primary",
      bgColor: "surface-info",
    },
    {
      icon: MessageSquare,
      label: "Responderam",
      value: props.responderam,
      sub: props.total > 0
        ? `${Math.round((props.responderam / props.total) * 100)}% de taxa de resposta`
        : "Nenhum prospect ainda",
      color: "text-success",
      bgColor: "surface-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border overflow-hidden">
          <CardContent className="p-0">
            {/* Top accent bar */}
            <div className={`h-1 w-full ${kpi.bgColor}`} />
            <div className="p-5 space-y-3">
              {/* Label + Icon */}
              <div className="flex items-center justify-between">
                <span className="vs-overline">{kpi.label}</span>
                <div className={`p-1.5 rounded-md ${kpi.bgColor}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>

              {/* Value */}
              <p className={`text-3xl font-bold tabular ${kpi.color}`}>
                {kpi.value}
              </p>

              {/* Sub info */}
              <div className="text-sm text-muted-foreground">
                {kpi.sub}
              </div>

              {/* Optional progress */}
              {kpi.progress !== undefined && (
                <Progress value={kpi.progress} className="h-1.5" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
