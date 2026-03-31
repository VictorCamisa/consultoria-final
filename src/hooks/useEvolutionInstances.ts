import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type EvolutionInstance = { name: string; state: string; owner: string | null };

export function useEvolutionInstances() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"waiting" | "connected" | "error">("waiting");

  const fetchInstances = useCallback(async () => {
    if (!user) return;
    setInstancesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "list" },
      });
      if (error) throw error;
      const list: EvolutionInstance[] = data?.instances || [];
      setInstances(list);
      if (list.length && !selectedInstance) {
        const connected = list.find((i) => i.state === "open");
        setSelectedInstance(connected?.name || list[0].name);
      }
    } catch { /* silently fail */ }
    finally { setInstancesLoading(false); }
  }, [user, selectedInstance]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const createInstance = useCallback(async () => {
    if (!user || !newInstanceName.trim()) return;
    setCreatingInstance(true);
    const sanitizedName = newInstanceName.trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (!sanitizedName) {
      toast({ title: "Nome inválido", description: "Use letras, números, - ou _", variant: "destructive" });
      setCreatingInstance(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "create", instance_name: sanitizedName },
      });
      if (error) throw error;
      toast({ title: "Instância criada!", description: `${sanitizedName} pronta para conexão.` });
      if (data?.qrcode?.base64 || data?.qrcode) {
        const qr = typeof data.qrcode === "string" ? data.qrcode : data.qrcode.base64;
        if (qr) { setQrCode(qr); setQrInstanceName(sanitizedName); setConnectionStatus("waiting"); setQrDialogOpen(true); }
      }
      setNewInstanceName("");
      await fetchInstances();
      setSelectedInstance(sanitizedName);
    } catch (error: any) {
      toast({ title: "Erro ao criar instância", description: error.message, variant: "destructive" });
    } finally { setCreatingInstance(false); }
  }, [user, newInstanceName, fetchInstances, toast]);

  const deleteInstance = useCallback(async (instanceName: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "delete", instance_name: instanceName },
      });
      if (error) throw error;
      toast({ title: "Instância removida" });
      if (selectedInstance === instanceName) setSelectedInstance("");
      await fetchInstances();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  }, [user, selectedInstance, fetchInstances, toast]);

  const getQRCode = useCallback(async (instanceName: string) => {
    if (!user) return;
    setQrLoading(true); setQrInstanceName(instanceName); setQrDialogOpen(true); setQrCode(""); setConnectionStatus("waiting");
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "qrcode", instance_name: instanceName },
      });
      if (error) throw error;
      setQrCode(data?.qrcode || "");
    } catch (error: any) {
      toast({ title: "Erro ao obter QR Code", description: error.message, variant: "destructive" });
      setQrDialogOpen(false);
    } finally { setQrLoading(false); }
  }, [user, toast]);

  // Poll QR status
  useEffect(() => {
    if (!qrDialogOpen || !qrInstanceName || !user) return;
    let qrRefreshCount = 0;
    const statusInterval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-evolution", {
          body: { action: "status", instance_name: qrInstanceName },
        });
        if (data?.state === "open") {
          setConnectionStatus("connected");
          toast({ title: "✅ WhatsApp conectado!", description: `Instância ${qrInstanceName} online.` });
          setTimeout(() => { setQrDialogOpen(false); fetchInstances(); setSelectedInstance(qrInstanceName); }, 1500);
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
    return () => clearInterval(statusInterval);
  }, [qrDialogOpen, qrInstanceName, user, fetchInstances, toast]);

  return {
    instances, instancesLoading, selectedInstance, setSelectedInstance,
    newInstanceName, setNewInstanceName, creatingInstance, createInstance,
    deleteInstance, getQRCode, fetchInstances,
    qrDialogOpen, setQrDialogOpen, qrCode, qrLoading, qrInstanceName, connectionStatus,
  };
}
