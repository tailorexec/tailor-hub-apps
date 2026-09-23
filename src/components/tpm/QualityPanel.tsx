import { AlertTriangle, CheckCircle, Info, Shield } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { QualityMetrics } from "@/lib/tpm/types";

// Portado de tailor-pre-meeting. A animação de entrada usava framer-motion;
// aqui ela saiu — não valia uma dependência nova no hub por um fade.

function corDaConfianca(valor: number) {
  if (valor >= 70) return "text-success";
  if (valor >= 40) return "text-warning";
  return "text-destructive";
}

function rotuloDaConfianca(valor: number) {
  if (valor >= 70) return "Alta";
  if (valor >= 40) return "Média";
  return "Baixa";
}

export function QualityPanel({ quality }: { quality: QualityMetrics }) {
  const confianca = quality?.overallConfidence ?? 0;

  return (
    <div className="surface-elevated p-5 space-y-5 sticky top-4">
      <h3 className="font-heading text-lg flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        Confiabilidade
      </h3>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Confiabilidade geral</span>
          <span className={`text-2xl font-bold ${corDaConfianca(confianca)}`}>{confianca}%</span>
        </div>
        <Progress value={confianca} className="h-2" />
        <span className={`text-xs ${corDaConfianca(confianca)}`}>
          {rotuloDaConfianca(confianca)}
        </span>
      </div>

      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-success" />
            Dados com fonte
          </span>
          <span className="text-sm font-medium">{quality?.sourcedDataPercent ?? 0}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-warning" />
            Hipóteses
          </span>
          <span className="text-sm font-medium">{quality?.hypothesesPercent ?? 0}%</span>
        </div>
      </div>

      {(quality?.alerts?.length ?? 0) > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Alertas
          </span>
          {quality.alerts.map((alerta, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{alerta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
