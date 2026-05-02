import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import WhatsAppOnboarding from "@/components/WhatsAppOnboarding";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ChevronLeft } from "lucide-react";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/comercial": "Comercial",
  "/marketing": "Marketing",
  "/agente-ia": "Agente IA",
  "/prospeccao": "Prospecção",
  "/leads": "Leads",
  "/meu-vendedor": "Meu Vendedor",
  "/clientes": "Clientes",
  "/acompanhamento": "Acompanhamento",
  "/operacional": "Operacional",
  "/financeiro": "Financeiro",
  "/produtos": "Produtos",
  "/ideias": "Ideias",
  "/configuracoes": "Configurações",
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const segments = location.pathname.split("/").filter(Boolean);
  const base = "/" + segments.slice(0, 1).join("/");
  const pageTitle = routeTitles[base] ?? "VS OS";

  // Detail pages (e.g. /clientes/:id) — show back button on mobile
  const isDetailPage = segments.length > 1;

  useEffect(() => {
    document.title = `${pageTitle} — VS OS`;
  }, [pageTitle]);

  // ── Mobile layout ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        className="min-h-screen flex flex-col bg-background"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* iOS-style navigation bar */}
        <header
          className="fixed left-0 right-0 z-[60] flex items-center h-[52px] border-b border-border/50"
          style={{
            top: "env(safe-area-inset-top, 0px)",
            backgroundColor: "hsl(var(--card) / 0.92)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {isDetailPage ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 pl-3 pr-4 h-full text-primary active:opacity-60 transition-opacity"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              <span className="text-[15px] font-medium">Voltar</span>
            </button>
          ) : (
            <div className="w-20" />
          )}

          <h1
            className="flex-1 text-center text-[17px] font-semibold text-foreground tracking-[-0.01em]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {pageTitle}
          </h1>

          <div className="w-20" />
        </header>

        {/* Content — offset for fixed header + bottom nav */}
        <main
          className="flex-1 overflow-auto"
          style={{ paddingTop: "calc(52px + env(safe-area-inset-top, 0px))" }}
        >
          <div className="page-enter pb-20">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────
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
