import { Prospect, classificacaoConfig, scoreColor, timeAgo } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Phone, Megaphone, PlayCircle, RotateCcw, Loader2,
} from "lucide-react";

interface Props {
  prospect: Prospect;
  unread: number;
  loadingAbordar: boolean;
  loadingCadencia: boolean;
  loadingReativar: boolean;
  onSelect: () => void;
  onAbordar: () => void;
  onCadencia: () => void;
  onReativar: () => void;
}

export function ProspectCard({
  prospect: p, unread, loadingAbordar, loadingCadencia, loadingReativar,
  onSelect, onAbordar, onCadencia, onReativar,
}: Props) {
  const classif = classificacaoConfig(p.classificacao_ia);

  return (
    <div
      className="group bg-card rounded-lg border p-3 space-y-2.5 card-interactive"
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{p.nome_negocio}</p>
          <p className="text-[11px] text-muted-foreground">{p.cidade}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {p.classificacao_ia && (
            <span className={`text-xs font-medium ${classif.color}`}>
              {classif.icon}
            </span>
          )}
          {p.score_qualificacao !== null && (
            <span className={`text-xs font-bold tabular ${scoreColor(p.score_qualificacao)}`}>
              {p.score_qualificacao}
            </span>
          )}
        </div>
      </div>

      {/* Meta line */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
          {p.nicho}
        </Badge>
        {p.status === "em_cadencia" && p.dia_cadencia !== null && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            D{p.dia_cadencia}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto tabular">
          {timeAgo(p.data_ultima_interacao)}
        </span>
      </div>

      {/* WhatsApp link */}
      <a
        href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-primary/80 flex items-center gap-1 hover:text-primary transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <Phone className="h-3 w-3" />{p.whatsapp}
      </a>

      {/* Resumo */}
      {p.resumo_conversa && (
        <p className="text-[11px] text-muted-foreground italic line-clamp-2 leading-relaxed">
          "{p.resumo_conversa}"
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-0.5" onClick={e => e.stopPropagation()}>
        <Button
          size="sm"
          variant={unread > 0 ? "default" : "ghost"}
          className="text-[11px] h-7 px-2 flex-1"
          onClick={onSelect}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Chat
          {unread > 0 && (
            <span className="ml-1 bg-destructive text-destructive-foreground rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>

        {p.status === "novo" && (
          <Button size="sm" variant="ghost" className="text-[11px] h-7 px-2" onClick={onAbordar} disabled={loadingAbordar}>
            {loadingAbordar ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Megaphone className="h-3 w-3 mr-1" />Abordar</>}
          </Button>
        )}

        {["abordado", "respondeu"].includes(p.status) && (
          <Button size="sm" variant="ghost" className="text-[11px] h-7 px-2" onClick={onCadencia} disabled={loadingCadencia}>
            {loadingCadencia ? <Loader2 className="h-3 w-3 animate-spin" /> : <><PlayCircle className="h-3 w-3 mr-1" />Cadência</>}
          </Button>
        )}

        {p.status === "frio" && (
          <Button size="sm" variant="ghost" className="text-[11px] h-7 px-2" onClick={onReativar} disabled={loadingReativar}>
            {loadingReativar ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3 mr-1" />Reativar</>}
          </Button>
        )}
      </div>
    </div>
  );
}
