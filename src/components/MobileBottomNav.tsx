import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Search, Settings,
  BrainCircuit, UserRoundCog, Users2, FolderKanban, CalendarCheck,
  Menu, X, Sparkles, DollarSign, Package, Lightbulb, TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRIMARY_TABS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Comercial", url: "/comercial", icon: TrendingUp },
  { title: "Leads", url: "/leads", icon: Users2 },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Mais", url: "__more__", icon: Menu },
];

const ALL_ROUTES = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Comercial", url: "/comercial", icon: TrendingUp },
  { title: "Marketing", url: "/marketing", icon: Sparkles },
  { title: "Prospecção", url: "/prospeccao", icon: Search },
  { title: "Leads", url: "/leads", icon: Users2 },
  { title: "Meu Vendedor", url: "/meu-vendedor", icon: UserRoundCog },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Operacional", url: "/operacional", icon: FolderKanban },
  { title: "Acompanhamento", url: "/acompanhamento", icon: CalendarCheck },
  { title: "Agente IA", url: "/agente-ia", icon: BrainCircuit },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Ideias", url: "/ideias", icon: Lightbulb },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, userName, user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (url: string) =>
    location.pathname === url || (url !== "/dashboard" && location.pathname.startsWith(url));

  return (
    <>
      {/* More menu — iOS modal sheet style */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[80] flex flex-col"
          style={{ backgroundColor: "hsl(var(--background) / 0.97)" }}
        >
          {/* Sheet handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-9 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
            <div>
              <p className="text-[15px] font-semibold text-foreground leading-tight">
                {userName ?? "Menu"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.email ?? "VS OS"}
              </p>
            </div>
            <button
              onClick={() => setMoreOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-muted active:scale-95 transition-transform"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Route list */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-0.5">
              {ALL_ROUTES.map(route => {
                const active = isActive(route.url);
                return (
                  <button
                    key={route.url}
                    onClick={() => { navigate(route.url); setMoreOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all active:scale-[0.98]",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/60 active:bg-muted"
                    )}
                  >
                    <route.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    {route.title}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Sign out */}
          <div className="p-4 border-t border-border/60" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[15px] font-medium text-destructive bg-destructive/8 active:bg-destructive/15 transition-colors active:scale-[0.98]"
            >
              Sair da conta
            </button>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[70] border-t border-border/60"
        style={{
          backgroundColor: "hsl(var(--card) / 0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-around h-14">
          {PRIMARY_TABS.map(tab => {
            const active = tab.url === "__more__" ? moreOpen : isActive(tab.url);
            return (
              <button
                key={tab.url}
                onClick={() => {
                  if (tab.url === "__more__") {
                    setMoreOpen(v => !v);
                  } else {
                    setMoreOpen(false);
                    navigate(tab.url);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-[3px] px-3 py-1.5 rounded-xl min-w-[60px] min-h-[44px] transition-all active:scale-95",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <tab.icon className={cn("h-[22px] w-[22px] transition-transform", active && "scale-110")} strokeWidth={active ? 2.25 : 1.75} />
                <span className={cn("text-[10px] leading-tight transition-colors", active ? "font-semibold" : "font-medium")}>
                  {tab.title}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
