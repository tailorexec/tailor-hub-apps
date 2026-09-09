import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/tailor-logo.png";

export const Route = createFileRoute("/login")({
  // `redirect` is optional: only the _authenticated guard sets it. Sign-out and
  // the signup link navigate to /login with no search params.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { redirect: redirectTo = "/generator" } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: redirectTo });
  }, [loading, session, navigate, redirectTo]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      return;
    }
    navigate({ to: redirectTo });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" title="Ir para o início" aria-label="Ir para o início" className="mb-8 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <img src={logo} alt="Tailor" className="h-9 w-auto" />
      </Link>
      <div className="w-full max-w-[420px] tailor-card">
        <div className="tailor-card-title">Entrar</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-foreground">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full py-3.5 px-8 bg-primary text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-[10px] cursor-pointer transition-all hover:brightness-90 disabled:opacity-50 mt-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-5">
          Ainda não tem conta?{" "}
          <Link to="/signup" className="text-primary font-semibold hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
