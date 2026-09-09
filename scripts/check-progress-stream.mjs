// Verifica o parsing do stream de progresso do lado do cliente, incluindo o
// caso em que um evento chega partido entre dois chunks da rede.
// Uso: node scripts/check-progress-stream.mjs

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`  ${ok ? "PASS" : "FALHA"}  ${nome}${ok ? "" : "  -> " + detalhe}`);
  if (!ok) falhas++;
};

// Mesma logica de leitura usada em _authenticated.generator.tsx
async function consumir(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final = null;
  const vistos = [];

  while (!final) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const partes = buffer.split("\n\n");
    buffer = partes.pop() ?? "";
    for (const parte of partes) {
      const linha = parte.split("\n").find((l) => l.startsWith("data:"));
      if (!linha) continue;
      const evento = JSON.parse(linha.slice(5).trim());
      if (evento.stage === "erro") throw new Error(evento.error);
      if (evento.stage === "pronto") final = evento;
      else if (typeof evento.pct === "number") vistos.push(evento.pct);
    }
  }
  return { final, vistos };
}

const enc = new TextEncoder();
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;

// docx ficticio -> base64, como o servidor faz
const bytesOriginais = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 250, 251, 252]);
let bin = "";
for (const b of bytesOriginais) bin += String.fromCharCode(b);
const b64 = Buffer.from(bin, "binary").toString("base64");

const eventos = [
  sse({ stage: "lendo", pct: 4, label: "Lendo o arquivo" }),
  sse({ stage: "ia", pct: 12, label: "Analisando o currículo" }),
  sse({ stage: "ia", pct: 47, label: "Estruturando no padrão Tailor" }),
  sse({ stage: "montando", pct: 92, label: "Montando o documento" }),
  sse({ stage: "pronto", pct: 100, filename: "João Silva_CV_Tailor.docx", used: 3, limit: 15, docx: b64 }),
];

// Chunks propositalmente cortados no meio dos eventos
const inteiro = eventos.join("");
const cortes = [7, 40, 95, 160, 230, 300];
const chunks = [];
let ini = 0;
for (const c of cortes) {
  if (c < inteiro.length) {
    chunks.push(inteiro.slice(ini, c));
    ini = c;
  }
}
chunks.push(inteiro.slice(ini));

const stream = new ReadableStream({
  start(controller) {
    for (const c of chunks) controller.enqueue(enc.encode(c));
    controller.close();
  },
});

const { final, vistos } = await consumir(stream);

console.log("=== parsing do stream ===");
check("eventos de progresso lidos", vistos.length === 4, JSON.stringify(vistos));
check("percentuais em ordem crescente", vistos.every((v, i) => i === 0 || v > vistos[i - 1]), JSON.stringify(vistos));
check("evento final capturado", !!final && final.pct === 100);
check("nome do arquivo com acento preservado", final?.filename === "João Silva_CV_Tailor.docx", final?.filename);
check("quota veio no evento final", final?.used === 3 && final?.limit === 15);

// decodificacao base64 -> bytes, como no cliente
const binario = atob(final.docx);
const bytes = new Uint8Array(binario.length);
for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
check("docx sobrevive ao base64", bytes.length === bytesOriginais.length && bytes.every((b, i) => b === bytesOriginais[i]), Array.from(bytes).join(","));

console.log("=== evento de erro ===");
const streamErro = new ReadableStream({
  start(c) {
    c.enqueue(enc.encode(sse({ stage: "lendo", pct: 4 })));
    c.enqueue(enc.encode(sse({ stage: "erro", error: "A IA está temporariamente sobrecarregada." })));
    c.close();
  },
});
let msg = "";
try {
  await consumir(streamErro);
} catch (e) {
  msg = e.message;
}
check("erro no meio do stream vira excecao", msg === "A IA está temporariamente sobrecarregada.", msg);

// curva de progresso do servidor
console.log("=== curva de progresso da etapa de IA ===");
const PISO = 12, TETO = 88, ESCALA = 2200;
const pct = (chars) => Math.min(TETO - 1, Math.floor(PISO + (TETO - PISO) * (1 - Math.exp(-chars / ESCALA))));
check("comeca no piso", pct(0) === PISO, String(pct(0)));
check("cresce com os caracteres", pct(500) < pct(2000) && pct(2000) < pct(8000));
check("nunca atinge o teto", pct(1e6) < TETO, String(pct(1e6)));
console.log(`  (0 chars: ${pct(0)}% | 1000: ${pct(1000)}% | 3000: ${pct(3000)}% | 10000: ${pct(10000)}%)`);

console.log(falhas === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${falhas} CHECK(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
