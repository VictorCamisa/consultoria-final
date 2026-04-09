import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, CheckCircle2, QrCode } from "lucide-react";

export default function WhatsAppOnboarding() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<"name" | "qr" | "done">("name");
  const [instanceName, setInstanceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"waiting" | "connected">("waiting");

  // Check if user already has an instance
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("evolution_instances")
          .select("instance_name")
          .eq("created_by", user.id)
          .limit(1);
        if (!data || data.length === 0) {
          setOpen(true);
        }
      } catch { /* ignore */ }
      finally { setChecking(false); }
    })();
  }, [user]);

  const handleCreate = useCallback(async () => {
    if (!user || !instanceName.trim()) return;
    setCreating(true);
    const sanitized = instanceName.trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (!sanitized) {
      toast({ title: "Nome inválido", description: "Use letras, números, - ou _", variant: "destructive" });
      setCreating(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "create", instance_name: sanitized },
      });
      if (error) throw error;

      setQrInstanceName(sanitized);
      const qr = data?.qrcode?.base64 || (typeof data?.qrcode === "string" ? data.qrcode : "");
      if (qr) setQrCode(qr);
      setStep("qr");
      setQrLoading(!qr);
      if (!qr) {
        // Fetch QR separately
        const { data: qrData } = await supabase.functions.invoke("manage-evolution", {
          body: { action: "qrcode", instance_name: sanitized },
        });
        setQrCode(qrData?.qrcode || "");
        setQrLoading(false);
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar instância", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  }, [user, instanceName, toast]);

  // Poll connection status
  useEffect(() => {
    if (step !== "qr" || !qrInstanceName || !user) return;
    let qrRefreshCount = 0;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-evolution", {
          body: { action: "status", instance_name: qrInstanceName },
        });
        if (data?.state === "open") {
          setConnectionStatus("connected");
          setStep("done");
          toast({ title: "✅ WhatsApp conectado!", description: `Instância ${qrInstanceName} online.` });
          clearInterval(interval);
        }
      } catch { /* ignore */ }
      qrRefreshCount++;
      if (qrRefreshCount % 8 === 0) {
        try {
          const { data } = await supabase.functions.invoke("manage-evolution", {
            body: { action: "qrcode", instance_name: qrInstanceName },
          });
          if (data?.qrcode) setQrCode(data.qrcode);
        } catch { /* ignore */ }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, qrInstanceName, user, toast]);

  if (checking || !open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (step === "done") setOpen(false); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => { if (step !== "done") e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Conectar seu WhatsApp
          </DialogTitle>
          <DialogDescription>
            {step === "name" && "Crie uma instância para vincular seu número ao sistema."}
            {step === "qr" && "Escaneie o QR Code com seu WhatsApp para conectar."}
            {step === "done" && "Tudo pronto! Seu WhatsApp está conectado."}
          </DialogDescription>
        </DialogHeader>

        {step === "name" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Nome da instância</Label>
              <Input
                id="instance-name"
                placeholder="ex: danilo-vs"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <p className="text-xs text-muted-foreground">Use letras, números, - ou _</p>
            </div>
            <Button onClick={handleCreate} disabled={creating || !instanceName.trim()} className="w-full">
              {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar e conectar"}
            </Button>
          </div>
        )}

        {step === "qr" && (
          <div className="flex flex-col items-center gap-4 py-4">
            {qrLoading || !qrCode ? (
              <div className="w-48 h-48 flex items-center justify-center border rounded-lg bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-3 bg-white rounded-lg border shadow-sm">
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <QrCode className="h-4 w-4" />
              <span>Abra WhatsApp → Dispositivos conectados → Conectar</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60" style={{ animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite` }} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">Aguardando conexão...</span>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-sm font-medium">WhatsApp conectado com sucesso!</p>
            <Button onClick={() => setOpen(false)} className="w-full">Começar a usar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
