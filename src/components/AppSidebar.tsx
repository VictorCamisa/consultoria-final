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
      <SidebarHeader className={cn("py-5 border-b border-sidebar-border", collapsed ? "px-2" : "px-4")}>
        <div
          className={cn("flex items-center cursor-pointer", collapsed ? "justify-center" : "gap-3")}
          onClick={() => navigate("/")}
        >
          {/* VS monogram — V prata · S azul (Brand Bible v1.0) */}
          <div
            className="rounded-lg w-8 h-8 flex-shrink-0 flex items-center justify-center bg-foreground"
          >
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <span style={{ color: "#D4D8E4" }}>V</span>
              <span style={{ color: "#4A8DE0" }}>S</span>
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p
                className="leading-none text-foreground"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.01em" }}
              >
                VS Growth Hub
              </p>
              <p
                className="mt-0.5 leading-none text-muted-foreground"
                style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase" }}
              >
                Ecossistemas Digitais
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className={cn("py-3", collapsed ? "px-1" : "px-2")}>
        <SidebarMenu className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <button
                  onClick={() => navigate(item.url)}
                  className={cn(
                    collapsed ? "flex items-center justify-center w-full p-2 rounded-md transition-colors" : "nav-item w-full",
                    active && !collapsed && "active",
                    active && collapsed && "bg-primary/10 text-primary"
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
                    <span className={active ? "text-primary" : ""}>{item.title}</span>
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
            className="nav-item justify-center px-2 hover:text-destructive"
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
