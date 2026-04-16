import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { Prospect, ProspectInsert } from "./types";
import { useNichos } from "@/hooks/useNichos";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  prospect?: Prospect | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  hideDefaultTrigger?: boolean;
}

export function NewProspectDialog({ prospect, open: controlledOpen, onOpenChange, trigger, hideDefaultTrigger }: Props = {}) {
  const queryClient = useQueryClient();
  const { labels: NICHOS } = useNichos();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [nicho, setNicho] = useState(prospect?.nicho || "");
  const isEdit = !!prospect;

  useEffect(() => {
    if (open) setNicho(prospect?.nicho || "");
  }, [open, prospect]);

  const saveProspect = useMutation({
    mutationFn: async (data: ProspectInsert) => {
      if (isEdit && prospect) {
        const { error } = await supabase.from("consultoria_prospects").update({
          ...data,
          updated_at: new Date().toISOString(),
        }).eq("id", prospect.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultoria_prospects").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setOpen(false);
      setNicho("");
      toast({ title: isEdit ? "Prospect atualizado!" : "Prospect adicionado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nicho.trim()) {
      toast({ title: "Preencha o nicho", variant: "destructive" });
      return;
    }
    const fd = new FormData(e.currentTarget);
    saveProspect.mutate({
      nome_negocio: fd.get("nome_negocio") as string,
      nicho: nicho.trim(),
      cidade: fd.get("cidade") as string,
      whatsapp: fd.get("whatsapp") as string,
      instagram: (fd.get("instagram") as string) || null,
      site: (fd.get("site") as string) || null,
      decisor: (fd.get("decisor") as string) || null,
      faturamento_estimado: (fd.get("faturamento_estimado") as string) || null,
      observacoes: (fd.get("observacoes") as string) || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNicho(prospect?.nicho || ""); }}>
      {!hideDefaultTrigger && (
        <DialogTrigger asChild>
          {trigger ?? <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Novo Prospect</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar Prospect" : "Novo Prospect"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do negócio *</Label>
              <Input name="nome_negocio" required className="h-9" defaultValue={prospect?.nome_negocio ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nicho *</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {NICHOS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNicho(n)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-colors",
                      nicho === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Input
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                placeholder="ou digite um nicho personalizado"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Cidade *</Label><Input name="cidade" required className="h-9" defaultValue={prospect?.cidade ?? ""} /></div>
            <div className="space-y-1.5"><Label className="text-xs">WhatsApp *</Label><Input name="whatsapp" required className="h-9" defaultValue={prospect?.whatsapp ?? ""} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Instagram</Label><Input name="instagram" className="h-9" defaultValue={prospect?.instagram ?? ""} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Site</Label><Input name="site" className="h-9" defaultValue={prospect?.site ?? ""} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Decisor</Label><Input name="decisor" className="h-9" defaultValue={prospect?.decisor ?? ""} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Faturamento</Label><Input name="faturamento_estimado" className="h-9" defaultValue={prospect?.faturamento_estimado ?? ""} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea name="observacoes" className="min-h-[60px]" defaultValue={prospect?.observacoes ?? ""} /></div>
          <Button type="submit" className="w-full" disabled={saveProspect.isPending}>
            {saveProspect.isPending ? "Salvando..." : isEdit ? "Salvar Alterações" : "Adicionar Prospect"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
