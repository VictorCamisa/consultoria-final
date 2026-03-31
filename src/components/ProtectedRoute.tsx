import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          {/* VS monogram */}
          <div className="bg-primary rounded-xl w-12 h-12 flex items-center justify-center shadow-lg">
            <span className="text-primary-foreground text-base font-bold tracking-tight">VS</span>
          </div>
          {/* Spinner */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/60"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40%            { transform: scale(1);   opacity: 1;   }
          }
        `}</style>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
