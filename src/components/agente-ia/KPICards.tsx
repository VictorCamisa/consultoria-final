import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Flame, Activity, TrendingUp } from "lucide-react";

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
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-16 mb-2" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export default function KPICards(props: Props) {
  if (props.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Target className="h-5 w-5 text-primary" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cobertura IA</span>
          </div>
          <p className="text-3xl font-bold tabular">{props.cobertura}<span className="text-lg text-muted-foreground ml-0.5">%</span></p>
          <Progress value={props.cobertura} className="mt-3 h-1.5" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Flame className="h-5 w-5 text-destructive" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Quentes</span>
          </div>
          <p className="text-3xl font-bold tabular text-destructive">{props.quentes}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{props.mornos} mornos · {props.frios} frios</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Em Cadência</span>
          </div>
          <p className="text-3xl font-bold tabular text-primary">{props.emCadencia}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{props.novos} aguardando abordagem</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Responderam</span>
          </div>
          <p className="text-3xl font-bold tabular text-success">{props.responderam}</p>
          <p className="text-xs text-muted-foreground mt-1.5">de {props.total} prospects</p>
        </CardContent>
      </Card>
    </div>
  );
}
