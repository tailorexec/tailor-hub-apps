// Cliente das rotas do TPM.
//
// O navegador NÃO fala com o Supabase do TPM — só com estas rotas do hub, que
// carregam a service key do lado de lá. Por isso toda chamada leva o token da
// sessão do hub no cabeçalho: é ele que o servidor valida.
import { supabase } from "@/integrations/supabase/client";

import type { ParsedAgenda, TPMInput, TPMReport } from "./types";

async function comToken(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function json<T>(res: Response): Promise<T> {
  const corpo = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(corpo.error ?? `Falha HTTP ${res.status}.`);
  return corpo as T;
}

export interface ReportRow {
  id: string;
  company_name: string;
  created_at: string;
  updated_at: string;
  quality_score: number | null;
  share_token: string | null;
  simulation_generated: boolean;
  version: string;
}

export interface CaseRow {
  id: string;
  client_name: string;
  sector: string;
  function_searched: string;
  seniority: string;
  complexity: string;
  region: string;
  result: string | null;
  years: string | null;
  tags: string[] | null;
  confidential: boolean;
  created_at: string;
}

export async function listarRelatorios(): Promise<ReportRow[]> {
  const res = await fetch("/api/tpm/reports", { headers: await comToken() });
  return (await json<{ reports: ReportRow[] }>(res)).reports;
}

/** Converte a linha do banco no formato que a interface consome. */
export function linhaParaRelatorio(linha: {
  id: string;
  created_at: string;
  version?: string;
  input_data?: unknown;
  report_data?: unknown;
}): TPMReport {
  return {
    id: linha.id,
    input: (linha.input_data ?? {}) as TPMReport["input"],
    ...((linha.report_data ?? {}) as object),
    createdAt: linha.created_at,
    version: (linha.version as "internal" | "client") ?? "internal",
  } as TPMReport;
}

export async function lerRelatorio(id: string): Promise<TPMReport> {
  const res = await fetch(`/api/tpm/reports?id=${encodeURIComponent(id)}`, {
    headers: await comToken(),
  });
  const { report } = await json<{ report: Parameters<typeof linhaParaRelatorio>[0] }>(res);
  return linhaParaRelatorio(report);
}

export async function excluirRelatorio(id: string): Promise<void> {
  const res = await fetch(`/api/tpm/reports?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await comToken(),
  });
  await json(res);
}

/** Cria o link público se ainda não existir, e devolve a URL completa. */
export async function garantirLinkPublico(id: string, tokenAtual: string | null): Promise<string> {
  let token = tokenAtual;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "").substring(0, 12);
    const res = await fetch("/api/tpm/reports", {
      method: "PATCH",
      headers: await comToken(),
      body: JSON.stringify({ id, shareToken: token }),
    });
    await json(res);
  }
  // Caminho curto e sem jargão: o link vai para o cliente, não para dentro de casa.
  return `${window.location.origin}/briefing/${token}`;
}

export async function gerarSimulacao(reportId: string): Promise<unknown[]> {
  const res = await fetch("/api/tpm/simulate", {
    method: "POST",
    headers: await comToken(),
    body: JSON.stringify({ reportId }),
  });
  const { cards } = await json<{ cards: unknown[] }>(res);
  return cards ?? [];
}

export async function lerAgenda(imageBase64: string, mimeType: string): Promise<ParsedAgenda> {
  const res = await fetch("/api/tpm/parse-agenda", {
    method: "POST",
    headers: await comToken(),
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  return (await json<{ data: ParsedAgenda }>(res)).data;
}

export async function listarCases(): Promise<CaseRow[]> {
  const res = await fetch("/api/tpm/cases", { headers: await comToken() });
  return (await json<{ cases: CaseRow[] }>(res)).cases;
}

export async function criarCase(dados: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/tpm/cases", {
    method: "POST",
    headers: await comToken(),
    body: JSON.stringify(dados),
  });
  await json(res);
}

export interface ResultadoMatch {
  match: { mainSector?: string; matchingSectors?: string[]; reasoning?: string };
  /** Setores casados já expandidos por família (tech, financeiro, etc.). */
  expandidos: string[];
}

export async function buscarPorSetor(query: string): Promise<ResultadoMatch> {
  const res = await fetch("/api/tpm/match-sector", {
    method: "POST",
    headers: await comToken(),
    body: JSON.stringify({ query }),
  });
  return json<ResultadoMatch>(res);
}

export async function lerFeedback(
  reportId: string,
): Promise<{ section_key: string; feedback: string }[]> {
  const res = await fetch(`/api/tpm/feedback?reportId=${encodeURIComponent(reportId)}`, {
    headers: await comToken(),
  });
  return (await json<{ feedback: { section_key: string; feedback: string }[] }>(res)).feedback;
}

export async function enviarFeedback(
  reportId: string,
  sectionKey: string,
  feedback: "positive" | "negative",
): Promise<void> {
  const res = await fetch("/api/tpm/feedback", {
    method: "POST",
    headers: await comToken(),
    body: JSON.stringify({ reportId, sectionKey, feedback }),
  });
  await json(res);
}

export interface ProgressoGeracao {
  stage: string;
  pct?: number;
  label?: string;
}

/**
 * Geração do briefing. A resposta é um stream de eventos porque a pesquisa na
 * web leva minutos — `onProgresso` recebe cada passo.
 */
export async function gerarTPM(
  input: TPMInput,
  onProgresso?: (p: ProgressoGeracao) => void,
): Promise<TPMReport> {
  // O File do upload não é serializável e já foi convertido para base64 antes.
  const { agendaPrint: _ignorado, ...limpo } = input;

  const res = await fetch("/api/tpm/generate", {
    method: "POST",
    headers: await comToken(),
    body: JSON.stringify({ input: limpo }),
  });

  if (!res.ok || !res.body) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error ?? `Falha HTTP ${res.status}.`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let relatorio: TPMReport | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Eventos SSE são separados por linha em branco.
    const partes = buffer.split("\n\n");
    buffer = partes.pop() ?? "";
    for (const parte of partes) {
      const linha = parte.split("\n").find((l) => l.startsWith("data: "));
      if (!linha) continue;
      let evento: Record<string, unknown>;
      try {
        evento = JSON.parse(linha.slice(6));
      } catch {
        continue;
      }
      if (evento.stage === "erro") throw new Error(String(evento.error ?? "Erro ao gerar."));
      if (evento.stage === "pronto") relatorio = evento.report as TPMReport;
      onProgresso?.(evento as unknown as ProgressoGeracao);
    }
  }

  if (!relatorio) throw new Error("A geração terminou sem devolver o briefing.");
  return relatorio;
}
