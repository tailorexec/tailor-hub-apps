import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import TailorFooter from "@/components/TailorFooter";
import { QualityPanel } from "@/components/tpm/QualityPanel";
import { TPMReportView } from "@/components/tpm/TPMReportView";
import logo from "@/assets/tailor-logo.png";
import type { TPMReport } from "@/lib/tpm/types";

/**
 * Briefing compartilhado — a única página do TPM sem login.
 *
 * O caminho é `/briefing/<token>` porque este link vai para o cliente: sem
 * jargão interno e sem revelar a estrutura do hub. O conteúdo é a VERSÃO
 * CLIENTE, recortada no servidor (ver src/routes/api/tpm.shared.ts) — não
 * existe nada aqui que dependa de o front esconder seção.
 */
export const Route = createFileRoute("/briefing/$token")({
  component: BriefingPublico,
});

function BriefingPublico() {
  const { token } = Route.useParams();
  const [report, setReport] = useState<TPMReport | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch(`/api/tpm/shared?token=${encodeURIComponent(token)}`);
        const corpo = (await res.json().catch(() => ({}))) as {
          report?: TPMReport;
          error?: string;
        };
        if (!ativo) return;
        if (!res.ok || !corpo.report) {
          setErro(corpo.error ?? "Briefing não encontrado.");
        } else {
          setReport(corpo.report);
        }
      } catch {
        if (ativo) setErro("Não foi possível carregar o briefing.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !report) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-center">
          <img src={logo} alt="Tailor" className="h-8" />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Briefing não encontrado</h1>
            <p className="text-sm text-muted-foreground">
              Este link pode ter expirado ou estar incorreto.
            </p>
          </div>
        </main>
        <TailorFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-center">
        <img src={logo} alt="Tailor — made for people" className="h-8" />
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <TPMReportView report={report} publico />
          <div className="hidden lg:block">
            <QualityPanel quality={report.quality} />
          </div>
        </div>
      </main>
      <TailorFooter />
    </div>
  );
}
