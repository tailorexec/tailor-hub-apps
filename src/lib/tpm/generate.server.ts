// Pipeline de geração do TPM.
//
// Equivalente à edge function `generate-tpm` do repositório tailor-pre-meeting,
// com duas diferenças de fundo:
//
// 1. A IA é a Anthropic (a mesma chave que o gerador de currículo já usa), não
//    o gateway do Lovable com Gemini.
// 2. A busca na web existe. Lá o prompt mandava pesquisar sem dar ferramenta
//    nenhuma — o modelo escrevia as fontes de memória. Aqui ele tem
//    `web_search` e o prompt exige URL vinda de resultado real.
import Anthropic from "@anthropic-ai/sdk";

import {
  MATCH_SECTOR_SYSTEM_PROMPT,
  PRECISION_SYSTEM_PROMPT,
  PRE_ID_SYSTEM_PROMPT,
  buildTpmSystemPrompt,
  buildTpmUserPrompt,
} from "./prompts";
import {
  agruparPorCliente,
  expandirPorFamilia,
  extrairTagsUnicas,
  filtrarCasesPorTags,
  filtroPrecisaoEhConfiavel,
  type CaseRow,
  type ServerConnection,
} from "./matching";
import type { TPMInput } from "./types";

const MODELO = () => process.env.ANTHROPIC_MODEL || "claude-opus-5";

/**
 * Teto de continuações do `pause_turn`.
 *
 * O laço de ferramentas do servidor pausa a cada 10 iterações de busca e espera
 * ser retomado. Sem retomar, o briefing volta pela metade — e sem erro nenhum,
 * que é o pior jeito de quebrar. Sem teto, um modelo em loop de buscas gastaria
 * sem limite.
 */
const MAX_CONTINUACOES = 5;

