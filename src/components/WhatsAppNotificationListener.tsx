import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Componente global que escuta mensagens de entrada no WhatsApp via Supabase Realtime
 * e exibe toast notifications em qualquer página do sistema.
 */
export function WhatsAppNotificationListener() {
  const { user } = useAuth();
  const prospectCacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-whatsapp-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "consultoria_conversas",
          filter: "direcao=eq.entrada",
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            prospect_id: string | null;
            conteudo: string;
            direcao: string;
          };

          if (!row.prospect_id) return;

          // Busca nome do prospect (com cache simples)
          let nomeNegocio = prospectCacheRef.current[row.prospect_id];
          if (!nomeNegocio) {
            const { data } = await supabase
              .from("consultoria_prospects")
              .select("nome_negocio")
              .eq("id", row.prospect_id)
              .maybeSingle();
            nomeNegocio = data?.nome_negocio ?? "Lead desconhecido";
            prospectCacheRef.current[row.prospect_id] = nomeNegocio;
          }

          const preview =
            row.conteudo.length > 80
              ? row.conteudo.slice(0, 80) + "…"
              : row.conteudo;

          toast(nomeNegocio, {
            description: preview,
            icon: <MessageSquare className="h-4 w-4 text-green-500" />,
            duration: 8000,
            action: {
              label: "Ver conversa",
              onClick: () => {
                window.location.href = "/comercial";
              },
            },
          });

          // Som de notificação sutil
          try {
            const audioCtx = new AudioContext();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 880;
            osc.type = "sine";
            gain.gain.value = 0.08;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.stop(audioCtx.currentTime + 0.3);
          } catch {
            // Silently ignore audio errors
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
