import { useNavigate } from "@tanstack/react-router";
import { Clock, ShieldX } from "lucide-react";

import TailorFooter from "@/components/TailorFooter";
import TailorHeader from "@/components/TailorHeader";
import { useAuth } from "@/hooks/useAuth";

/**
 * O que vê quem fez login mas ainda não tem a conta aprovada (ou teve
 * recusada). É a única porta do hub: aprovado, a pessoa usa todos os
 * aplicativos sem pedir mais nada; sem aprovação, não usa nenhum.
 *
 * A aprovação continua existindo porque o cadastro é aberto — sem ela,
 * qualquer um que se cadastrasse leria o NPS dos clientes e gastaria API no TPM.
 */
export function AcessoPendente({ status }: { status: string }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pendente = status === "pending";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TailorHeader
        userEmail={profile?.email}
        onSignOut={async () => {
          await signOut();
          navigate({ to: "/login" });
        }}
      />
      <main className="flex-1 w-full max-w-[640px] mx-auto px-4 md:px-6 py-16">
        <div className="tailor-card text-center">
          {pendente ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-[#fffbf0] border-[1.5px] border-[#f0d060] flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 text-[#8a6a00]" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Aguardando aprovação</h2>
              <p className="text-sm text-muted-foreground">
                Seu cadastro foi recebido. Assim que um administrador da Tailor aprovar, todos os
                aplicativos do hub ficam liberados para você.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-[#fff5f5] border-[1.5px] border-[#f09090] flex items-center justify-center mb-4">
                <ShieldX className="w-5 h-5 text-[#8a1a1a]" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Acesso recusado</h2>
              <p className="text-sm text-muted-foreground">
                Seu cadastro foi recusado. Entre em contato com a Tailor se acredita que isso foi um
                engano.
              </p>
            </>
          )}
        </div>
      </main>
      <TailorFooter />
    </div>
  );
}
