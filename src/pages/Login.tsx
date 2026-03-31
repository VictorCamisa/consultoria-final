import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowRight } from "lucide-react";

export default function Login() {
  const { signIn, session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar";
      toast({ title: "Acesso negado", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #09111f 0%, #0f1729 50%, #0d1230 100%)" }}
    >
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-100" />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(80,70,228,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4 animate-slide-up">
        <div
          className="rounded-2xl border border-white/10 p-8 shadow-xl"
          style={{ background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(24px)" }}
        >
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="gradient-vs rounded-xl w-12 h-12 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white text-base font-bold tracking-tight">VS</span>
            </div>
            <div className="text-center">
              <h1 className="text-lg font-semibold text-white tracking-tight">VS Growth Hub</h1>
              <p className="text-sm text-white/40 mt-0.5">Acesse seu painel de crescimento</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-white/60 uppercase tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/60 focus:bg-white/8 h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-white/60 uppercase tracking-wide">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/60 focus:bg-white/8 h-10"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 mt-2 gradient-vs border-0 text-white font-medium shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Entrando...</>
              ) : (
                <>Acessar o sistema <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-white/20 mt-4">
          VS Consultoria · Sistema interno
        </p>
      </div>
    </div>
  );
}
