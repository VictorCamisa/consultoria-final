import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Bell, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { Prospect, nichoCategory } from "./types";

interface Props {
  prospects: Prospect[];
  unreadCounts: Record<string, number>;
  onSelectProspect: (prospect: Prospect) => void;
}

export function UnreadNotifications({ prospects, unreadCounts, onSelectProspect }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const unreadProspects = prospects
    .filter(p => (unreadCounts[p.id] ?? 0) > 0 && !dismissed.has(p.id))
    .sort((a, b) => (unreadCounts[b.id] ?? 0) - (unreadCounts[a.id] ?? 0));

  const totalUnread = unreadProspects.reduce((sum, p) => sum + (unreadCounts[p.id] ?? 0), 0);

  if (unreadProspects.length === 0) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-primary">
          <Bell className="h-4 w-4" />
          <span className="text-xs font-semibold">
            {totalUnread} mensage{totalUnread === 1 ? "m" : "ns"} nova{totalUnread === 1 ? "" : "s"}
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-[18px] px-1.5">
          {unreadProspects.length} lead{unreadProspects.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-2">
          {unreadProspects.map(p => {
            const nichoCat = nichoCategory(p.nicho);
            const count = unreadCounts[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="group relative flex items-center gap-2 bg-background border border-border hover:border-primary/40 rounded-lg px-3 py-2 cursor-pointer transition-all shrink-0 min-w-[200px] max-w-[280px]"
                onClick={() => onSelectProspect(p)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate">
                    {p.nome_negocio}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] px-1 rounded ${nichoCat?.color ?? "text-muted-foreground"}`}>
                      {nichoCat?.label ?? p.nicho}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{p.cidade}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-[11px] font-bold tabular">{count}</span>
                  </div>
                </div>
                <button
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => {
                    e.stopPropagation();
                    setDismissed(prev => new Set(prev).add(p.id));
                  }}
                >
                  <X className="h-2.5 w-2.5 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
