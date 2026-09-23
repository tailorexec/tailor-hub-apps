import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { enviarFeedback, lerFeedback } from "@/lib/tpm/api";
import { cn } from "@/lib/utils";

type Voto = "positive" | "negative";

export function SectionFeedback({
  reportId,
  sectionKey,
}: {
  reportId: string;
  sectionKey: string;
}) {
  const [voto, setVoto] = useState<Voto | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    lerFeedback(reportId)
      .then((linhas) => {
        if (!ativo) return;
        // A tabela guarda histórico: vale o último voto desta seção.
        const desta = linhas.filter((l) => l.section_key === sectionKey);
        const ultimo = desta[desta.length - 1];
        if (ultimo) setVoto(ultimo.feedback as Voto);
      })
      .catch(() => {
        // Feedback é acessório: falhar em lê-lo não deve poluir a tela do
        // briefing com erro.
      });
    return () => {
      ativo = false;
    };
  }, [reportId, sectionKey]);

  const votar = async (valor: Voto) => {
    if (salvando) return;
    const novo = voto === valor ? null : valor;
    setVoto(novo);
    if (!novo) return;

    setSalvando(true);
    try {
      await enviarFeedback(reportId, sectionKey, novo);
    } catch {
      setVoto(voto); // desfaz a marcação se não gravou
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Seção útil"
        className={cn(
          "h-7 w-7 p-0 rounded-full",
          voto === "positive" && "bg-success/20 text-success hover:bg-success/30",
        )}
        onClick={(e) => {
          e.stopPropagation();
          void votar("positive");
        }}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Seção sem utilidade"
        className={cn(
          "h-7 w-7 p-0 rounded-full",
          voto === "negative" && "bg-destructive/20 text-destructive hover:bg-destructive/30",
        )}
        onClick={(e) => {
          e.stopPropagation();
          void votar("negative");
        }}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
