import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NichoRecord = {
  id: string;
  label: string;
  keywords: string[];
  color: string;
  dot: string;
  icon: string;
  search_value: string;
  is_primary: boolean;
  ordem: number;
};

// Fallback hardcoded data (used while DB loads)
const FALLBACK_NICHOS: NichoRecord[] = [
  { id: "fb-1", label: "Estética", keywords: ["estética", "estetic", "bem-estar", "cirurgia plástica"], color: "bg-pink-500/15 border-pink-500/30 text-pink-400", dot: "bg-pink-500", icon: "💆", search_value: "clínicas estéticas", is_primary: true, ordem: 1 },
  { id: "fb-2", label: "Odonto", keywords: ["odonto", "odontológ"], color: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400", dot: "bg-cyan-500", icon: "🦷", search_value: "clínicas odontológicas", is_primary: true, ordem: 2 },
  { id: "fb-3", label: "Advocacia", keywords: ["advoca", "advocacia", "advogado", "direito", "jurídic"], color: "bg-amber-500/15 border-amber-500/30 text-amber-400", dot: "bg-amber-500", icon: "⚖️", search_value: "escritórios de advocacia", is_primary: true, ordem: 3 },
  { id: "fb-4", label: "Revendas", keywords: ["revenda", "veículo", "seminov", "motors", "auto"], color: "bg-blue-500/15 border-blue-500/30 text-blue-400", dot: "bg-blue-500", icon: "🚗", search_value: "revendas de veículos seminovos usados", is_primary: true, ordem: 4 },
];

export function useNichos() {
  const { data: nichos, isLoading } = useQuery({
    queryKey: ["nichos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultoria_nichos")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data as unknown as NichoRecord[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const list = nichos?.length ? nichos : FALLBACK_NICHOS;

  const labels = list.map(n => n.label);

  const nichoCategory = (nicho: string) => {
    const lower = nicho.toLowerCase();
    return list.find(c => c.keywords.some(k => lower.includes(k))) ?? null;
  };

  const isNichoConfigurado = (nicho: string) => {
    if (!nicho) return false;
    const lower = nicho.toLowerCase();
    return list.some(c => c.keywords.some(k => lower.includes(k)));
  };

  const matchesNichoFilter = (prospectNicho: string, filterKey: string) => {
    if (filterKey === "todos") return true;
    if (filterKey === "sem_config") return !isNichoConfigurado(prospectNicho);
    const cat = list.find(c => c.label === filterKey);
    const lower = prospectNicho.toLowerCase();
    if (!cat) {
      return lower === filterKey.toLowerCase() || lower.includes(filterKey.toLowerCase());
    }
    return cat.keywords.some(k => lower.includes(k));
  };

  const presetSegments = list.map(n => ({
    label: n.label,
    value: n.search_value || n.label.toLowerCase(),
    icon: n.icon,
    primary: n.is_primary,
  }));

  return {
    nichos: list,
    labels,
    isLoading,
    nichoCategory,
    isNichoConfigurado,
    matchesNichoFilter,
    presetSegments,
  };
}
