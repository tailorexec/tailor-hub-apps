import { extractText, getDocumentProxy } from "unpdf";

export type ResumeFormat = "doc" | "docx" | "pdf" | "txt";

/**
 * Decide o formato pelos magic bytes, não pela extensão.
 *
 * Na prática é comum receber um .docx renomeado para .doc (e vice-versa) — o
 * Word abre os dois sem reclamar, então o usuário nunca percebe. Confiar na
 * extensão faria a leitura falhar num arquivo perfeitamente válido.
 * A extensão e o MIME só desempatam quando não há assinatura conhecida.
 */
export function detectFormat(buf: Uint8Array, fileName = "", mimeType = ""): ResumeFormat {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);

  if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "doc"; // OLE2
  if (starts(0x50, 0x4b, 0x03, 0x04)) return "docx"; // zip
  if (starts(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF

  const name = fileName.toLowerCase();
  if (name.endsWith(".txt") || mimeType === "text/plain") return "txt";
  if (name.endsWith(".doc") || mimeType === "application/msword") return "doc";
  if (
    name.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "pdf";
}

const tidy = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Word 97-2003: binário OLE2, sem nenhuma relação com o .docx. */
async function fromDoc(buf: Uint8Array): Promise<string> {
  const { default: WordExtractor } = await import("word-extractor");
  const doc = await new WordExtractor().extract(Buffer.from(buf));
  return tidy([doc.getBody(), doc.getHeaders(), doc.getFooters()].filter(Boolean).join("\n"));
}

/** .docx é um zip de XML; lemos corpo, cabeçalhos e rodapés. */
async function fromDocx(buf: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(buf);
  const parts = Object.keys(files).filter(
    (n) => n === "word/document.xml" || /^word\/(header|footer)\d*\.xml$/.test(n),
  );
  const xml = parts.map((n) => strFromU8(files[n])).join("\n");
  return tidy(
    xml
      .replace(/<w:p[ >]/g, "\n<w:p ")
      .replace(/<w:tab\b[^>]*\/?>/g, "\t")
      .replace(/<w:br\b[^>]*\/?>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );
}

async function fromPdf(buf: Uint8Array): Promise<string> {
  const doc = await getDocumentProxy(buf);
  const { text } = await extractText(doc, { mergePages: true });
  return tidy(Array.isArray(text) ? text.join("\n") : text);
}

/** Texto bruto de um currículo em PDF, DOC, DOCX ou TXT. */
export async function extractResumeText(
  buf: Uint8Array,
  fileName = "",
  mimeType = "",
): Promise<{ text: string; format: ResumeFormat }> {
  const format = detectFormat(buf, fileName, mimeType);
  const text =
    format === "doc"
      ? await fromDoc(buf)
      : format === "docx"
        ? await fromDocx(buf)
        : format === "txt"
          ? tidy(new TextDecoder().decode(buf))
          : await fromPdf(buf);
  return { text, format };
}
