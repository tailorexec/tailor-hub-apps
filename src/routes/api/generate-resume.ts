import { createFileRoute } from "@tanstack/react-router";
import { extractText, getDocumentProxy } from "unpdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  BorderStyle,
} from "docx";

interface ResumeData {
  name: string;
  title?: string;
  contact?: { email?: string; phone?: string; location?: string; links?: string[] };
  summary?: string;
  experience?: Array<{
    role: string;
    company: string;
    period?: string;
    location?: string;
    bullets?: string[];
  }>;
  education?: Array<{ degree: string; institution: string; period?: string }>;
  skills?: string[];
  languages?: string[];
  certifications?: string[];
}

const SYSTEM_PROMPT = `Você é um especialista em recrutamento que estrutura currículos no padrão "Tailor".
Receba o texto bruto extraído de um PDF de currículo e devolva APENAS um JSON válido (sem markdown, sem comentários) seguindo este schema:

{
  "name": string,
  "title": string,
  "contact": { "email": string, "phone": string, "location": string, "links": string[] },
  "summary": string,
  "experience": [{ "role": string, "company": string, "period": string, "location": string, "bullets": string[] }],
  "education": [{ "degree": string, "institution": string, "period": string }],
  "skills": string[],
  "languages": string[],
  "certifications": string[]
}

Regras:
- Escreva tudo em português do Brasil quando possível.
- Reescreva bullets de experiência de forma concisa e orientada a resultados (verbo no passado + impacto).
- Não invente informações. Se um campo não existir, devolva string vazia ou array vazio.
- Não inclua nenhum texto fora do JSON.`;

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
              model: "google/gemini-2.5-flash-lite",
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
          const docx = buildDocx(parsed);
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

function p(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color, font: "Calibri" })],
    spacing: { after: 80 },
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 2 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: PRIMARY, font: "Calibri" }),
    ],
  });
}

function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
  });
}

function buildDocx(data: ResumeData): Document {
  const children: Paragraph[] = [];

  // Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: data.name || "Candidato",
          bold: true,
          size: 40,
          color: PRIMARY,
          font: "Calibri",
        }),
      ],
    }),
  );

  if (data.title) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: data.title, size: 24, color: MUTED, font: "Calibri" })],
      }),
    );
  }

  const contactBits: string[] = [];
  if (data.contact?.email) contactBits.push(data.contact.email);
  if (data.contact?.phone) contactBits.push(data.contact.phone);
  if (data.contact?.location) contactBits.push(data.contact.location);
  if (data.contact?.links?.length) contactBits.push(...data.contact.links);
  if (contactBits.length) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: contactBits.join("  •  "), size: 20, color: MUTED, font: "Calibri" }),
        ],
      }),
    );
  }

  if (data.summary) {
    children.push(sectionHeading("Resumo"));
    children.push(p(data.summary, { size: 22 }));
  }

  if (data.experience?.length) {
    children.push(sectionHeading("Experiência"));
    for (const exp of data.experience) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 20 },
          children: [
            new TextRun({ text: exp.role || "", bold: true, size: 24, font: "Calibri" }),
            new TextRun({
              text: exp.company ? `  —  ${exp.company}` : "",
              size: 24,
              color: MUTED,
              font: "Calibri",
            }),
          ],
        }),
      );
      const meta = [exp.period, exp.location].filter(Boolean).join(" • ");
      if (meta) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: meta, italics: true, size: 20, color: MUTED, font: "Calibri" })],
          }),
        );
      }
      for (const b of exp.bullets ?? []) {
        if (b?.trim()) children.push(bullet(b.trim()));
      }
    }
  }

  if (data.education?.length) {
    children.push(sectionHeading("Formação"));
    for (const ed of data.education) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: ed.degree || "", bold: true, size: 22, font: "Calibri" }),
            new TextRun({
              text: ed.institution ? `  —  ${ed.institution}` : "",
              size: 22,
              color: MUTED,
              font: "Calibri",
            }),
          ],
        }),
      );
      if (ed.period) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: ed.period, italics: true, size: 20, color: MUTED, font: "Calibri" })],
          }),
        );
      }
    }
  }

  if (data.skills?.length) {
    children.push(sectionHeading("Habilidades"));
    children.push(p(data.skills.join(" • "), { size: 22 }));
  }

  if (data.languages?.length) {
    children.push(sectionHeading("Idiomas"));
    children.push(p(data.languages.join(" • "), { size: 22 }));
  }

  if (data.certifications?.length) {
    children.push(sectionHeading("Certificações"));
    for (const c of data.certifications) children.push(bullet(c));
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
        children,
      },
    ],
  });
}
