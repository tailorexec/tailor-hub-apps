import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileDown, Share2, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { QualityPanel } from "@/components/tpm/QualityPanel";
import { StrategicCards, type StrategicCard } from "@/components/tpm/StrategicCards";
import { TPMInputForm } from "@/components/tpm/TPMInputForm";
import { TPMReportView } from "@/components/tpm/TPMReportView";
import { TpmShell } from "@/components/tpm/TpmShell";
import { toast } from "@/hooks/use-toast";
import { garantirLinkPublico, gerarSimulacao, gerarTPM } from "@/lib/tpm/api";
import { exportTPMtoPdf } from "@/lib/tpm/export-pdf";
import type { TPMInput, TPMReport } from "@/lib/tpm/types";

export const Route = createFileRoute("/_authenticated/tpm/novo")({
  component: NovoTPM,
});

function NovoTPM() {
  const navigate = useNavigate();
  const [report, setReport] = useState<TPMReport | null>(null);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState<string>();
  const [cards, setCards] = useState<StrategicCard[] | null>(null);
  const [simulando, setSimulando] = useState(false);

  const gerar = async (input: TPMInput) => {
    setGerando(true);
    setProgresso("Iniciando");
    try {
      const novo = await gerarTPM(input, (p) => setProgresso(p.label ?? p.stage));
      setReport(novo);
      window.scrollTo(0, 0);
      toast({ title: "Briefing pronto", description: `TPM de ${input.companyName} gerado.` });
    } catch (e) {
      toast({
        title: "Erro ao gerar o TPM",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGerando(false);
      setProgresso(undefined);
    }
  };

  const simular = async () => {
    if (!report) return;
    setSimulando(true);
    try {
      const gerados = (await gerarSimulacao(report.id)) as StrategicCard[];
      setCards(gerados);
      window.scrollTo(0, 0);
      toast({
        title: "Cards prontos",
        description: `${gerados.length} argumento(s) para a reunião.`,
      });
    } catch (e) {
      toast({
        title: "Erro na simulação",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSimulando(false);
    }
  };

  const compartilhar = async () => {
    if (!report) return;
    try {
      const url = await garantirLinkPublico(report.id, report.shareToken ?? null);
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado",
        description: "É a versão cliente — sem cases, autoridade nem leitura estratégica.",
      });
    } catch (e) {
      toast({
        title: "Não foi possível gerar o link",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (!report) {
    return (
      <TpmShell titulo="Novo TPM" descricao="Gere um briefing estratégico pré-reunião.">
        <div className="max-w-2xl">
          <TPMInputForm onGenerate={gerar} isLoading={gerando} progresso={progresso} />
        </div>
      </TpmShell>
    );
  }

  if (cards) {
    return (
      <TpmShell
        titulo={
          <>
            Cards estratégicos — <span className="text-primary">{report.input?.companyName}</span>
          </>
        }
        acoes={
          <>
            <Button variant="outline" size="sm" onClick={() => setCards(null)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar ao briefing
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportTPMtoPdf(report, cards)}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Exportar PDF
            </Button>
          </>
        }
      >
        <StrategicCards cards={cards} />
      </TpmShell>
    );
  }

  return (
    <TpmShell
      titulo={
        <>
          Briefing — <span className="text-primary">{report.input?.companyName}</span>
        </>
      }
      acoes={
        <>
          <Button variant="outline" size="sm" onClick={simular} disabled={simulando}>
            <Users className="mr-1.5 h-4 w-4" />
            {simulando ? "Gerando cards..." : "Simulação de reunião"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportTPMtoPdf(report)}>
            <FileDown className="mr-1.5 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={compartilhar}>
            <Share2 className="mr-1.5 h-4 w-4" />
            Compartilhar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setReport(null);
              setCards(null);
              navigate({ to: "/tpm/novo" });
            }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Novo TPM
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <TPMReportView report={report} />
        <div className="hidden lg:block">
          <QualityPanel quality={report.quality} />
        </div>
      </div>
    </TpmShell>
  );
}
