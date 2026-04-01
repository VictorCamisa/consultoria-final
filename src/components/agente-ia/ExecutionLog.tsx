import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { LogEntry } from "./types";

type Props = { logs: LogEntry[] };

export default function ExecutionLog({ logs }: Props) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Log</span>
        </div>
        {logs.length > 0 && (
          <Badge variant="secondary" className="text-[10px] tabular h-5 px-1.5">{logs.length}</Badge>
        )}
      </div>

      {/* Content */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <Clock className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Sem execuções</p>
          <p className="text-xs text-muted-foreground/70 mt-1 text-center">
            Acione um agente para ver os resultados aqui
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border/50">
            {logs.map(entry => (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors text-xs"
              >
                {entry.status === "ok" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{entry.agent}</span>
                    <span className="text-muted-foreground/60 tabular">
                      {entry.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate mt-0.5">{entry.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
