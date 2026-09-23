import {
  AlertCircle,
  Brain,
  Building2,
  CheckCircle,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Link2,
  Search,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TPMReport } from "@/lib/tpm/types";

import { SectionFeedback } from "./SectionFeedback";

// Portado de tailor-pre-meeting. Duas mudanças de fundo:
//
// 1. Sem framer-motion — o hub não tem a dependência e era só um fade de entrada.
// 2. TODAS as seções são opcionais aqui. A versão pública do briefing (link
//    compartilhado) chega sem leitura estratégica, sem conexões e sem
//    autoridade Tailor, porque a rota /api/tpm/shared as remove. O componente
//    original lia `report.strategicReading.painHypotheses` direto e quebraria
//    a página inteira nesse caso.

function SectionCard({
  icon: Icon,
  title,
  children,
  reportId,
  sectionKey,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  reportId?: string;
  sectionKey?: string;
}) {
  return (
    <section className="surface-elevated p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </h2>
        {reportId && sectionKey && <SectionFeedback reportId={reportId} sectionKey={sectionKey} />}
      </div>
      {children}
    </section>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const variant = value >= 70 ? "default" : value >= 40 ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className="text-xs shrink-0">
      {value}% certeza
    </Badge>
  );
}

const ROTULO_CATEGORIA: Record<string, string> = {
  strategy: "Estratégia",
  culture: "Cultura",
  blueprint: "Blueprint",
  decisionProcess: "Processo Decisório",
};

