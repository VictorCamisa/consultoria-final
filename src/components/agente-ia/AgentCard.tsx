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
    <div className={`rounded-lg border bg-card p-5 space-y-4 transition-all duration-200 ${isActive ? "ring-2 ring-primary/30 border-primary/20" : ""}`}>
      {/* Header: icon + title + badge */}
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg bg-gradient-to-br ${agent.gradient} border border-border/50 shrink-0`}>
          <agent.icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate">{agent.title}</h3>
            {isActive && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 animate-pulse shrink-0">
                Ativo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{agent.description}</p>
        </div>
      </div>

      {/* Stats — compact inline */}
      <div className="flex gap-2">
        {agent.stats.map(s => (
          <div key={s.label} className="flex-1 text-center rounded-md bg-muted/50 border border-border/40 py-2 px-2">
            <p className="text-lg font-bold tabular text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {showProgress && isActive && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Processando...</span>
            <span className="tabular font-semibold text-foreground">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>
      )}

      {/* Action */}
      {agent.action ? (
        <div className="flex gap-2">
          <Button
            disabled={agent.disabled}
            onClick={() => onAction(agent.id)}
            className="flex-1 h-9 text-xs font-semibold"
            variant={isActive ? "secondary" : "default"}
            size="sm"
          >
            {isActive ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isActive ? "Processando..." : agent.action}
          </Button>
          {cancellable && isActive && onCancel && (
            <Button
              variant="destructive"
              onClick={() => onCancel(agent.id)}
              className="h-9 px-3"
              size="sm"
              title="Cancelar"
            >
              <StopCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
          <Sparkles className="h-3.5 w-3.5 text-warning" />
          Disponível no módulo Comercial
        </div>
      )}
    </div>
  );
}
