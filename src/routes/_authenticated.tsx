import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AcessoPendente } from "@/components/AcessoPendente";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

/**
 * Porta de todas as páginas do hub, inclusive a inicial: sem login vai para o
 * /login; com login e conta aprovada, libera tudo; com a conta ainda não
 * aprovada (ou recusada), mostra o aviso no lugar de qualquer página.
 */
function AuthenticatedLayout() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login", search: { redirect: location.pathname } });
    }
  }, [loading, session, navigate, location.pathname]);

  // O perfil chega um instante depois da sessão. Esperar por ele evita mostrar
  // os aplicativos por um segundo a quem ainda não foi aprovado.
  if (loading || !session || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (profile.hub_status !== "approved") {
    return <AcessoPendente status={profile.hub_status} />;
  }

  return <Outlet />;
}