function textoDe(msg: Anthropic.Message) {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Tira cerca de markdown que o modelo às vezes põe em resposta livre. */
function semCerca(s: string) {
  const t = s.trim();
  const m = t.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return (m ? m[1] : t).trim();
}

/**
 * Extrai o objeto JSON de uma resposta livre.
 *
 * Necessário porque o briefing NÃO usa saída estruturada (ver a chamada em
 * `gerarBriefing`). Sem a gramática obrigando o formato, o modelo faz três
 * coisas que quebram um `JSON.parse` direto, todas observadas em teste:
 *
 *  1. escreve uma frase antes do JSON ("I'll research Ambev before writing...");
 *  2. envolve em cerca de markdown;
 *  3. é cortado no meio quando bate o teto de tokens.
 *
 * Os casos 1 e 2 se resolvem recortando do primeiro `{` ao último `}`. O caso 3
 * se resolve fechando as chaves e colchetes que ficaram abertos — o briefing
 * sai incompleto, mas o que veio é aproveitado, que é melhor do que perder
 * dois minutos de pesquisa.
 */
function extrairJson(bruto: string): Record<string, unknown> {
  const texto = semCerca(bruto);

  const inicio = texto.indexOf("{");
  if (inicio === -1) throw new Error("A resposta da IA não continha JSON.");
  const fim = texto.lastIndexOf("}");
  const recorte = fim > inicio ? texto.slice(inicio, fim + 1) : texto.slice(inicio);

  try {
    return JSON.parse(recorte) as Record<string, unknown>;
  } catch {
    // Fecha o que ficou aberto, ignorando chaves dentro de string.
    let pendentes = "";
    let emString = false;
    let escapado = false;
    for (const ch of recorte) {
      if (escapado) {
        escapado = false;
        continue;
      }
      if (ch === "\\") {
        escapado = true;
        continue;
      }
      if (ch === '"') emString = !emString;
      if (emString) continue;
      if (ch === "{") pendentes = "}" + pendentes;
      else if (ch === "[") pendentes = "]" + pendentes;
      else if (ch === "}" || ch === "]") pendentes = pendentes.slice(1);
    }
    const remendado = recorte.replace(/,\s*$/, "").replace(/:\s*$/, ": null") + pendentes;
    return JSON.parse(remendado) as Record<string, unknown>;
  }
}

/** Chamada curta, sem ferramentas — classificação e filtro. */
async function perguntaCurta(
  anthropic: Anthropic,
  system: string,
  user: string,
  maxTokens = 1500,
): Promise<string | null> {
  try {
    const msg = await anthropic.messages.create({
      model: MODELO(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low" },
    });
    if (msg.stop_reason === "refusal") return null;
    return textoDe(msg).trim();
  } catch (e) {
    // Estas chamadas são auxiliares: se falharem, o briefing ainda sai — só
    // perde precisão no matching. Não vale derrubar a geração inteira.
    console.warn("[tpm] chamada auxiliar falhou:", e);
    return null;
  }
}

/** Raspagem do site informado. Opcional: sem chave do Firecrawl, segue sem. */
export async function rasparWebsite(website: string | undefined): Promise<string> {
  if (!website) return "";
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  try {
    const url = /^https?:\/\//.test(website.trim()) ? website.trim() : `https://${website.trim()}`;
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) {
      console.warn("[tpm] firecrawl falhou:", res.status);
      return "";
    }
    const data = (await res.json()) as { data?: { markdown?: string }; markdown?: string };
    return (data.data?.markdown || data.markdown || "").substring(0, 2000);
  } catch (e) {
    console.warn("[tpm] erro ao raspar website:", e);
    return "";
  }
}

/**
 * Conexões Tailor: quais clientes da carteira têm afinidade com a empresa-alvo.
 *
 * O resultado NÃO é pedido à IA no prompt principal — é calculado aqui e
 * injetado depois, para que o briefing não possa inventar um cliente que a
 * Tailor não tem.
 */
export async function calcularConexoes(
  anthropic: Anthropic,
  input: TPMInput,
  cases: CaseRow[],
  websiteContent: string,
): Promise<{ conexoes: ServerConnection[]; descricaoEmpresa: string }> {
  let descricaoEmpresa = input.companyName;
  if (cases.length === 0) return { conexoes: [], descricaoEmpresa };

  const tagsDaBase = extrairTagsUnicas(cases);

  // 1) Que empresa é esta, afinal? O nome sozinho engana (uma "AgroTech" é de
  //    tecnologia, não de agronegócio) e isso contamina todo o matching.
  const contextoSite = websiteContent
    ? `\n\nCONTEÚDO REAL DO WEBSITE DA EMPRESA:\n${websiteContent}`
    : "";
  const desc = await perguntaCurta(
    anthropic,
    PRE_ID_SYSTEM_PROMPT,
    `Empresa: "${input.companyName}"${input.website ? ` | Website: ${input.website}` : ""}${
      input.freeText ? ` | Contexto: ${input.freeText}` : ""
    }${contextoSite}`,
    300,
  );
  if (desc && desc.toLowerCase() !== input.companyName.toLowerCase()) {
    descricaoEmpresa = `${input.companyName} — ${desc}`;
  }

  // 2) Quais tags da base casam com essa empresa.
  const partes = [descricaoEmpresa];
  if (input.website && !descricaoEmpresa.includes(input.website)) {
    partes.push(`(website: ${input.website})`);
  }
  if (input.freeText && !descricaoEmpresa.includes(input.freeText)) {
    partes.push(`— ${input.freeText}`);
  }
  if (input.meetingRole) partes.push(`(cargo/tema: ${input.meetingRole})`);

  const bruto = await perguntaCurta(
    anthropic,
    MATCH_SECTOR_SYSTEM_PROMPT,
    `Empresa pesquisada: "${partes.join(" ")}"\n\nSetores/tags disponíveis na base (cada um é uma tag individual): ${JSON.stringify(
      tagsDaBase,
    )}\n\nIdentifique o setor REAL desta empresa e retorne SOMENTE os setores da lista que têm afinidade genuína. Seja CÉTICO — prefira não retornar nada a retornar matches forçados.`,
    2000,
  );
  if (!bruto) return { conexoes: [], descricaoEmpresa };

  let match: { mainSector?: string; matchingSectors?: string[] };
  try {
    match = JSON.parse(semCerca(bruto));
  } catch {
    console.warn("[tpm] match-sector devolveu JSON inválido");
    return { conexoes: [], descricaoEmpresa };
  }
  const casados = (match.matchingSectors ?? []).map((s) => s.toLowerCase().trim());
  if (casados.length === 0) return { conexoes: [], descricaoEmpresa };

  // 3) Expansão por família, filtro por tag e agrupamento por cliente.
  const expandido = expandirPorFamilia(casados, tagsDaBase);
  const filtrados = filtrarCasesPorTags(cases, expandido);
  const candidatos = agruparPorCliente(filtrados);
  if (candidatos.length === 0) return { conexoes: [], descricaoEmpresa };

  // 4) Filtro de precisão: tags genéricas ("serviços", "indústria") arrastam
  //    empresas de mundos diferentes. Quando o filtro derruba quase tudo, ele
  //    próprio é o problema — aí vale mais a lista inteira.
  const aprovadosBruto = await perguntaCurta(
    anthropic,
    PRECISION_SYSTEM_PROMPT,
    `Empresa-alvo: "${descricaoEmpresa}"\nSetor identificado: "${match.mainSector ?? ""}"\n\nCandidatos:\n${candidatos
      .map((c) => `${c.caseName} (${c.sector})`)
      .join("\n")}`,
    3000,
  );
  if (!aprovadosBruto) return { conexoes: candidatos, descricaoEmpresa };

  try {
    const nomes: string[] = JSON.parse(semCerca(aprovadosBruto));
    const aprovados = new Set(nomes.map((n) => n.toLowerCase().trim()));
    const filtrado = candidatos.filter((c) => aprovados.has(c.caseName.toLowerCase().trim()));
    if (!filtroPrecisaoEhConfiavel(candidatos.length, filtrado.length)) {
      console.warn(
        `[tpm] filtro de precisão agressivo demais (${candidatos.length} → ${filtrado.length}); usando todos`,
      );
      return { conexoes: candidatos, descricaoEmpresa };
    }
    return { conexoes: filtrado, descricaoEmpresa };
  } catch {
    return { conexoes: candidatos, descricaoEmpresa };
  }
}

export interface ResultadoGeracao {
  reportData: Record<string, unknown>;
  buscasFeitas: number;
}

/**
 * Chamada principal: o briefing em si, com busca na web ligada.
 *
 * Retoma sozinha quando o laço de ferramentas do servidor pausa — sem isso o
 * relatório volta incompleto silenciosamente.
 */
export async function gerarBriefing(
  anthropic: Anthropic,
  input: TPMInput,
  conexoes: ServerConnection[],
  websiteContent: string,
  onProgresso?: (buscas: number) => void,
): Promise<ResultadoGeracao> {
  const casesContext =
    conexoes.length > 0
      ? `\n\nCLIENTES TAILOR COM AFINIDADE SETORIAL (${conexoes.length} empresas, já computados pelo motor de matching — NÃO recalcule):\n${JSON.stringify(
          conexoes.map((c) => ({ name: c.caseName, sector: c.sector, positions: c.positions })),
        )}`
      : "";

  const contextoAgenda = input.parsedAgenda
    ? `\n\nDADOS EXTRAÍDOS DA AGENDA/CONVITE DA REUNIÃO:
Participantes: ${JSON.stringify(input.parsedAgenda.participants)}
${input.parsedAgenda.companyName ? `Empresa identificada: ${input.parsedAgenda.companyName}` : ""}
${input.parsedAgenda.website ? `Website: ${input.parsedAgenda.website}` : ""}
${input.parsedAgenda.meetingSubject ? `Assunto: ${input.parsedAgenda.meetingSubject}` : ""}
${input.parsedAgenda.additionalContext ? `Contexto: ${input.parsedAgenda.additionalContext}` : ""}

Use estas informações para enriquecer o briefing. Pesquise cada participante identificado e inclua no array de executives.`
    : "";

  const contextoSite = websiteContent
    ? `\n\nCONTEÚDO REAL DO WEBSITE DA EMPRESA (FONTE PRIMÁRIA DE VERDADE):\n${websiteContent}`
    : "";

  const system = buildTpmSystemPrompt(casesContext);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildTpmUserPrompt(input, contextoAgenda, contextoSite) },
  ];

  let buscasFeitas = 0;
  let msg: Anthropic.Message | undefined;

  for (let i = 0; i <= MAX_CONTINUACOES; i++) {
    const stream = anthropic.messages.stream({
      model: MODELO(),
      max_tokens: 32000,
      system,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }],
      // SEM `format: json_schema` aqui, de propósito. O schema do briefing é
      // grande demais para a saída estruturada: a API recusa a requisição com
      // 400 "The compiled grammar is too large". Foi testado, não é teoria.
      // O formato fica a cargo do prompt, e `extrairJson` trata o que vier
      // fora do padrão. As chamadas menores (agenda, simulação, matching)
      // seguem com saída estruturada, porque os schemas delas cabem.
      output_config: {
        effort: (process.env.ANTHROPIC_EFFORT || "high") as
          "low" | "medium" | "high" | "xhigh" | "max",
      },
    });
    msg = await stream.finalMessage();

    // Erro de ferramenta de servidor não levanta exceção: volta 200 com um
    // bloco de resultado cujo `content` é um objeto de erro em vez de lista.
    for (const bloco of msg.content) {
      if (bloco.type === "web_search_tool_result") {
        if (Array.isArray(bloco.content)) {
          buscasFeitas += bloco.content.length;
        } else {
          console.warn("[tpm] busca na web falhou:", bloco.content);
        }
      }
    }
    onProgresso?.(buscasFeitas);

    if (msg.stop_reason !== "pause_turn") break;

    // Retomada: devolve a vez pausada e NÃO acrescenta mensagem de usuário —
    // o servidor reconhece o bloco de ferramenta pendente e continua sozinho.
    messages.push({ role: "assistant", content: msg.content });
  }

  if (!msg) throw new Error("A IA não respondeu.");
  if (msg.stop_reason === "refusal") {
    throw new Error("A IA recusou gerar este briefing. Revise os dados informados.");
  }
  if (msg.stop_reason === "max_tokens") {
    throw new Error("O briefing ficou longo demais para uma única resposta.");
  }
  if (msg.stop_reason === "pause_turn") {
    throw new Error(
      "A pesquisa não terminou dentro do limite de continuações. Tente de novo com menos campos.",
    );
  }

  const bruto = textoDe(msg);
  let reportData: Record<string, unknown>;
  try {
    reportData = extrairJson(bruto);
  } catch (e) {
    console.error("[tpm] JSON inválido:", e, bruto.slice(0, 500));
    throw new Error("A IA devolveu um JSON inválido. Tente novamente.");
  }

  // As conexões entram aqui, calculadas no servidor. O prompt proíbe o modelo
  // de gerá-las justamente para que nenhum cliente inexistente apareça.
  reportData.tailorConnections = conexoes.map((c) => ({
    caseId: c.caseId,
    caseName: c.caseName,
    sector: c.sector,
    positions: c.positions,
    similarity: 100,
    justification: `Posições conduzidas: ${c.positions.join(", ")}`,
  }));

  return { reportData, buscasFeitas };
}
