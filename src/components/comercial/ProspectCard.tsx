import { Prospect, classificacaoConfig, scoreColor, timeAgo, nichoCategory, PIPELINE_STAGES } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, Phone, Megaphone, PlayCircle, RotateCcw, Loader2, Trash2, AlertTriangle, ArrowRightLeft,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  onDelete?: () => void;
}

export function ProspectCard({
  prospect: p, unread, loadingAbordar, loadingCadencia, loadingReativar,
  onSelect, onAbordar, onCadencia, onReativar, onDelete,
}: Props) {
  const classif = classificacaoConfig(p.classificacao_ia);
  const nichoCat = nichoCategory(p.nicho);
  return (
    <div
      className="group bg-background rounded-lg border border-border hover:border-primary/30 p-3.5 space-y-3 cursor-pointer transition-all duration-150 hover:shadow-sm"
      onClick={onSelect}
    >
      {/* Row 1: Name + Score */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
            {p.nome_negocio}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
            {p.cidade}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.classificacao_ia && (
            <span className="text-sm leading-none">{classif.icon}</span>
          )}
          {p.score_qualificacao !== null && (
            <span className={`text-xs font-bold tabular leading-none ${scoreColor(p.score_qualificacao)}`}>
              {p.score_qualificacao}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Badges */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Badge variant="outline" className={`text-[10px] h-[18px] px-1.5 font-medium max-w-[140px] truncate shrink-0 ${nichoCat ? nichoCat.color : "border-border"}`}>
          {nichoCat?.label ?? p.nicho}
        </Badge>
        {p.status === "em_cadencia" && p.dia_cadencia !== null && (
          <Badge variant="secondary" className="text-[10px] h-[18px] px-1.5 shrink-0">
            D{p.dia_cadencia}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto tabular leading-none shrink-0">
          {timeAgo(p.data_ultima_interacao)}
        </span>
      </div>

      {/* Row 3: WhatsApp */}
      <div className="flex items-center gap-1.5">
        <a
          href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1.5 text-[11px] transition-colors ${(p as any).whatsapp_valido === false ? "text-destructive/70 hover:text-destructive line-through" : "text-primary/70 hover:text-primary"}`}
          onClick={e => e.stopPropagation()}
        >
          <Phone className="h-3 w-3 shrink-0" />
          <span className="truncate">{p.whatsapp}</span>
        </a>
        {(p as any).whatsapp_valido === false && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Número não encontrado no WhatsApp
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Row 4: Resumo (if exists) */}
      {p.resumo_conversa && (
        <p className="text-[11px] text-muted-foreground/80 italic line-clamp-2 leading-relaxed border-l-2 border-border pl-2">
          {p.resumo_conversa}
        </p>
      )}

      {/* Row 5: Actions */}
      <div className="flex gap-1.5 pt-0.5" onClick={e => e.stopPropagation()}>
        <Button
          size="sm"
          variant={unread > 0 ? "default" : "outline"}
          className="text-[11px] h-7 px-2.5 flex-1"
          onClick={onSelect}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Chat
          {unread > 0 && (
            <span className="ml-1 bg-destructive text-destructive-foreground rounded-full text-[9px] min-w-[16px] h-4 px-1 flex items-center justify-center font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>

        {p.status === "novo" && (
          <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5" onClick={onAbordar} disabled={loadingAbordar}>
            {loadingAbordar ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Megaphone className="h-3 w-3 mr-1" />Abordar</>}
          </Button>
        )}

        {["abordado", "respondeu"].includes(p.status) && (
          <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5" onClick={onCadencia} disabled={loadingCadencia}>
            {loadingCadencia ? <Loader2 className="h-3 w-3 animate-spin" /> : <><PlayCircle className="h-3 w-3 mr-1" />Cadência</>}
          </Button>
        )}

        {p.status === "frio" && (
          <Button size="sm" variant="outline" className="text-[11px] h-7 px-2.5" onClick={onReativar} disabled={loadingReativar}>
            {loadingReativar ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCcw className="h-3 w-3 mr-1" />Reativar</>}
          </Button>
        )}

        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-[11px] h-7 w-7 px-0 ml-auto text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Excluir prospect"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
