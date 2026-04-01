import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="rounded-full bg-muted p-5 inline-flex mb-6">
          <Search className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h1 className="vs-h1 mb-2">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6">
          A rota <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{location.pathname}</code> não existe no sistema.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={() => navigate("/")} className="gap-2">
            Ir para Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
