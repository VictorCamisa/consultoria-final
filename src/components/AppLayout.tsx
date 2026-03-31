import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
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
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
