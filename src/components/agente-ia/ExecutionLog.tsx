import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { LogEntry } from "./types";

type Props = { logs: LogEntry[] };

export default function ExecutionLog({ logs }: Props) {
  return (
    <Card className="border">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-muted">
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Log de Execução</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Sessão atual</p>
            </div>
          </div>
          {logs.length > 0 && (
            <Badge variant="secondary" className="text-xs tabular">{logs.length} entradas</Badge>
          )}
        </div>

        {/* Content */}
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-lg bg-muted/30">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma execução nesta sessão</p>
            <p className="text-sm text-muted-foreground mt-1">Acione um agente para ver os resultados aqui</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="space-y-1">
              {logs.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 text-sm py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {entry.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 shrink-0 font-medium">
                    {entry.agent}
                  </Badge>
                  <span className="flex-1 min-w-0 truncate text-foreground">{entry.msg}</span>
                  <span className="text-xs text-muted-foreground tabular shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    {entry.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
