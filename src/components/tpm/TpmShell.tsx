import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import TailorFooter from "@/components/TailorFooter";
import TailorHeader from "@/components/TailorHeader";
import { useAuth } from "@/hooks/useAuth";

const ABAS = [
  { to: "/tpm", label: "Briefings" },
  { to: "/tpm/novo", label: "Novo TPM" },
  { to: "/tpm/cases", label: "Cases Tailor" },
] as const;

/**
 * Casca das páginas do TPM dentro do hub.
 *
 * O app original tinha sidebar e cabeçalho próprios. Aqui ele usa o cabeçalho e
 * o rodapé do hub — é o que faz o TPM parecer mais um aplicativo do hub em vez
 * de um site diferente hospedado no mesmo domínio.
 */
export function TpmShell({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: ReactNode;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TailorHeader
        userEmail={profile?.email}
        isAdmin={isAdmin}
        onAdmin={() => navigate({ to: "/admin" })}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/login" });
        }}
      />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <button
          onClick={() => navigate({ to: "/generator" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao hub
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl text-foreground">{titulo}</h1>
            {descricao && <p className="text-sm text-muted-foreground mt-1">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>

        <nav className="flex gap-2 border-b border-border mb-6">
          {ABAS.map((aba) => (
            <Link
              key={aba.to}
              to={aba.to}
              activeOptions={{ exact: aba.to === "/tpm" }}
              className="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors text-muted-foreground border-transparent hover:text-foreground"
              activeProps={{ className: "text-foreground border-primary" }}
            >
              {aba.label}
            </Link>
          ))}
        </nav>

        {children}
      </main>

      <TailorFooter />
    </div>
  );
}
