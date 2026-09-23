// Motor de conexões Tailor: dado o setor da empresa-alvo, quais clientes da
// carteira têm afinidade real.
//
// Portado de supabase/functions/generate-tpm. Aqui virou função pura, separada
// da rota, porque é a parte do TPM com regra de negócio de verdade — e a única
// que dá para conferir sem gastar uma chamada de IA.

export interface CaseRow {
  id: string;
  client_name: string;
  sector: string;
  function_searched: string;
  tags: string[] | null;
  confidential: boolean;
}

export interface ServerConnection {
  caseId: string;
  caseName: string;
  sector: string;
  positions: string[];
  confidential: boolean;
}

/**
 * Setores que devem se reconhecer entre si.
 *
 * Sem isto, um case marcado "logtech" não casa com uma empresa classificada como
 * "tecnologia", embora um executivo dos dois lados diria que é o mesmo mundo.
 */
const SECTOR_FAMILIES: Set<string>[] = [
  new Set([
    "tech",
    "tecnologia",
    "technology",
    "saas",
    "software",
    "fintech",
    "hrtech",
    "healthtech",
    "edtech",
    "logtech",
    "agtech",
    "insurtech",
    "proptech",
    "martech",
    "adtech",
    "regtech",
    "legaltech",
    "foodtech",
    "cleantech",
    "biotech",
    "deeptech",
    "govtech",
    "ti",
    "plataforma digital",
    "plataforma",
  ]),
  new Set([
    "entretenimento",
    "entertainment",
    "esporte",
    "esportes",
    "sports",
    "sport",
    "eventos",
    "events",
    "evento",
    "gaming",
    "apostas",
    "bet",
    "bets",
    "betting",
    "igaming",
    "jogos",
    "casino",
    "loteria",
    "mídia",
    "media",
    "música",
    "music",
    "show",
    "shows",
    "festival",
    "cultura",
    "lazer",
    "leisure",
  ]),
  new Set([
    "financeiro",
    "finanças",
    "finance",
    "banking",
    "banco",
    "bancos",
    "seguros",
    "insurance",
    "crédito",
    "credit",
    "investimentos",
    "investments",
    "asset management",
    "gestão de ativos",
    "mercado financeiro",
    "capital",
    "previdência",
    "pagamentos",
    "payments",
  ]),
  new Set([
    "varejo",
    "retail",
    "bens de consumo",
    "consumo",
    "consumer",
    "cpg",
    "fmcg",
    "moda",
    "fashion",
    "luxo",
    "luxury",
    "e-commerce",
    "ecommerce",
    "marketplace",
  ]),
  new Set([
    "alimentos",
    "bebidas",
    "alimentos e bebidas",
    "food",
    "beverage",
    "food & beverage",
    "foodservice",
    "restaurante",
    "gastronomia",
  ]),
];

/** "logtech", "agtech" e afins entram na família tech mesmo sem estar listados. */
function ehTech(tag: string) {
  return tag.endsWith("tech") || tag.includes("tecnologi");
}

function familiasDe(tag: string): Set<string>[] {
  const t = tag.toLowerCase().trim();
  return SECTOR_FAMILIES.filter((f) => f.has(t) || (f.has("tech") && ehTech(t)));
}

/** Todas as tags individuais presentes na base — `sector` vem com "A / B / C". */
export function extrairTagsUnicas(cases: CaseRow[]): string[] {
  const todas = new Set<string>();
  for (const c of cases) {
    c.sector.split(/\s*\/\s*/).forEach((s) => {
      const tag = s.trim();
      if (tag) todas.add(tag);
    });
    (c.tags ?? []).forEach((t) => {
      const tag = t.trim();
      if (tag) todas.add(tag);
    });
  }
  return Array.from(todas);
}

/** Acrescenta aos setores casados os parentes de família presentes na base. */
export function expandirPorFamilia(matchingSectors: string[], tagsDaBase: string[]): string[] {
  const casados = matchingSectors.map((s) => s.toLowerCase().trim());
  const familiasAtivas = new Set<Set<string>>();
  for (const ms of casados) {
    for (const f of familiasDe(ms)) familiasAtivas.add(f);
  }
  if (familiasAtivas.size === 0) return casados;

  const expandido = [...casados];
  for (const tag of tagsDaBase) {
    const lower = tag.toLowerCase().trim();
    if (expandido.includes(lower)) continue;
    for (const f of familiasAtivas) {
      if (f.has(lower) || (f.has("tech") && ehTech(lower))) {
        expandido.push(lower);
        break;
      }
    }
  }
  return expandido;
}

/** Cases cuja interseção de tags com os setores casados não é vazia. */
export function filtrarCasesPorTags(cases: CaseRow[], setores: string[]): CaseRow[] {
  return cases.filter((c) => {
    const doSetor = c.sector
      .split(/\s*\/\s*/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const extras = (c.tags ?? []).map((t) => t.toLowerCase().trim());
    const todas = [...doSetor, ...extras];
    return setores.some((ms) => todas.some((tag) => tag === ms));
  });
}

/**
 * Um cliente por linha, juntando as posições conduzidas.
 *
 * O nome de cliente confidencial nunca sai daqui: vira "Confidencial" antes de
 * chegar ao prompt ou ao navegador.
 */
export function agruparPorCliente(cases: CaseRow[]): ServerConnection[] {
  const porCliente = new Map<string, ServerConnection>();
  for (const c of cases) {
    const chave = c.client_name.toLowerCase().trim();
    const existente = porCliente.get(chave);
    if (!existente) {
      porCliente.set(chave, {
        caseId: c.id,
        caseName: c.confidential ? "Confidencial" : c.client_name,
        sector: c.sector,
        positions: [c.function_searched],
        confidential: c.confidential,
      });
    } else if (!existente.positions.includes(c.function_searched)) {
      existente.positions.push(c.function_searched);
    }
  }
  return Array.from(porCliente.values());
}

/**
 * Guarda-chuva do filtro de precisão da IA.
 *
 * O filtro existe para matar falso positivo de tag genérica ("serviços",
 * "indústria"), mas quando ele derruba quase tudo o resultado costuma ser pior
 * que não filtrar — some a seção de autoridade justamente nas empresas em que
 * a Tailor tem carteira. Abaixo de 30% de sobreviventes, descarta-se o filtro.
 */
export function filtroPrecisaoEhConfiavel(antes: number, depois: number): boolean {
  if (depois === 0) return false;
  if (antes < 5) return true;
  const taxaRemocao = 1 - depois / antes;
  return taxaRemocao <= 0.7;
}
