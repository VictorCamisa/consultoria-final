import { LayoutDashboard, Megaphone, Users, CalendarCheck, Settings, LogOut, BrainCircuit, Search, UserRoundCog, Sun, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
  { title: "Dashboard",       url: "/",               icon: LayoutDashboard, badgeKey: null },
  { title: "Comercial",       url: "/comercial",       icon: Megaphone, badgeKey: "unread" as const },
  { title: "Agente IA",       url: "/agente-ia",       icon: BrainCircuit, badgeKey: null },
  { title: "Prospecção",      url: "/prospeccao",      icon: Search, badgeKey: null },
  { title: "Meu Vendedor",   url: "/meu-vendedor",    icon: UserRoundCog, badgeKey: null },
  { title: "Clientes",        url: "/clientes",        icon: Users, badgeKey: null },
  { title: "Acompanhamento",  url: "/acompanhamento",  icon: CalendarCheck, badgeKey: "pendentes" as const },
  { title: "Configurações",   url: "/configuracoes",   icon: Settings, badgeKey: null },
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
  const { theme, toggleTheme, setTheme } = useTheme();

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* ── Brand ── */}
      <SidebarHeader className={cn("py-6 border-b border-border", collapsed ? "px-2" : "px-5")}>
        <div
          className={cn("flex items-center cursor-pointer", collapsed ? "justify-center" : "gap-3")}
          onClick={() => navigate("/")}
        >
          <div className="rounded-lg w-9 h-9 flex-shrink-0 flex items-center justify-center bg-primary">
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <span className="text-white/80">V</span>
              <span className="text-white">S</span>
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p
                className="leading-none text-foreground"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.01em" }}
              >
                VS Growth Hub
              </p>
              <p className="vs-overline mt-1 text-[9px]">
                Ecossistemas Digitais
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className={cn("py-4", collapsed ? "px-1.5" : "px-3")}>
        <SidebarMenu className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <button
                  onClick={() => navigate(item.url)}
                  className={cn(
                    collapsed
                      ? "flex items-center justify-center w-full p-2.5 rounded-lg transition-all"
                      : "nav-item w-full",
                    active && !collapsed && "active",
                    active && collapsed && "bg-primary/10 text-primary",
                    !active && collapsed && "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] flex-shrink-0 nav-icon",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {!collapsed && (
                    <span className={cn("text-[13px]", active ? "text-primary" : "")}>{item.title}</span>
                  )}
                </button>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* ── User footer ── */}
      <SidebarFooter className={cn("border-t border-border", collapsed ? "p-2 space-y-1" : "p-4 space-y-3")}>
        {/* Theme toggle */}
        {collapsed ? (
          <button
            onClick={toggleTheme}
            title={theme === "light" ? "Modo escuro" : "Modo claro"}
            className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        ) : (
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                theme === "light" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                theme === "dark" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
          </div>
        )}

        {/* User */}
        {collapsed ? (
          <button
            onClick={signOut}
            title="Sair"
            className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">
                {getInitials(userName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                {userName ?? "Usuário"}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
