// Modelo e knobs de custo do TPM, num lugar só.
//
// Em 05/10/2026 o TPM gastou ~US$ 21 em duas horas no Opus 5 com 84 buscas na
// web. A decisão depois disso foi explícita: o TPM tem de custar pouco, mesmo
// que o briefing fique mais raso. Daí o Haiku 4.5 como padrão — 5x mais barato
// que o Opus 5 na entrada e na saída.
//
// O Haiku 4.5 tem duas diferenças de API que quebram com 400 se ignoradas, e é
// por isso que as rotas pedem o esforço e a ferramenta de busca daqui em vez de
// escrever direto:
//  - não aceita `output_config.effort`;
//  - não aceita a busca com filtro dinâmico (`web_search_20260209`), só a básica.
//
// Trocar `ANTHROPIC_MODEL_TPM` na Vercel volta a um modelo maior sem mexer em
// código — e volta a custar como antes.
import type Anthropic from "@anthropic-ai/sdk";

export const modeloTpm = () => process.env.ANTHROPIC_MODEL_TPM || "claude-haiku-4-5";

const ehHaiku = () => modeloTpm().startsWith("claude-haiku");

type Esforco = "low" | "medium" | "high" | "xhigh" | "max";

/** `{ effort }` para espalhar em `output_config`, ou nada no Haiku. */
export function esforcoTpm(nivel: Esforco): { effort?: Esforco } {
  return ehHaiku() ? {} : { effort: nivel };
}

/** Busca na web na versão que o modelo atual aceita. */
export function buscaNaWebTpm(maxUsos: number): Anthropic.ToolUnion {
  return ehHaiku()
    ? { type: "web_search_20250305", name: "web_search", max_uses: maxUsos }
    : { type: "web_search_20260209", name: "web_search", max_uses: maxUsos };
}
