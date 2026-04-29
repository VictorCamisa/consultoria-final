import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppNotificationListener } from "@/components/WhatsAppNotificationListener";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Comercial from "@/pages/Comercial";
import Clientes from "@/pages/Clientes";
import ClienteDetalhe from "@/pages/ClienteDetalhe";
import Acompanhamento from "@/pages/Acompanhamento";
import Configuracoes from "@/pages/Configuracoes";
import AgenteIA from "@/pages/AgenteIA";
import Prospeccao from "@/pages/Prospeccao";
import MeuVendedor from "@/pages/MeuVendedor";
import Operacional from "@/pages/Operacional";
import Leads from "@/pages/Leads";
import Financeiro from "@/pages/Financeiro";
import Produtos from "@/pages/Produtos";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s — evita refetch desnecessário
      gcTime: 5 * 60_000,     // 5 min — mantém cache para back-nav
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <WhatsAppNotificationListener />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/site" element={<LandingPage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/comercial" element={<Comercial />} />
                  <Route path="/agente-ia" element={<AgenteIA />} />
                  <Route path="/prospeccao" element={<Prospeccao />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/meu-vendedor" element={<MeuVendedor />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/acompanhamento" element={<Acompanhamento />} />
                  <Route path="/operacional" element={<Operacional />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/produtos" element={<Produtos />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
