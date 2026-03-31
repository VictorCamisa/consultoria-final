import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import type { LogEntry } from "./types";

type Props = { logs: LogEntry[] };

export default function ExecutionLog({ logs }: Props) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Log de Execução</h3>
          </div>
          {logs.length > 0 && (
            <Badge variant="secondary" className="text-xs">{logs.length} entradas</Badge>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma execução nesta sessão</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Acione um agente acima para começar</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {logs.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                {entry.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span className="font-medium text-muted-foreground shrink-0">[{entry.agent}]</span>
                <span className="flex-1 min-w-0 truncate">{entry.msg}</span>
                <span className="text-muted-foreground/50 tabular shrink-0 text-xs">
                  {entry.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
