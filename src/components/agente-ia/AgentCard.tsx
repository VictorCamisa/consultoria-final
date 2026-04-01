import { Card, CardContent } from "@/components/ui/card";
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
  const isDisabled = agent.disabled && !isActive;

  return (
    <Card className={`border overflow-hidden transition-all duration-200 ${isActive ? "ring-2 ring-primary/30" : ""}`}>
      <CardContent className="p-0">
        <div className="p-6 space-y-5">
          {/* Header row: icon + title + status badge */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${agent.gradient} border shrink-0`}>
              <agent.icon className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base leading-tight">{agent.title}</h3>
                {isActive && (
                  <Badge variant="default" className="text-[11px] px-2 py-0 h-5 animate-pulse">
                    Executando
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3">
            {agent.stats.map(s => (
              <div key={s.label} className="bg-muted/50 rounded-lg px-4 py-3 flex-1 text-center border border-border/50">
                <p className="text-2xl font-bold tabular text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar — only while running */}
          {showProgress && isActive && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Processando...</span>
                <span className="tabular font-semibold text-foreground">{progresso}%</span>
              </div>
              <Progress value={progresso} className="h-2.5" />
            </div>
          )}

          {/* Action button */}
          {agent.action ? (
            <div className="flex gap-2 pt-1">
              <Button
                disabled={agent.disabled}
                onClick={() => onAction(agent.id)}
                className="flex-1 h-11 text-sm font-semibold"
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
                  className="h-11 px-4"
                  title="Cancelar execução"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1 border-t border-border/50 mt-2 pt-3">
              <Sparkles className="h-4 w-4 text-warning" />
              Disponível individualmente no módulo Comercial
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
