import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const routeTitles: Record<string, string> = {
  "/": "Dashboard — VS Growth Hub",
  "/comercial": "Pipeline Comercial — VS Growth Hub",
  "/agente-ia": "Central de Automação — VS Growth Hub",
  "/prospeccao": "Prospecção — VS Growth Hub",
  "/meu-vendedor": "Meu Vendedor — VS Growth Hub",
  "/clientes": "Clientes — VS Growth Hub",
  "/acompanhamento": "Acompanhamento — VS Growth Hub",
  "/configuracoes": "Configurações — VS Growth Hub",
};

export default function AppLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    const base = "/" + location.pathname.split("/").filter(Boolean).slice(0, 1).join("/");
    document.title = routeTitles[base] || "VS Growth Hub";
  }, [location.pathname]);

  const showBreadcrumbs = location.pathname !== "/";

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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-11 flex items-center gap-3 border-b border-border bg-card px-5 shrink-0 sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1" />
            {showBreadcrumbs && (
              <div className="border-l border-border pl-3">
                <Breadcrumbs />
              </div>
            )}
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
