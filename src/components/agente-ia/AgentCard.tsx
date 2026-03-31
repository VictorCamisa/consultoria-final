import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, PlayCircle, Sparkles, StopCircle } from "lucide-react";
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
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className={`bg-gradient-to-br ${agent.gradient} p-6 space-y-5`}>
          {/* Agent header */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-card shadow-sm border">
              <agent.icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-base">{agent.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{agent.description}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3">
            {agent.stats.map(s => (
              <div key={s.label} className="bg-card/80 backdrop-blur rounded-lg border px-4 py-3 flex-1 text-center">
                <p className="text-xl font-bold tabular">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {showProgress && agent.loading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processando...</span>
                <span className="tabular">{progresso}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
          )}

          {/* Action button */}
          {agent.action ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={agent.disabled}
                onClick={() => onAction(agent.id)}
                className="flex-1 h-10 text-sm"
              >
                {agent.loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                {agent.loading ? "Processando..." : agent.action}
              </Button>
              {cancellable && agent.loading && onCancel && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onCancel(agent.id)}
                  className="h-10 px-3"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Disponível individualmente no módulo Comercial
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
