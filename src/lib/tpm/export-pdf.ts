// Portado de tailor-pre-meeting. Sem biblioteca de PDF: monta um HTML e chama
// window.print(), deixando o "Salvar como PDF" do navegador fazer o resto.
import type { TPMReport } from "./types";

interface StrategicCard {
  type: string;
  title: string;
  argument: string;
  evidence: string;
  hook: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReportHtml(report: TPMReport, cards?: StrategicCard[]): string {
  const companyName = report.input?.companyName || "Empresa";

  const sections: string[] = [];

  // Header
  sections.push(`
    <div style="text-align:center;margin-bottom:32px;border-bottom:2px solid #1a1a2e;padding-bottom:24px;">
      <h1 style="font-size:28px;color:#1a1a2e;margin:0;">TPM — ${escapeHtml(companyName)}</h1>
      <p style="color:#666;margin-top:8px;font-size:13px;">Gerado em ${new Date(report.createdAt).toLocaleDateString("pt-BR")} · Tailor Executive Search</p>
    </div>
  `);

  // Executive Summary
  sections.push(`
    <div style="margin-bottom:24px;">
      <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Executive Summary</h2>
      <p style="font-size:13px;line-height:1.7;">${escapeHtml(report.executiveSummary)}</p>
    </div>
  `);

  // Market
  sections.push(`
    <div style="margin-bottom:24px;">
      <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Mercado</h2>
      <p style="font-size:13px;line-height:1.7;">${escapeHtml(report.market.overview)}</p>
      <h3 style="font-size:14px;color:#444;margin-top:12px;">Tendências</h3>
      <ul style="font-size:13px;line-height:1.8;">${report.market.trends.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      <h3 style="font-size:14px;color:#444;margin-top:12px;">Pressões</h3>
      <ul style="font-size:13px;line-height:1.8;">${report.market.pressures.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      <h3 style="font-size:14px;color:#444;margin-top:12px;">Concorrentes</h3>
      <ul style="font-size:13px;line-height:1.8;">${report.market.competitors.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    </div>
  `);

  // Company
  sections.push(`
    <div style="margin-bottom:24px;">
      <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Empresa</h2>
      <h3 style="font-size:14px;color:#444;">História e Evolução</h3>
      <p style="font-size:13px;line-height:1.7;">${escapeHtml(report.company.businessModel)}</p>
      ${report.company.sizeAndScale ? `<h3 style="font-size:14px;color:#444;margin-top:12px;">Tamanho e Escala</h3><p style="font-size:13px;line-height:1.7;">${escapeHtml(report.company.sizeAndScale)}</p>` : ""}
      ${report.company.productsAndServices ? `<h3 style="font-size:14px;color:#444;margin-top:12px;">Produtos e Serviços</h3><p style="font-size:13px;line-height:1.7;">${escapeHtml(report.company.productsAndServices)}</p>` : ""}
      ${report.company.clientsAndMarket ? `<h3 style="font-size:14px;color:#444;margin-top:12px;">Clientes e Mercado</h3><p style="font-size:13px;line-height:1.7;">${escapeHtml(report.company.clientsAndMarket)}</p>` : ""}
      <p style="font-size:13px;"><strong>Presença Geográfica:</strong> ${escapeHtml(report.company.geographicPresence)}</p>
      <h3 style="font-size:14px;color:#444;margin-top:12px;">Sinais de Momento Estratégico</h3>
      <ul style="font-size:13px;line-height:1.8;">${report.company.strategicMomentSignals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
    </div>
  `);

  // Executives
  sections.push(`
    <div style="margin-bottom:24px;">
      <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Executivos</h2>
      ${report.executives
        .map(
          (exec) => `
        <div style="border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:12px;">
          <h3 style="font-size:15px;margin:0;">${escapeHtml(exec.name)} ${exec.title ? `— ${escapeHtml(exec.title)}` : ""}</h3>
          ${exec.powerLevel ? `<span style="font-size:11px;background:#eee;padding:2px 8px;border-radius:4px;">${escapeHtml(exec.powerLevel)}</span>` : ""}
          ${exec.trajectory ? `<p style="font-size:13px;margin-top:8px;">${escapeHtml(exec.trajectory)}</p>` : ""}
          ${exec.probableAgenda ? `<p style="font-size:13px;"><strong>Agenda Provável:</strong> ${escapeHtml(exec.probableAgenda)}</p>` : ""}
          ${exec.connectionPoints?.length ? `<p style="font-size:13px;"><strong>Pontos de Conexão:</strong> ${exec.connectionPoints.map((c) => escapeHtml(c)).join("; ")}</p>` : ""}
        </div>
      `,
        )
        .join("")}
    </div>
  `);

  // Leitura estratégica. A seção some inteira quando não há dados: relatórios
  // antigos e a versão cliente do briefing chegam sem ela, e o acesso direto
  // derrubava a exportação com TypeError.
  const leitura = report.strategicReading;
  const dores = leitura?.painHypotheses ?? [];
  const objecoes = leitura?.possibleObjections ?? [];
  const alavancas = leitura?.consultingLevers ?? [];
  if (dores.length || objecoes.length || alavancas.length) {
    const bloco = (
      titulo: string,
      itens: Array<{ text: string; uncertainty: number }>,
      aspas = false,
    ) =>
      itens.length
        ? `<h3 style="font-size:14px;color:#444;">${titulo}</h3>
      <ul style="font-size:13px;line-height:1.8;">${itens
        .map(
          (i) =>
            `<li>${aspas ? '"' : ""}${escapeHtml(i.text)}${aspas ? '"' : ""} <em>(${i.uncertainty}% certeza)</em></li>`,
        )
        .join("")}</ul>`
        : "";
    sections.push(`
    <div style="margin-bottom:24px;">
      <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Leitura Estratégica</h2>
      ${bloco("Hipóteses de Dores", dores)}
      ${bloco("Possíveis Objeções", objecoes, true)}
      ${bloco("Alavancas Consultivas", alavancas)}
    </div>
  `);
  }

  // Surgical Questions
  const catLabels: Record<string, string> = {
    strategy: "Estratégia",
    culture: "Cultura",
    blueprint: "Blueprint",
    decisionProcess: "Processo Decisório",
  };
  sections.push(`
    <div style="margin-bottom:24px;">
      <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Perguntas Cirúrgicas</h2>
      ${(["strategy", "culture", "blueprint", "decisionProcess"] as const)
        .map(
          (cat) => `
        <h3 style="font-size:14px;color:#444;">${catLabels[cat]}</h3>
        <ul style="font-size:13px;line-height:1.8;">${report.surgicalQuestions[cat].map((q) => `<li>${q.highPower ? "⚡ " : ""}${escapeHtml(q.text)}</li>`).join("")}</ul>
      `,
        )
        .join("")}
    </div>
  `);

  // Tailor Connections
  if (report.tailorConnections?.length) {
    // Deduplicate by caseName
    const connMap = new Map<string, (typeof report.tailorConnections)[0]>();
    for (const conn of report.tailorConnections) {
      const key = conn.caseName.toLowerCase().trim();
      if (!connMap.has(key) || conn.similarity > connMap.get(key)!.similarity) {
        connMap.set(key, conn);
      }
    }
    const dedupedConns = Array.from(connMap.values());
    sections.push(`
      <div style="margin-bottom:24px;">
        <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Conexões Tailor (${dedupedConns.length} empresas)</h2>
        ${dedupedConns
          .map(
            (conn) => `
          <div style="border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:8px;">
            <strong>${escapeHtml(conn.caseName)}</strong> ${conn.sector ? `<span style="color:#666;font-size:12px;">(${escapeHtml(conn.sector)})</span>` : ""}
            ${conn.positions?.length ? `<div style="margin-top:6px;"><span style="font-size:11px;text-transform:uppercase;color:#888;font-weight:600;">Posições Conduzidas:</span><ul style="font-size:13px;margin:4px 0 0;line-height:1.6;">${conn.positions.map((p) => `<li>✓ ${escapeHtml(p)}</li>`).join("")}</ul></div>` : `<p style="font-size:13px;color:#666;margin:4px 0 0;">${escapeHtml(conn.justification)}</p>`}
          </div>
        `,
          )
          .join("")}
      </div>
    `);
  }

  // Strategic Cards
  if (cards?.length) {
    sections.push(`
      <div style="page-break-before:always;margin-bottom:24px;">
        <h2 style="font-size:18px;color:#1a1a2e;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">Cards Estratégicos — Simulação de Reunião</h2>
        ${cards
          .map(
            (card, i) => `
          <div style="border:1px solid #e0e0e0;border-left:4px solid #1a1a2e;border-radius:8px;padding:14px;margin-bottom:12px;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin:0 0 6px;">${escapeHtml(card.type.replace("_", " "))}</p>
            <h3 style="font-size:15px;margin:0 0 8px;">${escapeHtml(card.title)}</h3>
            <p style="font-size:13px;line-height:1.6;">${escapeHtml(card.argument)}</p>
            <p style="font-size:12px;color:#666;margin-top:8px;"><strong>Evidência:</strong> ${escapeHtml(card.evidence)}</p>
            <p style="font-size:12px;color:#1a1a2e;font-style:italic;margin-top:4px;">💬 "${escapeHtml(card.hook)}"</p>
          </div>
        `,
          )
          .join("")}
      </div>
    `);
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>TPM — ${escapeHtml(companyName)}</title>
      <style>
        @page { margin: 20mm; size: A4; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; max-width: 800px; margin: 0 auto; }
        h2 { page-break-after: avoid; }
        div { page-break-inside: avoid; }
      </style>
    </head>
    <body>${sections.join("")}</body>
    </html>
  `;
}

export function exportTPMtoPdf(report: TPMReport, cards?: StrategicCard[]) {
  const html = buildReportHtml(report, cards);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Permita pop-ups para exportar o PDF.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
