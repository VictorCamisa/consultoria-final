import { LayoutDashboard, Megaphone, Users, CalendarCheck, Settings, LogOut, BrainCircuit, Search, UserRoundCog } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard",       url: "/",               icon: LayoutDashboard },
  { title: "Comercial",       url: "/comercial",       icon: Megaphone },
  { title: "Agente IA",       url: "/agente-ia",       icon: BrainCircuit },
  { title: "Prospecção",      url: "/prospeccao",      icon: Search },
  { title: "Meu Vendedor",   url: "/meu-vendedor",    icon: UserRoundCog },
  { title: "Clientes",        url: "/clientes",        icon: Users },
  { title: "Acompanhamento",  url: "/acompanhamento",  icon: CalendarCheck },
  { title: "Configurações",   url: "/configuracoes",   icon: Settings },
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

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* ── Brand header ── */}
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          {/* VS monogram — V prata #D4D8E4 · S azul #4A8DE0 (Brand Bible v1.0) */}
          <div
            className="rounded-lg w-8 h-8 flex-shrink-0 flex items-center justify-center"
            style={{ background: "#111216", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <span style={{ color: "#D4D8E4" }}>V</span>
              <span style={{ color: "#4A8DE0" }}>S</span>
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p
                className="leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: "#D4D8E4", letterSpacing: "0.01em" }}
              >
                VS Growth Hub
              </p>
              <p
                className="mt-0.5 leading-none"
                style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: 9, color: "#9097AB", letterSpacing: "0.18em", textTransform: "uppercase" }}
              >
                Ecossistemas Digitais
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="py-3 px-2">
        <SidebarMenu className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <button
                  onClick={() => navigate(item.url)}
                  className={cn(
                    "nav-item w-full",
                    active && "active"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      active ? "text-primary" : "text-sidebar-foreground"
                    )}
                  />
                  {!collapsed && (
                    <span className={active ? "text-white" : ""}>{item.title}</span>
                  )}
                </button>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* ── User footer ── */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {collapsed ? (
          <button
            onClick={signOut}
            title="Sair"
            className="nav-item justify-center px-2 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
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
              className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-red-400 hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
