import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import WhatsAppOnboarding from "@/components/WhatsAppOnboarding";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/comercial": "Comercial",
  "/agente-ia": "Agente IA",
  "/prospeccao": "Prospecção",
  "/leads": "Leads",
  "/meu-vendedor": "Meu Vendedor",
  "/clientes": "Clientes",
  "/acompanhamento": "Acompanhamento",
  "/operacional": "Operacional",
  "/configuracoes": "Configurações",
};

export default function AppLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();

  const base = "/" + location.pathname.split("/").filter(Boolean).slice(0, 1).join("/");
  const pageTitle = routeTitles[base] ?? "VS Growth Hub";

  useEffect(() => {
    document.title = `${pageTitle} — VS Growth Hub`;
  }, [pageTitle]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 overflow-auto pb-16">
          <div className="page-enter px-4 py-4">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  // Desktop layout
  return (
    <SidebarProvider>
      <WhatsAppOnboarding />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 flex items-center gap-3 border-b border-border bg-card px-5 shrink-0 sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1" />
            <div className="h-4 w-px bg-border" />
            <span
              className="text-sm text-foreground tracking-tight"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
            >
              {pageTitle}
            </span>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <div className="page-enter max-w-[1400px] mx-auto px-6 py-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
