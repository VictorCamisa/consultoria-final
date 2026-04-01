import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, StopCircle, Sparkles } from "lucide-react";
import type { AgentConfig } from "./types";

type Props = {
  agent: AgentConfig;
  onAction: (id: string) => void;
  onCancel?: (id: string) => void;
  progresso?: number;
  showProgress?: boolean;
  cancellable?: boolean;
};

export default function AgentCard({ agent, onAction, onCancel, progresso = 0, showProgress, cancellable }: Props) {
  const isActive = agent.loading;

  return (
    <div
      className={[
        "rounded-xl border bg-card p-6 flex flex-col gap-5 transition-all duration-200",
        isActive ? "ring-2 ring-primary/40 border-primary/30 shadow-md" : "hover:border-border/80",
      ].join(" ")}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3.5">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${agent.gradient} border border-border shrink-0`}>
          <agent.icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="vs-h3 truncate">{agent.title}</h3>
            {isActive && (
              <Badge variant="default" className="text-[10px] px-2 py-0.5 h-[18px] animate-pulse shrink-0 font-semibold">
                Ativo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="flex gap-2.5">
        {agent.stats.map(s => (
          <div
            key={s.label}
            className="flex-1 text-center rounded-lg border border-border bg-secondary/50 py-3 px-2"
          >
            <p className="text-xl font-bold tabular text-foreground leading-none">{s.value}</p>
            <p className="vs-overline mt-1.5 text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Progress ── */}
      {showProgress && isActive && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">Processando...</span>
            <span className="text-xs tabular font-bold text-foreground">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>
      )}

      {/* ── Action ── */}
      <div className="mt-auto">
        {agent.action ? (
          <div className="flex gap-2.5">
            <Button
              disabled={agent.disabled}
              onClick={() => onAction(agent.id)}
              className="flex-1 h-10 text-sm font-semibold"
              variant={isActive ? "secondary" : "default"}
            >
              {isActive ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isActive ? "Processando..." : agent.action}
            </Button>
            {cancellable && isActive && onCancel && (
              <Button
                variant="destructive"
                onClick={() => onCancel(agent.id)}
                className="h-10 w-10 p-0 shrink-0"
                title="Cancelar execução"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-4">
            <Sparkles className="h-4 w-4 text-warning shrink-0" />
            <span>Disponível individualmente no módulo Comercial</span>
          </div>
        )}
      </div>
    </div>
  );
}
