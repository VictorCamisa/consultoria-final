import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useEffect } from "react";

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

  useEffect(() => {
    const base = "/" + location.pathname.split("/").filter(Boolean).slice(0, 1).join("/");
    document.title = routeTitles[base] || "VS Growth Hub";
  }, [location.pathname]);

  const showBreadcrumbs = location.pathname !== "/";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar — clean, minimal */}
          <header className="h-12 flex items-center gap-3 border-b bg-card px-6 shrink-0 sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1" />
          </header>

          {/* Content — generous padding, max-width for readability */}
          <main className="flex-1 overflow-auto">
            <div className="page-enter max-w-[1400px] mx-auto px-8 py-8">
              {showBreadcrumbs && <Breadcrumbs />}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