export function TPMReportView({
  report,
  publico = false,
}: {
  report: TPMReport;
  /** Versão cliente: sem feedback (não há sessão) e sem seções internas. */
  publico?: boolean;
}) {
  const idParaFeedback = publico ? undefined : report.id;

  // Um mesmo cliente pode aparecer em vários cases; fica o de maior afinidade.
  const conexoes = (() => {
    const lista = report.tailorConnections ?? [];
    const mapa = new Map<string, (typeof lista)[number]>();
    for (const c of lista) {
      const chave = c.caseName.toLowerCase().trim();
      const atual = mapa.get(chave);
      if (!atual || c.similarity > atual.similarity) mapa.set(chave, c);
    }
    return Array.from(mapa.values());
  })();

  const perguntas = (() => {
    const cats = ["strategy", "culture", "blueprint", "decisionProcess"] as const;
    const out: Array<{ text: string; label: string }> = [];
    for (const cat of cats) {
      for (const q of report.surgicalQuestions?.[cat] ?? []) {
        out.push({ text: q.text, label: ROTULO_CATEGORIA[cat] });
      }
    }
    return out.slice(0, 5);
  })();

  // O prompt já manda descartar abaixo de 85, mas relatórios antigos têm itens
  // fracos gravados — o filtro fica para não exibi-los agora.
  const leitura = report.strategicReading;
  const dores = (leitura?.painHypotheses ?? []).filter((p) => p.uncertainty >= 85);
  const objecoes = (leitura?.possibleObjections ?? []).filter((o) => o.uncertainty >= 85);
  const alavancas = (leitura?.consultingLevers ?? []).filter((l) => l.uncertainty >= 85);

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="font-heading text-2xl md:text-3xl text-foreground">
          Briefing pré-reunião — <span className="text-primary">{report.input?.companyName}</span>
        </h1>
      </div>

      {report.executiveSummary && (
        <SectionCard
          icon={FileText}
          title="Resumo executivo"
          reportId={idParaFeedback}
          sectionKey="executiveSummary"
        >
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {report.executiveSummary}
          </p>
        </SectionCard>
      )}

      {report.market && (
        <SectionCard
          icon={TrendingUp}
          title="Mercado"
          reportId={idParaFeedback}
          sectionKey="market"
        >
          {report.market.overview && (
            <p className="text-sm text-foreground/80">{report.market.overview}</p>
          )}
          {(report.market.trends?.length ?? 0) > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                  Dinâmica do mercado
                </h4>
                <ul className="space-y-1.5">
                  {report.market.trends.map((t, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {(report.market.pressures?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                Pressões
              </h4>
              <ul className="space-y-1.5">
                {report.market.pressures.map((p, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(report.market.competitors?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                Concorrentes
              </h4>
              <ul className="space-y-1">
                {report.market.competitors.map((c, i) => (
                  <li key={i} className="text-sm text-foreground/80">
                    • {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      {report.company && (
        <SectionCard
          icon={Building2}
          title="Empresa"
          reportId={idParaFeedback}
          sectionKey="company"
        >
          <div className="space-y-3">
            {report.company.businessModel && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  História e evolução
                </h4>
                <p className="text-sm whitespace-pre-line">{report.company.businessModel}</p>
              </div>
            )}
            {report.company.sizeAndScale && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Tamanho e escala
                </h4>
                <p className="text-sm whitespace-pre-line">{report.company.sizeAndScale}</p>
              </div>
            )}
            {report.company.productsAndServices && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Produtos e serviços
                </h4>
                <p className="text-sm whitespace-pre-line">{report.company.productsAndServices}</p>
              </div>
            )}
            {report.company.clientsAndMarket && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Clientes e mercado
                </h4>
                <p className="text-sm whitespace-pre-line">{report.company.clientsAndMarket}</p>
              </div>
            )}
            {report.company.geographicPresence && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Presença geográfica
                </h4>
                <p className="text-sm">{report.company.geographicPresence}</p>
              </div>
            )}
            {(report.company.strategicMomentSignals?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Momento estratégico
                </h4>
                <ul className="space-y-1">
                  {report.company.strategicMomentSignals.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(report.company.facts?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-success" /> Fatos com fonte
                  </h4>
                  {report.company.facts.map((f, i) => (
                    <div key={i} className="text-sm mb-2">
                      <p>{f.text}</p>
                      {f.url && (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:underline break-all"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" /> {f.source}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(report.company.hypotheses?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Info className="h-3.5 w-3.5 text-warning" /> Hipóteses — confirmar
                  </h4>
                  {report.company.hypotheses.map((h, i) => (
                    <div key={i} className="text-sm mb-2 flex items-start justify-between gap-2">
                      <span>{h.text}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {h.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        icon={Users}
        title="Mapa de poder"
        reportId={idParaFeedback}
        sectionKey="executives"
      >
        {(report.executives?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhum executivo encontrado com confiança suficiente.
          </p>
        ) : (
          report.executives.map((exec) => {
            // O prompt manda devolver uma entrada assim quando não achou o RH
            // com segurança, com as buscas manuais sugeridas no lugar.
            const naoEncontrado = exec.name?.includes("não encontrado");
            if (naoEncontrado) {
              return (
                <div
                  key={exec.id}
                  className="border border-warning/30 bg-warning/5 rounded-lg p-4 space-y-2"
                >
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-warning">
                    <Search className="h-4 w-4" />
                    {exec.name}
                  </h4>
                  {(exec.connectionPoints?.length ?? 0) > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Buscas sugeridas
                      </h5>
                      <ul className="space-y-1">
                        {exec.connectionPoints!.map((q, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground/80 font-mono bg-muted/50 px-2 py-1 rounded"
                          >
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={exec.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold flex items-center gap-2">
                      {exec.name}
                      {exec.linkedinUrl && (
                        <a
                          href={exec.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          aria-label={`Perfil de ${exec.name}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {exec.title}
                      {exec.company ? ` · ${exec.company}` : ""}
                    </p>
                  </div>
                  {exec.powerLevel && (
                    <Badge
                      variant={exec.powerLevel === "Decisor" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {exec.powerLevel}
                    </Badge>
                  )}
                </div>
                {exec.trajectory && <p className="text-sm text-foreground/80">{exec.trajectory}</p>}
                {exec.timeAtCompany && (
                  <p className="text-xs text-muted-foreground">
                    Tempo na empresa: {exec.timeAtCompany}
                  </p>
                )}
                {exec.probableAgenda && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Agenda provável
                    </h5>
                    <p className="text-sm">{exec.probableAgenda}</p>
                  </div>
                )}
                {(exec.connectionPoints?.length ?? 0) > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-success mb-1">
                      Ganchos de abordagem
                    </h5>
                    <ul className="space-y-1">
                      {exec.connectionPoints!.map((c, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Link2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(exec.approachRisks?.length ?? 0) > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-destructive mb-1">
                      Riscos de abordagem
                    </h5>
                    <ul className="space-y-1">
                      {exec.approachRisks!.map((r, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />{" "}
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </SectionCard>

      {/* Daqui para baixo é material interno: no link público estas seções não
          chegam do servidor, então nada disso renderiza. */}
      {!publico && (
        <SectionCard
          icon={Link2}
          title="Conexões Tailor"
          reportId={idParaFeedback}
          sectionKey="tailorConnections"
        >
          {conexoes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma empresa com afinidade setorial encontrada na base de cases.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {conexoes.length} empresa(s) com afinidade setorial na base Tailor
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {conexoes.map((conn) => (
                  <div key={conn.caseId} className="border border-border rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-1">{conn.caseName}</h4>
                    {conn.sector && (
                      <p className="text-xs text-muted-foreground mb-2">{conn.sector}</p>
                    )}
                    {(conn.positions?.length ?? 0) > 0 ? (
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Posições conduzidas
                        </h5>
                        <ul className="space-y-0.5">
                          {conn.positions.map((pos, i) => (
                            <li key={i} className="text-sm flex items-center gap-1.5">
                              <CheckCircle className="h-3 w-3 text-success shrink-0" />
                              {pos}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{conn.justification}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      )}

      {!publico && report.tailorAuthority && (
        <SectionCard
          icon={Zap}
          title="Autoridade Tailor"
          reportId={idParaFeedback}
          sectionKey="tailorAuthority"
        >
          <p className="text-sm leading-relaxed text-foreground/90 mb-4">
            {report.tailorAuthority.summary}
          </p>
          <div className="space-y-3">
            {report.tailorAuthority.justifications?.map((j, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  {j.point}
                </h4>
                <p className="text-sm text-muted-foreground mt-1 ml-6">{j.evidence}</p>
              </div>
            ))}
          </div>
          {(report.tailorAuthority.relevantSectors?.length ?? 0) > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Setores com expertise
              </h4>
              <div className="flex flex-wrap gap-2">
                {report.tailorAuthority.relevantSectors.map((s, i) => (
                  <Badge key={i} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {(report.tailorAuthority.relevantClients?.length ?? 0) > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Clientes de referência
              </h4>
              <div className="flex flex-wrap gap-2">
                {report.tailorAuthority.relevantClients.map((c, i) => (
                  <Badge key={i} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {!publico && leitura && (
        <SectionCard
          icon={Brain}
          title="Leitura estratégica"
          reportId={idParaFeedback}
          sectionKey="strategicReading"
        >
          <div className="space-y-4">
            {dores.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Hipóteses de dores
                </h4>
                {dores.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm">{p.text}</span>
                    <ConfidenceBadge value={p.uncertainty} />
                  </div>
                ))}
              </div>
            )}
            {objecoes.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Possíveis objeções
                  </h4>
                  {objecoes.map((o, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm italic">&ldquo;{o.text}&rdquo;</span>
                      <ConfidenceBadge value={o.uncertainty} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {alavancas.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Alavancas comerciais
                  </h4>
                  {alavancas.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm">{l.text}</span>
                      <ConfidenceBadge value={l.uncertainty} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {dores.length === 0 && objecoes.length === 0 && alavancas.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Nenhum item com certeza acima de 85%. Vale explorar na reunião.
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {perguntas.length > 0 && (
        <SectionCard
          icon={HelpCircle}
          title="Perguntas de alta potência"
          reportId={idParaFeedback}
          sectionKey="surgicalQuestions"
        >
          <div className="space-y-2">
            {perguntas.map((q, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-foreground">{q.text}</span>
                  <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                    {q.label}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {(report.gaps?.length ?? 0) > 0 && (
        <SectionCard
          icon={Search}
          title="A confirmar na reunião"
          reportId={idParaFeedback}
          sectionKey="gaps"
        >
          <ul className="space-y-1.5">
            {report.gaps.map((g, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
