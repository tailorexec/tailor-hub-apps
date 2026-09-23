import { Award, Lightbulb, Target, TrendingUp, UserCheck, Zap } from "lucide-react";
import type { ComponentType } from "react";

export interface StrategicCard {
  type:
    | "pain_point"
    | "market_insight"
    | "case_proof"
    | "executive_hook"
    | "urgency_trigger"
    | "value_proposition";
  title: string;
  argument: string;
  evidence: string;
  hook: string;
}

const CONFIG: Record<
  string,
  { icon: ComponentType<{ className?: string }>; label: string; accent: string }
> = {
  pain_point: {
    icon: Target,
    label: "Dor do cliente",
    accent: "text-destructive border-destructive/30 bg-destructive/5",
  },
  market_insight: {
    icon: TrendingUp,
    label: "Insight de mercado",
    accent: "text-primary border-primary/30 bg-primary/5",
  },
  case_proof: {
    icon: Award,
    label: "Case Tailor",
    accent: "text-success border-success/30 bg-success/5",
  },
  executive_hook: {
    icon: UserCheck,
    label: "Gancho executivo",
    accent: "text-accent-foreground border-accent bg-accent/30",
  },
  urgency_trigger: {
    icon: Zap,
    label: "Gatilho de urgência",
    accent: "text-destructive border-destructive/30 bg-destructive/5",
  },
  value_proposition: {
    icon: Lightbulb,
    label: "Proposta de valor",
    accent: "text-primary border-primary/30 bg-primary/5",
  },
};

export function StrategicCards({ cards }: { cards: StrategicCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nenhum card foi gerado para este briefing.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const config = CONFIG[card.type] ?? CONFIG.value_proposition;
        const Icon = config.icon;
        return (
          <div
            key={i}
            className={`surface-elevated p-5 border-l-4 ${config.accent} flex flex-col gap-3`}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[10px] uppercase tracking-widest font-semibold">
                {config.label}
              </span>
            </div>
            <h3 className="font-heading text-lg leading-tight text-foreground">{card.title}</h3>
            <p className="text-sm text-foreground/90 leading-relaxed">{card.argument}</p>
            <div className="mt-auto pt-3 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Evidência:</span> {card.evidence}
              </p>
              <p className="text-xs text-primary/80 italic">&ldquo;{card.hook}&rdquo;</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
