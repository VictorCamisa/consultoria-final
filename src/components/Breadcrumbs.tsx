import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  "comercial": "Comercial",
  "agente-ia": "Agente IA",
  "prospeccao": "Prospecção",
  "meu-vendedor": "Meu Vendedor",
  "clientes": "Clientes",
  "acompanhamento": "Acompanhamento",
  "configuracoes": "Configurações",
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-[12px] text-muted-foreground">
      <Link to="/" className="hover:text-foreground transition-colors font-medium">
        Dashboard
      </Link>
      {segments.map((segment, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const label = routeLabels[segment] || segment;
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            {isLast ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
