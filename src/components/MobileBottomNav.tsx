import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Megaphone, Users, Search, Settings,
  BrainCircuit, UserRoundCog, Users2, FolderKanban, CalendarCheck,
  Menu, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRIMARY_TABS = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Comercial", url: "/comercial", icon: Megaphone },
  { title: "Leads", url: "/leads", icon: Users2 },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Mais", url: "__more__", icon: Menu },
];

const ALL_ROUTES = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Comercial", url: "/comercial", icon: Megaphone },
  { title: "Prospecção", url: "/prospeccao", icon: Search },
  { title: "Leads", url: "/leads", icon: Users2 },
  { title: "Meu Vendedor", url: "/meu-vendedor", icon: UserRoundCog },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Operacional", url: "/operacional", icon: FolderKanban },
  { title: "Acompanhamento", url: "/acompanhamento", icon: CalendarCheck },
  { title: "Agente IA", url: "/agente-ia", icon: BrainCircuit },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, userName } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="text-base font-semibold text-foreground">{userName ?? "Menu"}</p>
              <p className="text-xs text-muted-foreground">VS Growth Hub</p>
            </div>
            <button onClick={() => setMoreOpen(false)} className="p-2 rounded-lg hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {ALL_ROUTES.map(route => (
                <button
                  key={route.url}
                  onClick={() => { navigate(route.url); setMoreOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors",
                    isActive(route.url)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <route.icon className="h-5 w-5" />
                  {route.title}
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border">
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              Sair da conta
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {PRIMARY_TABS.map(tab => {
            const active = tab.url === "__more__" ? moreOpen : isActive(tab.url);
            return (
              <button
                key={tab.url}
                onClick={() => {
                  if (tab.url === "__more__") {
                    setMoreOpen(!moreOpen);
                  } else {
                    setMoreOpen(false);
                    navigate(tab.url);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-tight">{tab.title}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
