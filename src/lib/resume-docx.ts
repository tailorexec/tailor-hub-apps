import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  LevelFormat,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";

/**
 * Monta o .docx no padrão Tailor.
 *
 * Extraído da rota de API para poder ser testado isoladamente contra os
 * currículos de referência (cores, seções e pontuação).
 */
export interface ResumeData {
  name: string;
  location?: string;
  compensation?: string;
  education?: string[];
  experience?: Array<{
    company: string;
    period?: string;
    role: string;
    location?: string;
    bullets?: string[];
  }>;
  languages?: string[];
  courses?: string[];
  other_activities?: string[];
}


const PRIMARY = "1F2937"; // slate-800
const MUTED = "6B7280";
const TAILOR_RED = "C00000"; // Tailor red

// Convert text with *italic* markers into TextRun[] preserving italics.
function runs(
  text: string,
  base: { bold?: boolean; size?: number; color?: string } = {},
): TextRun[] {
  const out: TextRun[] = [];
  const parts = text.split(/(\*[^*]+\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      out.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          bold: base.bold,
          size: base.size,
          color: base.color,
          font: "Montserrat",
        }),
      );
    } else {
      out.push(
        new TextRun({
          text: part,
          bold: base.bold,
          size: base.size,
          color: base.color,
          font: "Montserrat",
        }),
      );
    }
  }
  return out;
}

const TAILOR_RED_DARK = "941010"; // first 3 sections

function sectionHeading(text: string, color: string = TAILOR_RED) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 2 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 23, color, font: "Montserrat" }),
    ],
  });
}

function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: runs(text, { size: 22 }),
  });
}

// Ensure bullets end with ; except last with .
function normalizeBullets(items: string[]): string[] {
  const cleaned = items.map((b) => b.trim().replace(/[.;]+$/, "")).filter(Boolean);
  return cleaned.map((b, i) => `${b}${i === cleaned.length - 1 ? "." : ";"}`);
}

export function buildDocx(
  data: ResumeData,
  logoBytes: Uint8Array | null,
): Document {
  const children: Paragraph[] = [];

  // Name (uppercase)
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: (data.name || "Candidato").toUpperCase(),
          bold: true,
          size: 36,
          color: PRIMARY,
          font: "Montserrat",
        }),
      ],
    }),
  );

  if (data.location) {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: data.location, size: 22, color: MUTED, font: "Montserrat" })],
      }),
    );
  }

  // Pacote de Remuneração (sempre exibido)
  children.push(sectionHeading("Pacote de Remuneração (atual)", TAILOR_RED_DARK));
  const compensationTemplate =
    "R$ XX.000,00 (CLT ou PJ) + PLR até XX salários (última: XX salários) + Previdência Privada de X:X até X% + Vale Refeição de R$ XX + Vale Alimentação de R$ XX + Assistência Médica XXX + Assistência Odontológica XXX + Veículo XXX.";
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      // O bloco de remuneração é cinza no padrão Tailor, não preto como o corpo.
      children: data.compensation
        ? runs(data.compensation, { size: 22, color: MUTED })
        : [new TextRun({ text: compensationTemplate, size: 22, color: MUTED, font: "Montserrat" })],
    }),
  );

  // Formação Acadêmica (sempre exibida)
  children.push(sectionHeading("Formação Acadêmica", TAILOR_RED_DARK));
  if (data.education?.length) {
    for (const ed of data.education) {
      if (ed?.trim()) children.push(bullet(ed.trim()));
    }
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "sem informação", size: 22, italics: true, color: MUTED, font: "Montserrat" })],
      }),
    );
  }

  // Experiência Profissional (sempre exibida)
  children.push(sectionHeading("Experiência Profissional", TAILOR_RED_DARK));
  if (data.experience?.length) {
    let prevCompany = "";
    for (const exp of data.experience) {
      const sameCompany = (exp.company || "").trim() === prevCompany && prevCompany !== "";
      // Company + period (skip company line if same as previous entry)
      if (!sameCompany) {
        children.push(
          new Paragraph({
            spacing: { before: 160, after: 20 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 2 } },
            children: [
              new TextRun({ text: exp.company || "", bold: true, size: 23, font: "Montserrat" }),
              ...(exp.period
                ? [
                    new TextRun({
                      text: `\t${exp.period}`,
                      size: 22,
                      color: MUTED,
                      font: "Montserrat",
                    }),
                  ]
                : []),
            ],
          }),
        );
      }
      if (exp.role) {
        children.push(
          new Paragraph({
            spacing: { before: sameCompany ? 120 : 0, after: 20 },
            children: runs(exp.role, { bold: true, size: 22 }),
          }),
        );
      }
      if (exp.location) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: exp.location, italics: true, size: 20, color: MUTED, font: "Montserrat" }),
            ],
          }),
        );
      }
      const bullets = normalizeBullets(exp.bullets ?? []);
      for (const b of bullets) children.push(bullet(b));
      prevCompany = (exp.company || "").trim();
    }
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "sem informação", size: 22, italics: true, color: MUTED, font: "Montserrat" })],
      }),
    );
  }

  // Idiomas (exibido apenas se houver — o padrão Tailor omite a seção vazia
  // em vez de imprimir "sem informação")
  const languages = (data.languages ?? []).map((l) => l?.trim()).filter(Boolean) as string[];
  if (languages.length) {
    children.push(sectionHeading("Idiomas"));
    for (const l of languages) children.push(bullet(l));
  }

  // Cursos (exibido apenas se houver)
  const courses = (data.courses ?? []).map((c) => c?.trim()).filter(Boolean) as string[];
  if (courses.length) {
    children.push(sectionHeading("Cursos"));
    for (const c of normalizeBullets(courses)) children.push(bullet(c));
  }

  // Outras Atividades Relevantes (exibido apenas se houver)
  if (data.other_activities?.length) {
    children.push(sectionHeading("Outras Atividades Relevantes"));
    const items = normalizeBullets(data.other_activities);
    for (const a of items) children.push(bullet(a));
  }



  return new Document({
    creator: "Tailor CV Generator",
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 270 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        headers: logoBytes
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new ImageRun({
                        data: logoBytes,
                        transformation: { width: 140, height: 26 },
                        type: "png",
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });
}
