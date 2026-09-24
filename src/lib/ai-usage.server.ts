// Registro de consumo da API da Anthropic.
//
// Existe porque não havia medição nenhuma: a única fonte de número era a fatura
// no fim do mês, que não diz qual rota gastou o quê. Sem isso, qualquer
// tentativa de baratear vira chute — e não dá para saber se uma mudança
// economizou ou só piorou o resultado.
//
// A linha vai para os logs da Vercel com prefixo fixo `[uso]`, para dar
// `vercel logs | grep "\[uso\]"` e somar.
//
// NÃO grava preço em código de propósito: tabela de preço desatualizada mente
// pior do que número nenhum. Aqui ficam só as contagens que a API devolveu; o
// valor em dólar sai do relatório oficial de custo ou da página de preços.
import type Anthropic from "@anthropic-ai/sdk";

interface UsoExtra {
  /** Buscas na web feitas no turno — são cobradas por busca, fora dos tokens. */
  buscas?: number;
}

export function registraUso(
  rota: string,
  msg: Pick<Anthropic.Message, "model" | "usage">,
  extra: UsoExtra = {},
) {
  const u = msg.usage;
  const campos = [
    `rota=${rota}`,
    `modelo=${msg.model}`,
    `entrada=${u.input_tokens}`,
    `saida=${u.output_tokens}`,
    // Ficam sempre visíveis, mesmo zerados: cache_leitura=0 repetido é o
    // sintoma de cache quebrado, e só se enxerga isso se o campo aparecer.
    `cache_escrita=${u.cache_creation_input_tokens ?? 0}`,
    `cache_leitura=${u.cache_read_input_tokens ?? 0}`,
  ];
  if (extra.buscas != null) campos.push(`buscas=${extra.buscas}`);
  console.log(`[uso] ${campos.join(" ")}`);
}
