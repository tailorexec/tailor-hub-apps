import { createFileRoute } from "@tanstack/react-router";
import { extractText, getDocumentProxy } from "unpdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  
  AlignmentType,
  LevelFormat,
  BorderStyle,
  Header,
  ImageRun,
} from "docx";
import logoUrl from "@/assets/tailor-logo.png";


interface ResumeData {
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
}

const SYSTEM_PROMPT = `Você é um especialista em recrutamento da consultoria "Tailor" e estrutura currículos no padrão Tailor.
Receba o texto bruto extraído de um PDF de currículo e devolva APENAS um JSON válido (sem markdown, sem comentários) seguindo este schema:

{
  "name": string,                       // nome completo do candidato (será exibido em CAIXA ALTA)
  "location": string,                   // cidade – UF (ex: "Manaus – AM")
  "compensation": string,               // pacote de remuneração ATUAL em um único parágrafo. Ex: "R$ 15.000,00 (CLT) + PLR até 3 salários (última: 3 salários) + Vale Alimentação de R$ 1.100,00 + Assistência Médica + Assistência Odontológica + Wellhub". Se não houver, devolva "".
  "education": string[],                // cada item é uma linha de formação acadêmica (ex: "Pós-Graduação em ...", "MBA em ...", "Graduação em ...")
  "experience": [{
    "company": string,                  // nome da empresa
    "period": string,                   // período total na empresa (ex: "Set/2013 – Out/2024" ou "Out/2024 – Atual")
    "role": string,                     // cargo. Se houver vários cargos na mesma empresa, crie UMA entrada por cargo, repetindo a empresa, e inclua o período do cargo entre parênteses no campo "role" (ex: "Coordenadora Business Partner RH (Jun/2023 – Out/2024)")
    "location": string,                 // cidade, UF (ex: "Manaus, AM")
    "bullets": string[]                 // responsabilidades/realizações
  }],
  "languages": string[],                // ex: ["Inglês Intermediário – Informado pela candidata"]
  "courses": string[]                   // cursos e certificações
}

Regras de formatação OBRIGATÓRIAS (padrão Tailor) — siga TODAS sem exceção:

1) IDIOMA: Escreva tudo em português do Brasil.

2) VERBOS NO INFINITIVO (REGRA CRÍTICA): TODO bullet do array "bullets" em "experience" DEVE começar OBRIGATORIAMENTE com um verbo no infinitivo (terminado em -ar, -er, -ir). Exemplos válidos: "Coordenar...", "Implantar...", "Desenvolver...", "Gerir...", "Liderar...", "Conduzir...", "Estruturar...", "Acompanhar...", "Garantir...", "Elaborar...", "Reportar...", "Atuar...". NUNCA use formas como "Coordenei", "Coordenando", "Responsável por", "Atuação em", "Gestão de" no início. Se o currículo original usa outra forma, REESCREVA para infinitivo.

3) PONTUAÇÃO DOS BULLETS (REGRA CRÍTICA): Em CADA cargo de "experience.bullets", todos os itens DEVEM terminar com ponto e vírgula ";", EXCETO o ÚLTIMO item do array, que DEVE terminar com ponto ".". A mesma regra se aplica ao array "courses". Não use outros sinais de pontuação no final.

4) ITÁLICO PARA TERMOS EM INGLÊS (REGRA CRÍTICA): TODA palavra ou expressão em inglês/estrangeirismo no texto DEVE ser envolvida por asteriscos para itálico. Exemplos: *Business Partner*, *performance*, *feedback*, *turnover*, *endomarketing*, *compliance*, *LMS*, *headcount*, *onboarding*, *coaching*, *mindset*, *benchmarking*, *stakeholders*, *budget*, *forecast*, *KPI*, *core business*, *people analytics*, *soft skills*, *hard skills*, *home office*. Aplique em QUALQUER campo de texto (role, bullets, compensation, courses, etc.). NÃO marque siglas em português nem nomes próprios de empresas.

5) NÃO invente informações. Se um campo não existir no PDF, devolva string vazia "" ou array vazio [].

6) Devolva APENAS o JSON, sem markdown, sem comentários, sem texto fora do JSON.`;

