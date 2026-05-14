import logo from "@/assets/tailor-logo.png";
import { LogOut, ShieldCheck } from "lucide-react";

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
        <img src={logo} alt="Tailor — made for people" className="h-8 md:h-9 w-auto" />
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center rounded-full border border-border px-4 py-1.5 text-[11px] font-bold tracking-[0.18em] text-foreground/80">
            PADRÃO TAILOR · VERSÃO 2026
          </span>
          {userEmail && (
            <>
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
              <span className="hidden lg:inline text-xs text-muted-foreground">{userEmail}</span>
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
