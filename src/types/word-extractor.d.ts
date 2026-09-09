// A biblioteca não publica tipos. Declaramos apenas a superfície usada em
// /api/generate-resume para ler currículos no formato Word 97-2003 (.doc).
declare module "word-extractor" {
  interface WordDocument {
    getBody(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getFooters(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getAnnotations(): string;
    getTextboxes(options?: { mainDocument?: boolean; headersAndFooters?: boolean }): string;
  }

  class WordExtractor {
    extract(source: string | Buffer | Uint8Array): Promise<WordDocument>;
  }

  export default WordExtractor;
}
