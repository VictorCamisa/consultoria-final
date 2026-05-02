import {
  LayoutDashboard, Megaphone, Users, CalendarCheck, Settings,
  LogOut, BrainCircuit, Search, UserRoundCog, FolderKanban, Users2,
  DollarSign, Package, Sparkles, Activity, ShieldCheck, Lightbulb,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu,
  SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badgeKey?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Pipeline",   url: "/comercial",  icon: Megaphone, badgeKey: "unread" },
      { title: "Prospecção", url: "/prospeccao", icon: Search },
      { title: "Leads",      url: "/leads",      icon: Users2 },
      { title: "Marketing",  url: "/marketing",  icon: Sparkles },
    ],
  },
  {
    label: "Gatekeeper",
    items: [
      { title: "Agente IA",    url: "/agente-ia",    icon: BrainCircuit },
      { title: "Meu Vendedor",   url: "/meu-vendedor",   icon: UserRoundCog },
    ],
  },
  {
    label: "Onboarding",
    items: [
      { title: "Clientes",       url: "/clientes",       icon: Users },
      { title: "Acompanhamento", url: "/acompanhamento", icon: CalendarCheck, badgeKey: "pendentes" },
      { title: "Operacional",    url: "/operacional",    icon: FolderKanban },
    ],
  },
  {
    label: "Telemetria",
    items: [
      { title: "Health Score", url: "/dashboard", icon: Activity },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Billing",  url: "/financeiro", icon: DollarSign },
      { title: "Produtos", url: "/produtos",   icon: Package },
    ],
  },
  {
    label: "Governança",
    items: [
      { title: "Banco de Ideias", url: "/ideias", icon: Lightbulb },
      { title: "Configurações", url: "/configuracoes", icon: ShieldCheck },
    ],
  },
];

function getInitials(name: string | null) {
  if (!name) return "VS";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { userName, signOut } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["sidebar-unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("consultoria_conversas")
        .select("*", { count: "exact", head: true })
        .eq("direcao", "entrada")
        .eq("processado_ia", false);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendentesCount = 0 } = useQuery({
    queryKey: ["sidebar-pendentes"],
    queryFn: async () => {
      const { count } = await supabase
        .from("consultoria_acompanhamentos")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente")
        .lte("agendado_para", new Date().toISOString());
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const badgeCounts: Record<string, number> = {
    unread: unreadCount,
    pendentes: pendentesCount,
  };

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ── Brand header ── */}
      <SidebarHeader className={cn("py-5 border-b border-sidebar-border", collapsed ? "px-2" : "px-4")}>
        <div
          className={cn("flex items-center cursor-pointer", collapsed ? "justify-center" : "gap-3")}
          onClick={() => navigate("/")}
        >
          <div className="rounded-lg w-8 h-8 flex-shrink-0 flex items-center justify-center bg-card border border-border">
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: 16, letterSpacing: "-0.04em", lineHeight: 1 }}>
              <span style={{ color: "#FFFFFF" }}>V</span>
              <span style={{ color: "#FF5300" }}>S</span>
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="leading-none text-foreground font-display italic font-black tracking-tight" style={{ fontSize: 13 }}>
                VS OS
              </p>
              <p className="mt-0.5 leading-none text-muted-foreground font-sans font-semibold uppercase" style={{ fontSize: 9, letterSpacing: "0.18em" }}>
                Ecossistemas Digitais
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className={cn("py-2 flex-1 overflow-y-auto", collapsed ? "px-1" : "px-2")}>
        {navSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-1" : ""}>
            {/* Section label */}
            {section.label && !collapsed && (
              <p className="px-2 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 select-none">
                {section.label}
              </p>
            )}
            {section.label && collapsed && si > 0 && (
              <div className="mx-auto my-2 w-4 border-t border-border" />
            )}
            <SidebarMenu className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.url);
                const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] ?? 0 : 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={cn(
                        collapsed
                          ? "flex items-center justify-center w-full p-2 rounded-md transition-colors relative"
                          : "nav-item w-full",
                        active && !collapsed && "active",
                        active && collapsed && "bg-primary/10 text-primary",
                        !active && collapsed && "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      )}
                      title={collapsed ? item.title : undefined}
                    >
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary" : "text-sidebar-foreground")} />
                      {!collapsed && (
                        <span className={cn("flex-1 text-left", active ? "text-primary" : "")}>
                          {item.title}
                        </span>
                      )}
                      {badgeCount > 0 && (
                        <span className={cn(
                          "bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center",
                          collapsed && "absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] text-[8px]"
                        )}>
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </button>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>

      {/* ── User footer ── */}
      <SidebarFooter className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <button
            onClick={signOut}
            title="Sair"
            className="flex items-center justify-center w-full p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sidebar-accent flex-shrink-0 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-sidebar-accent-foreground">
                {getInitials(userName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate leading-tight">
                {userName ?? "Usuário"}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
