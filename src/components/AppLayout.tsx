import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/":               "Dashboard",
  "/comercial":      "Comercial",
  "/clientes":       "Clientes",
  "/acompanhamento": "Acompanhamento",
  "/configuracoes":  "Configurações",
};

export default function AppLayout() {
  const location = useLocation();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(path)
    )?.[1] ?? "VS Growth Hub";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 flex items-center gap-3 border-b border-border/60 bg-card/80 backdrop-blur-sm px-5 shrink-0 sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors -ml-1" />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground tracking-tight">{title}</span>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-6">
            <div className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
