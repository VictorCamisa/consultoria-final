import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Target, Calendar, DollarSign, Car } from "lucide-react";

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 bg-card ${accent ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${accent ? "bg-primary/10" : "bg-secondary"}`}>
          <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function VSAutoMetrics() {
  const { data: metrics } = useQuery({
    queryKey: ["vs-auto-metrics"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: prospects } = await supabase
        .from("consultoria_prospects")
        .select("id, status, created_at, classificacao_ia, nicho")
        .or("nicho.ilike.%revenda%,nicho.ilike.%veículo%,nicho.ilike.%auto%,nicho.ilike.%seminov%");

      const all = prospects || [];
      const mapeadosSemana = all.filter(
        (p) => p.created_at && p.created_at > weekAgo
      ).length;

      const reunioes = all.filter((p) =>
        ["call_agendada", "call_realizada"].includes(p.status)
      ).length;

      const emNegociacao = all.filter((p) =>
        ["quente", "call_agendada", "call_realizada", "proposta_enviada"].includes(p.status)
      );

      const mrrNegociacao = emNegociacao.reduce(
        (sum, p) => sum + ((p as any).mrr_estimado || 1497),
        0
      );

      const fechados = all.filter((p) => p.status === "fechado").length;

      const responderam = all.filter((p) =>
        !["novo", "abordado", "blacklist"].includes(p.status)
      ).length;
      const abordados = all.filter((p) => p.status !== "novo").length;
      const taxaResposta =
        abordados > 0 ? Math.round((responderam / abordados) * 100) : 0;

      return {
        mapeadosSemana,
        reunioes,
        mrrNegociacao,
        fechados,
        taxaResposta,
        total: all.length,
        emNegociacao: emNegociacao.length,
      };
    },
  });

  if (!metrics) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Car className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">VS AUTO — Pipeline Comercial</h3>
        <span className="text-xs text-muted-foreground">
          {metrics.total} lojas no CRM
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={TrendingUp}
          label="Mapeadas esta semana"
          value={metrics.mapeadosSemana}
          sub="Meta: 20/semana"
        />
        <MetricCard
          icon={Calendar}
          label="Reuniões ativas"
          value={metrics.reunioes}
          sub="Agendadas + realizadas"
          accent={metrics.reunioes >= 3}
        />
        <MetricCard
          icon={DollarSign}
          label="MRR em negociação"
          value={`R$${(metrics.mrrNegociacao / 1000).toFixed(1)}k`}
          sub={`${metrics.emNegociacao} oportunidades`}
          accent
        />
        <MetricCard
          icon={Target}
          label="Taxa de resposta"
          value={`${metrics.taxaResposta}%`}
          sub={`${metrics.fechados} fechados total`}
        />
      </div>
    </div>
  );
}
