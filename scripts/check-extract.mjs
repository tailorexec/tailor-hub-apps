// Verifica a deteccao de formato e a leitura de texto dos 4 formatos aceitos.
// Uso: node --experimental-strip-types scripts/check-extract.mjs [caminho-de-um.doc]
import fs from "node:fs";
import { Packer } from "docx";

import { detectFormat, extractResumeText } from "../src/lib/extract-resume-text.ts";
import { buildDocx } from "../src/lib/resume-docx.ts";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`  ${ok ? "PASS" : "FALHA"}  ${nome}${ok ? "" : "  -> " + detalhe}`);
  if (!ok) falhas++;
};

// --- .docx: geramos um com o proprio builder ---
const docxBlob = await Packer.toBlob(
  buildDocx(
    {
      name: "Fulano de Tal",
      location: "Curitiba – PR",
      compensation: "R$ 10.000,00 (CLT)",
      education: ["Graduação em Administração"],
      experience: [
        { company: "Empresa Exemplo", period: "Jan/2020 – Atual", role: "Gerente", location: "Curitiba, PR", bullets: ["Liderar a equipe"] },
      ],
      languages: [],
      courses: [],
      other_activities: [],
    },
    null,
  ),
);
const docxBuf = new Uint8Array(await docxBlob.arrayBuffer());

console.log("=== deteccao por magic bytes ===");
check("docx detectado como docx", detectFormat(docxBuf, "curriculo.docx") === "docx");
check("docx renomeado para .doc ainda e docx", detectFormat(docxBuf, "curriculo.doc") === "docx", detectFormat(docxBuf, "curriculo.doc"));

const txtBuf = new TextEncoder().encode("MARIA SILVA\nSao Paulo - SP\nGerente Comercial");
check("txt detectado", detectFormat(txtBuf, "cv.txt", "text/plain") === "txt");
check("txt sem extensao cai em pdf (fallback)", detectFormat(txtBuf, "cv") === "pdf");

const pdfPath = "C:/Users/FlavioJr/Downloads/Mateus Curtts_CV_Tailor.pdf";
if (fs.existsSync(pdfPath)) {
  const pdfBuf = new Uint8Array(fs.readFileSync(pdfPath));
  check("pdf detectado", detectFormat(pdfBuf, "qualquer-nome.doc") === "pdf", detectFormat(pdfBuf, "qualquer-nome.doc"));
}

console.log("=== leitura de texto ===");
const rDocx = await extractResumeText(docxBuf, "curriculo.docx");
check("docx: texto lido", rDocx.text.includes("FULANO DE TAL") && rDocx.text.includes("Liderar a equipe"), rDocx.text.slice(0, 80));

const rTxt = await extractResumeText(txtBuf, "cv.txt", "text/plain");
check("txt: texto lido", rTxt.text.includes("MARIA SILVA"));

if (fs.existsSync(pdfPath)) {
  const r = await extractResumeText(new Uint8Array(fs.readFileSync(pdfPath)), "cv.pdf");
  check("pdf: texto lido", r.format === "pdf" && r.text.length > 500, `${r.format}, ${r.text.length} chars`);
}

// --- .doc legado: so roda se um caminho for informado ---
const docPath = process.argv[2];
if (docPath && fs.existsSync(docPath)) {
  const docBuf = new Uint8Array(fs.readFileSync(docPath));
  check("doc: assinatura OLE2 reconhecida", detectFormat(docBuf, "cv.doc") === "doc", detectFormat(docBuf, "cv.doc"));
  const r = await extractResumeText(docBuf, "cv.doc", "application/msword");
  check("doc: texto lido", r.format === "doc" && r.text.length > 200, `${r.format}, ${r.text.length} chars`);
  check("doc: acentuacao preservada", /[áéíóúãõçÁÉÍÓÚÂÊÔ]/.test(r.text));
  console.log(`  (lidos ${r.text.length} caracteres do .doc)`);
} else {
  console.log("  AVISO: nenhum .doc informado — passe o caminho como argumento para testar o formato legado");
}

console.log(falhas === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${falhas} CHECK(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