export const Route = createFileRoute("/api/generate-resume")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // --- Auth check: require approved user ---
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!token) {
            return Response.json({ error: "Não autenticado." }, { status: 401 });
          }

          const supabaseUrl = process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!supabaseUrl || !serviceKey) {
            return Response.json({ error: "Backend não configurado." }, { status: 500 });
          }

          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
          });
          if (!userRes.ok) {
            return Response.json({ error: "Sessão inválida." }, { status: 401 });
          }
          const userJson = (await userRes.json()) as { id?: string };
          const userId = userJson.id;
          if (!userId) {
            return Response.json({ error: "Sessão inválida." }, { status: 401 });
          }

          const profRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=status`,
            {
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Accept: "application/json",
              },
            },
          );
          const profArr = (await profRes.json()) as Array<{ status: string }>;
          if (!Array.isArray(profArr) || profArr[0]?.status !== "approved") {
            return Response.json(
              { error: "Cadastro ainda não aprovado por um administrador." },
              { status: 403 },
            );
          }
          // --- end auth check ---

          // --- Daily limit check (15 per user, UTC day) ---
          const DAILY_LIMIT = 15;
          const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const countRes = await fetch(
            `${supabaseUrl}/rest/v1/generations?user_id=eq.${userId}&created_at=gte.${sinceIso}&select=id`,
            {
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Accept: "application/json",
                Prefer: "count=exact",
              },
            },
          );
          const contentRange = countRes.headers.get("content-range") ?? "0-0/0";
          const usedToday = parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;
          if (usedToday >= DAILY_LIMIT) {
            return Response.json(
              {
                error: `Você atingiu o limite diário de ${DAILY_LIMIT} gerações. Contate o administrador.`,
                used: usedToday,
                limit: DAILY_LIMIT,
              },
              { status: 429, headers: { "X-Usage-Used": String(usedToday), "X-Usage-Limit": String(DAILY_LIMIT) } },
            );
          }
          // --- end limit check ---

          const formData = await request.formData();
          const pdf = formData.get("pdf");

          if (!(pdf instanceof File)) {
            return Response.json({ error: "Envie um arquivo PDF no campo 'pdf'." }, { status: 400 });
          }

          // 1) Extract text from PDF
          const buf = new Uint8Array(await pdf.arrayBuffer());
          const doc = await getDocumentProxy(buf);
          const { text } = await extractText(doc, { mergePages: true });
          const pdfText = (Array.isArray(text) ? text.join("\n") : text).trim();

          if (!pdfText) {
            return Response.json({ error: "Não foi possível extrair texto do PDF." }, { status: 422 });
          }

          // 2) Ask Lovable AI to structure it
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "LOVABLE_API_KEY não configurada." }, { status: 500 });
          }

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: pdfText.slice(0, 60000) },
              ],
              response_format: { type: "json_object" },
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error("AI error:", aiRes.status, errText);
            if (aiRes.status === 429) {
              return Response.json({ error: "Limite de uso atingido. Tente novamente em instantes." }, { status: 429 });
            }
            if (aiRes.status === 402) {
              return Response.json({ error: "Créditos de IA esgotados. Adicione créditos no Lovable." }, { status: 402 });
            }
            return Response.json({ error: "Falha ao processar com IA." }, { status: 502 });
          }

          const aiJson = await aiRes.json();
          const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
          let parsed: ResumeData;
          try {
            parsed = JSON.parse(raw);
          } catch {
            const match = raw.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : ({ name: "Candidato" } as ResumeData);
          }

          // 3) Build the .docx
          // Fetch logo bytes (best-effort) for docx header
          let logoBytes: Uint8Array | null = null;
          try {
            const origin = new URL(request.url).origin;
            const lr = await fetch(new URL(logoUrl, origin).toString());
            if (lr.ok) logoBytes = new Uint8Array(await lr.arrayBuffer());
          } catch (e) {
            console.error("logo fetch failed:", e);
          }
          const docx = buildDocx(parsed, logoBytes);
          const blob = await Packer.toBlob(docx);
          const arrayBuffer = await blob.arrayBuffer();

          const baseName = (parsed.name || "Candidato").trim().replace(/\s+/g, "_");
          const filename = `${baseName}_CV_Tailor.docx`;

          // Record usage (best-effort)
          let newUsed = usedToday + 1;
          try {
            await fetch(`${supabaseUrl}/rest/v1/generations`, {
              method: "POST",
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ user_id: userId }),
            });
          } catch (e) {
            console.error("Failed to record generation:", e);
            newUsed = usedToday;
          }

          return new Response(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
              "X-Resume-Filename": filename,
              "X-Usage-Used": String(newUsed),
              "X-Usage-Limit": String(DAILY_LIMIT),
            },
          });
        } catch (e) {
          console.error("generate-resume error:", e);
          const msg = e instanceof Error ? e.message : "Erro interno";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});

// ---------- DOCX builder ----------

const PRIMARY = "1F2937"; // slate-800
const MUTED = "6B7280";
const TAILOR_RED = "E63946"; // light Tailor red

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
          font: "Calibri",
        }),
      );
    } else {
      out.push(
        new TextRun({
          text: part,
          bold: base.bold,
          size: base.size,
          color: base.color,
          font: "Calibri",
        }),
      );
    }
  }
  return out;
}

function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TAILOR_RED, space: 2 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: TAILOR_RED, font: "Calibri" }),
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

function buildDocx(
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
          font: "Calibri",
        }),
      ],
    }),
  );

  if (data.location) {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: data.location, size: 22, color: MUTED, font: "Calibri" })],
      }),
    );
  }

  // Pacote de Remuneração (sempre exibido)
  children.push(sectionHeading("Pacote de Remuneração (Atual)"));
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: data.compensation
        ? runs(data.compensation, { size: 22 })
        : [new TextRun({ text: "Não informado", size: 22, italics: true, color: MUTED, font: "Calibri" })],
    }),
  );

  // Formação Acadêmica (sempre exibida)
  children.push(sectionHeading("Formação Acadêmica"));
  if (data.education?.length) {
    for (const ed of data.education) {
      if (ed?.trim()) children.push(bullet(ed.trim()));
    }
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Não informado", size: 22, italics: true, color: MUTED, font: "Calibri" })],
      }),
    );
  }

  // Experiência Profissional (sempre exibida)
  children.push(sectionHeading("Experiência Profissional"));
  if (data.experience?.length) {
    for (const exp of data.experience) {
      // Company + period
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 20 },
          children: [
            new TextRun({ text: exp.company || "", bold: true, size: 24, font: "Calibri" }),
            ...(exp.period
              ? [
                  new TextRun({
                    text: `   ${exp.period}`,
                    size: 22,
                    color: MUTED,
                    font: "Calibri",
                  }),
                ]
              : []),
          ],
        }),
      );
      if (exp.role) {
        children.push(
          new Paragraph({
            spacing: { after: 20 },
            children: runs(exp.role, { bold: true, size: 22 }),
          }),
        );
      }
      if (exp.location) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: exp.location, italics: true, size: 20, color: MUTED, font: "Calibri" }),
            ],
          }),
        );
      }
      const bullets = normalizeBullets(exp.bullets ?? []);
      for (const b of bullets) children.push(bullet(b));
    }
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Não informado", size: 22, italics: true, color: MUTED, font: "Calibri" })],
      }),
    );
  }

  // Idiomas (sempre exibido)
  children.push(sectionHeading("Idiomas"));
  if (data.languages?.length) {
    for (const l of data.languages) {
      if (l?.trim()) children.push(bullet(l.trim()));
    }
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Não informado", size: 22, italics: true, color: MUTED, font: "Calibri" })],
      }),
    );
  }

  // Cursos (sempre exibido)
  children.push(sectionHeading("Cursos"));
  if (data.courses?.length) {
    const courseItems = normalizeBullets(data.courses);
    for (const c of courseItems) children.push(bullet(c));
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Não informado", size: 22, italics: true, color: MUTED, font: "Calibri" })],
      }),
    );
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
