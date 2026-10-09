import { Link } from "@tanstack/react-router";
import { House, LogOut, ShieldCheck } from "lucide-react";

import logo from "@/assets/tailor-logo.png";

interface TailorHeaderProps {
  userEmail?: string | null;
  isAdmin?: boolean;
  onAdmin?: () => void;
  onSignOut?: () => void;
}

const TailorHeader = ({ userEmail, isAdmin, onAdmin, onSignOut }: TailorHeaderProps) => {
  return (
    <header className="w-full border-b border-border bg-card">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between gap-4">
        <Link
          to="/"
          title="Ir para o início"
          aria-label="Ir para o início"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <img src={logo} alt="Tailor — made for people" className="h-8 md:h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          {userEmail && (
            <>
              {/* Ordem fixa: quem está logado, Início, Admin (só admin), Sair. */}
              <span className="hidden md:inline text-xs text-muted-foreground">{userEmail}</span>
              {/* Volta ao início de qualquer app. O logo também leva para lá,
                  mas ninguém adivinha isso — o botão deixa explícito. */}
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent transition-colors"
                title="Voltar à página inicial do hub"
                aria-label="Voltar à página inicial do hub"
              >
                <House className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Início</span>
              </Link>
              {isAdmin && onAdmin && (
                <button
                  onClick={onAdmin}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent transition-colors"
                  title="Painel admin"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </button>
              )}
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent transition-colors"
                  title="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default TailorHeader;
