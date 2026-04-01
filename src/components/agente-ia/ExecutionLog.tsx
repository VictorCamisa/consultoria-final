import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { LogEntry } from "./types";

type Props = { logs: LogEntry[] };

export default function ExecutionLog({ logs }: Props) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="vs-h3">Log de Execução</h3>
        </div>
        {logs.length > 0 && (
          <Badge variant="secondary" className="text-[10px] tabular h-5 px-2 font-semibold">
            {logs.length}
          </Badge>
        )}
      </div>

      {/* Content */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="p-3.5 rounded-full bg-muted mb-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sem execuções</p>
          <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-[200px]">
            Acione um agente para ver os resultados aqui
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[420px]">
          <div className="divide-y divide-border">
            {logs.map(entry => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
              >
                {entry.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{entry.agent}</span>
                    <span className="text-[10px] text-muted-foreground tabular">
                      {entry.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 leading-relaxed">{entry.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
