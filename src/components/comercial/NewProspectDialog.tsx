import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { NICHOS, ProspectInsert } from "./types";
import { useState } from "react";

export function NewProspectDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nicho, setNicho] = useState("");

  const createProspect = useMutation({
    mutationFn: async (prospect: ProspectInsert) => {
      const { error } = await supabase.from("consultoria_prospects").insert(prospect);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setOpen(false);
      toast({ title: "Prospect adicionado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createProspect.mutate({
      nome_negocio: fd.get("nome_negocio") as string,
      nicho,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Novo Prospect</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo Prospect</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do negócio *</Label>
              <Input name="nome_negocio" required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nicho *</Label>
              <Select value={nicho} onValueChange={setNicho} required>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {NICHOS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Cidade *</Label><Input name="cidade" required className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">WhatsApp *</Label><Input name="whatsapp" required className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Instagram</Label><Input name="instagram" className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Site</Label><Input name="site" className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Decisor</Label><Input name="decisor" className="h-9" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Faturamento</Label><Input name="faturamento_estimado" className="h-9" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea name="observacoes" className="min-h-[60px]" /></div>
          <Button type="submit" className="w-full" disabled={createProspect.isPending}>
            {createProspect.isPending ? "Salvando..." : "Adicionar Prospect"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
