// Verifica o .docx gerado contra o padrão Tailor observado nos currículos de
// referência. Roda com: node scripts/check-resume-docx.mjs
import { Packer } from "docx";
import { unzipSync, strFromU8 } from "fflate";

import { buildDocx } from "../src/lib/resume-docx.ts";

const COMPLETO = {
  name: "Mateus Fortini Curtts",
  location: "Belo Horizonte – MG",
  compensation: "R$ 20.000,00 (CLT) + PLR até 5 salários + *Gympass* + Estacionamento",
  education: ["MBA em Gestão de TI e Governança", "Graduação em Gestão da Tecnologia da Informação"],
  experience: [
    {
      company: "Grupo AVG",
      period: "Out/2012 – Atual",
      role: "Gerente de TI (Mai/2024 – Atual)",
      location: "Nova Lima, MG",
      bullets: ["Gerenciar a estratégia de TI", "Atuar na gestão de equipes"],
    },
    {
      company: "Grupo AVG",
      period: "Out/2012 – Atual",
      role: "Analista de TI (Out/2012 – Fev/2013)",
      location: "Nova Lima, MG",
      bullets: [],
    },
  ],
  languages: ["Inglês Profissional"],
  courses: ["Itil v4 Foundation"],
  other_activities: [],
};

const SEM_IDIOMAS_NEM_CURSOS = { ...COMPLETO, languages: [], courses: [] };

async function xmlOf(data) {
  const blob = await Packer.toBlob(buildDocx(data, null));
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return strFromU8(files["word/document.xml"]);
}

const texto = (xml) => (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("|");

let falhas = 0;
function check(nome, ok, detalhe = "") {
  console.log(`  ${ok ? "PASS" : "FALHA"}  ${nome}${ok ? "" : "  -> " + detalhe}`);
  if (!ok) falhas++;
}

const xml = await xmlOf(COMPLETO);
const t = texto(xml);

console.log("=== currículo completo ===");
check('cabeçalho "PACOTE DE REMUNERAÇÃO (ATUAL)"', t.includes("PACOTE DE REMUNERAÇÃO (ATUAL)"), t.slice(0, 120));
check("sem o antigo (ATUAL OU ÚLTIMA)", !t.includes("ATUAL OU ÚLTIMA"));
check("seção IDIOMAS presente", t.includes("IDIOMAS"));
check("seção CURSOS presente", t.includes("CURSOS"));
check('nunca imprime "sem informação"', !t.includes("sem informação"));
check("curso recebe ponto final", t.includes("Itil v4 Foundation."));
check("bullet não-final com ponto e vírgula", t.includes("Gerenciar a estratégia de TI;"));
check("último bullet com ponto", t.includes("Atuar na gestão de equipes."));

// cor da remuneração: o run com o texto tem que estar em 6B7280
const paras = xml.split("<w:p ").concat(xml.split("<w:p>"));
const paraRemun = paras.find((p) => p.includes("R$ 20.000,00"));
check(
  "remuneração em cinza 6B7280",
  !!paraRemun && /w:color w:val="6B7280"/.test(paraRemun),
  paraRemun ? (paraRemun.match(/w:color w:val="[0-9A-F]+"/g) || []).join(",") : "parágrafo não encontrado",
);
const paraNome = paras.find((p) => p.includes("MATEUS"));
check("nome em 1F2937", !!paraNome && /w:color w:val="1F2937"/.test(paraNome));

console.log("=== sem idiomas nem cursos ===");
const t2 = texto(await xmlOf(SEM_IDIOMAS_NEM_CURSOS));
check("seção IDIOMAS omitida", !t2.includes("IDIOMAS"));
check("seção CURSOS omitida", !t2.includes("CURSOS"));
check('não imprime "sem informação"', !t2.includes("sem informação"));
check("PACOTE e FORMAÇÃO continuam", t2.includes("PACOTE DE REMUNERAÇÃO") && t2.includes("FORMAÇÃO ACADÊMICA"));

console.log(falhas === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${falhas} CHECK(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
