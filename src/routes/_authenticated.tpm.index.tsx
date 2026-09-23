import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  FileDown,
  Loader2,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QualityPanel } from "@/components/tpm/QualityPanel";
import { StrategicCards, type StrategicCard } from "@/components/tpm/StrategicCards";
import { TPMReportView } from "@/components/tpm/TPMReportView";
import { TpmShell } from "@/components/tpm/TpmShell";
import { toast } from "@/hooks/use-toast";
import {
  excluirRelatorio,
  garantirLinkPublico,
  gerarSimulacao,
  lerRelatorio,
  listarRelatorios,
  type ReportRow,
} from "@/lib/tpm/api";
import { exportTPMtoPdf } from "@/lib/tpm/export-pdf";
import type { TPMReport } from "@/lib/tpm/types";

export const Route = createFileRoute("/_authenticated/tpm/")({
  component: HistoricoTPM,
});

function HistoricoTPM() {
  const [linhas, setLinhas] = useState<ReportRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<TPMReport | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [cards, setCards] = useState<StrategicCard[] | null>(null);
  const [simulando, setSimulando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setLinhas(await listarRelatorios());
    } catch (e) {
      toast({
        title: "Erro ao carregar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((l) => l.company_name.toLowerCase().includes(termo));
  }, [linhas, busca]);

  const abrir = async (id: string) => {
    setAbrindo(id);
    try {
      setAberto(await lerRelatorio(id));
      setCards(null);
      window.scrollTo(0, 0);
    } catch (e) {
      toast({
        title: "Erro ao abrir",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAbrindo(null);
    }
  };

  const excluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir o briefing de ${nome}? Isso não pode ser desfeito.`)) return;
    try {
      await excluirRelatorio(id);
      setLinhas((prev) => prev.filter((l) => l.id !== id));
      if (aberto?.id === id) setAberto(null);
      toast({ title: "Briefing excluído" });
    } catch (e) {
      toast({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const compartilhar = async (id: string, tokenAtual: string | null) => {
    try {
      const url = await garantirLinkPublico(id, tokenAtual);
      await navigator.clipboard.writeText(url);
      // O link atualiza a linha em memória para não pedir um token novo depois.
      setLinhas((prev) =>
        prev.map((l) => (l.id === id ? { ...l, share_token: url.split("/").pop()! } : l)),
      );
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

  const simular = async () => {
    if (!aberto) return;
    setSimulando(true);
    try {
      const gerados = (await gerarSimulacao(aberto.id)) as StrategicCard[];
      setCards(gerados);
      window.scrollTo(0, 0);
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

  // ── Briefing aberto ───────────────────────────────────────────────────────
  if (aberto) {
    if (cards) {
      return (
        <TpmShell
          titulo={
            <>
              Cards estratégicos — <span className="text-primary">{aberto.input?.companyName}</span>
            </>
          }
          acoes={
            <Button variant="outline" size="sm" onClick={() => setCards(null)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar ao briefing
            </Button>
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
            Briefing — <span className="text-primary">{aberto.input?.companyName}</span>
          </>
        }
        descricao={`Gerado em ${new Date(aberto.createdAt).toLocaleDateString("pt-BR")}`}
        acoes={
          <>
            <Button variant="outline" size="sm" onClick={() => setAberto(null)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar à lista
            </Button>
            <Button variant="outline" size="sm" onClick={simular} disabled={simulando}>
              <Users className="mr-1.5 h-4 w-4" />
              {simulando ? "Gerando..." : "Simulação"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportTPMtoPdf(aberto)}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Exportar PDF
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <TPMReportView report={aberto} />
          <div className="hidden lg:block">
            <QualityPanel quality={aberto.quality} />
          </div>
        </div>
      </TpmShell>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <TpmShell titulo="Briefings" descricao="Todos os TPMs já gerados.">
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por empresa..."
          className="pl-9"
        />
      </div>

      <div className="surface-elevated overflow-hidden">
        {carregando ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {busca ? "Nenhum briefing para esta busca." : "Nenhum briefing gerado ainda."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtradas.map((l) => (
              <li
                key={l.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4"
              >
                <button
                  onClick={() => void abrir(l.id)}
                  className="flex items-start gap-3 min-w-0 text-left flex-1 hover:opacity-80 transition-opacity"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {l.company_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      {l.quality_score != null && ` · confiabilidade ${l.quality_score}%`}
                      {l.simulation_generated && " · com cards"}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {abrindo === l.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void compartilhar(l.id, l.share_token)}
                    title="Copiar link da versão cliente"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void excluir(l.id, l.company_name)}
                    title="Excluir briefing"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TpmShell>
  );
}
