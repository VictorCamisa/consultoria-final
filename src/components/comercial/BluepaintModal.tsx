import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, MessageSquare, CheckCircle2, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Prospect } from "./types";

interface Kit {
  headline: string;
  confronto_financeiro: string;
  objecoes: { objecao: string; resposta: string }[];
  proximo_passo: string;
  script_whatsapp: string;
}

interface Props {
  prospect: Prospect;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handle}>
      {copied ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

const EVOLUTION_INSTANCE = "victorcomercial";

export function BluepaintModal({ prospect, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [kit, setKit] = useState<Kit | null>(null);
  const [sendingWA, setSendingWA] = useState(false);

  const generate = async () => {
    setLoading(true);
    setKit(null);
    try {
      const { data, error } = await supabase.functions.invoke("bluepaint", {
        body: { prospect_id: prospect.id },
      });
      if (error) throw error;
      if (data?.kit) setKit(data.kit);
    } catch (err: unknown) {
      toast({ title: "Erro ao gerar Bluepaint", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendViaWhatsApp = async () => {
    if (!kit?.script_whatsapp) return;
    setSendingWA(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { prospect_id: prospect.id, mensagem: kit.script_whatsapp },
      });
      if (error) throw error;
      if (data?.success) toast({ title: "Mensagem enviada pelo WhatsApp!" });
    } catch (err: unknown) {
      toast({ title: "Erro ao enviar", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSendingWA(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Bluepaint — Kit de Vendas IA
            <Badge variant="outline" className="text-xs ml-2">{prospect.nome_negocio}</Badge>
          </DialogTitle>
        </DialogHeader>

        {!kit && (
          <div className="flex flex-col items-center gap-4 py-10">
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Gere um kit de vendas personalizado com headline, confronto financeiro, objeções e script de WhatsApp pronto para enviar.
            </p>
            <Button onClick={generate} disabled={loading} className="gap-2">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando kit...</> : <><Wand2 className="h-4 w-4" />Gerar Bluepaint</>}
            </Button>
          </div>
        )}

        {kit && (
          <div className="space-y-5 mt-2">
            {/* Headline */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Abertura</p>
                <CopyBtn text={kit.headline} />
              </div>
              <p className="text-base font-semibold text-foreground italic">"{kit.headline}"</p>
            </div>

            {/* Confronto financeiro */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Confronto Financeiro</p>
                <CopyBtn text={kit.confronto_financeiro} />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{kit.confronto_financeiro}</p>
            </div>

            {/* Objeções */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Objeções & Rebuttals</p>
              <div className="space-y-2.5">
                {kit.objecoes?.map((o, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-destructive font-bold text-xs shrink-0 mt-0.5">Obj</span>
                      <p className="text-sm text-muted-foreground flex-1">{o.objecao}</p>
                      <CopyBtn text={`${o.objecao}\n→ ${o.resposta}`} />
                    </div>
                    <div className="flex items-start gap-2 mt-2">
                      <span className="text-success font-bold text-xs shrink-0 mt-0.5">→</span>
                      <p className="text-sm text-foreground/90 flex-1">{o.resposta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Próximo passo */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Próximo Passo Recomendado</p>
                <CopyBtn text={kit.proximo_passo} />
              </div>
              <p className="text-sm font-medium text-foreground">{kit.proximo_passo}</p>
            </div>

            {/* Script WhatsApp */}
            <div className="bg-[#005C4B]/10 border border-[#005C4B]/30 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-400">Script WhatsApp</p>
                <CopyBtn text={kit.script_whatsapp} />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{kit.script_whatsapp}</p>
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-500 text-white" onClick={sendViaWhatsApp} disabled={sendingWA}>
                  {sendingWA ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                  Enviar via WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="gap-1">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Regenerar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
