import Anthropic from "@anthropic-ai/sdk";
import { createFileRoute } from "@tanstack/react-router";
import { extractText, getDocumentProxy } from "unpdf";
import { Packer } from "docx";
import logoUrl from "@/assets/tailor-logo.png";
import { buildDocx, type ResumeData } from "@/lib/resume-docx";


// Structured-output contract: Claude is constrained to emit exactly this shape.
const RESUME_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    location: { type: "string" },
    compensation: { type: "string" },
    education: { type: "array", items: { type: "string" } },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          period: { type: "string" },
          role: { type: "string" },
          location: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["company", "period", "role", "location", "bullets"],
        additionalProperties: false,
      },
    },
    languages: { type: "array", items: { type: "string" } },
    courses: { type: "array", items: { type: "string" } },
    other_activities: { type: "array", items: { type: "string" } },
  },
  required: [
    "name",
    "location",
    "compensation",
    "education",
    "experience",
    "languages",
    "courses",
    "other_activities",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Você é um especialista em recrutamento da consultoria "Tailor" e estrutura currículos no padrão Tailor.
Receba o texto bruto extraído de um PDF de currículo e devolva APENAS um JSON válido (sem markdown, sem comentários) seguindo este schema:

{
  "name": string,                       // nome completo do candidato (será exibido em CAIXA ALTA)
  "location": string,                   // cidade – UF (ex: "Manaus – AM")
  "compensation": string,               // pacote de remuneração ATUAL em um único parágrafo. Ex: "R$ 15.000,00 (CLT) + PLR até 3 salários (última: 3 salários) + Vale Alimentação de R$ 1.100,00 + Assistência Médica + Assistência Odontológica + Wellhub". Se não houver, devolva "".
  "education": string[],                // cada item DEVE conter APENAS o grau + título do curso, SEM instituição e SEM datas. Ex: "MBA em Gestão Financeira", "Graduação em Engenharia Civil", "Pós-Graduação em Gestão de Pessoas". NUNCA inclua nome da faculdade/universidade nem ano de conclusão.
  "experience": [{
    "company": string,                  // nome da empresa
    "period": string,                   // período total na empresa (ex: "Set/2013 – Out/2024" ou "Out/2024 – Atual")
    "role": string,                     // cargo. Se houver vários cargos na mesma empresa, crie UMA entrada por cargo, repetindo a empresa, e inclua o período do cargo entre parênteses no campo "role" (ex: "Coordenadora Business Partner RH (Jun/2023 – Out/2024)")
    "location": string,                 // cidade, UF (ex: "Manaus, AM")
    "bullets": string[]                 // responsabilidades/realizações. Se o currículo NÃO descrever responsabilidades para o cargo, devolva [] (array vazio) — NUNCA omita a experiência por falta de bullets.
  }],
  "languages": string[],                // ex: ["Inglês Intermediário – Informado pela candidata"]
  "courses": string[],                  // cursos e certificações
  "other_activities": string[]          // outras atividades relevantes (atuação como secretária em arbitragens, conselhos, voluntariado, etc.). Se não houver, devolva [].
}

Regras de formatação OBRIGATÓRIAS (padrão Tailor) — siga TODAS sem exceção:

1) IDIOMA E TRADUÇÃO (REGRA CRÍTICA): O currículo final é SEMPRE em português do Brasil, qualquer que seja o idioma do original. Se o currículo recebido estiver em inglês, espanhol ou outro idioma, TRADUZA todo o conteúdo para português do Brasil — cargos, responsabilidades, formações, cursos, idiomas e o pacote de remuneração. Traduza também os períodos para o formato brasileiro ("Jan/2020 – Dez/2023", usando Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez, e "Atual" no lugar de "Present"/"Current"), e nomes de países e cidades que tenham forma consagrada em português (ex: "London, UK" vira "Londres, Reino Unido"). NÃO traduza nomes próprios de empresas, de produtos, de sistemas nem de certificações — mantenha "Microsoft", "Oracle Financials", "PMP", "Six Sigma" como estão. Nomes de instituições de ensino também ficam no original, mas lembre que a regra do campo "education" já manda omitir a instituição.

1.1) COMPLETUDE OBRIGATÓRIA (REGRA CRÍTICA): Você DEVE incluir TODAS as experiências profissionais, TODOS os cursos, TODOS os idiomas, TODAS as formações e TODAS as outras atividades relevantes presentes no currículo original, SEM EXCEÇÃO. Inclua também estágios, trainees e cargos sem descrição de responsabilidades (nesse caso, devolva bullets como []). NUNCA agrupe, resuma, omita ou pule itens. Se o original lista 5 experiências, o JSON deve ter 5 (ou mais, se houver vários cargos na mesma empresa).

2) VERBOS NO INFINITIVO (REGRA CRÍTICA): TODO bullet do array "bullets" em "experience" DEVE começar OBRIGATORIAMENTE com um verbo no infinitivo (terminado em -ar, -er, -ir). Exemplos válidos: "Coordenar...", "Implantar...", "Desenvolver...", "Gerir...", "Liderar...", "Conduzir...", "Estruturar...", "Acompanhar...", "Garantir...", "Elaborar...", "Reportar...", "Atuar...". NUNCA use formas como "Coordenei", "Coordenando", "Responsável por", "Atuação em", "Gestão de" no início. Se o currículo original usa outra forma, REESCREVA para infinitivo.

3) PONTUAÇÃO DOS BULLETS (REGRA CRÍTICA): Em CADA cargo de "experience.bullets", todos os itens DEVEM terminar com ponto e vírgula ";", EXCETO o ÚLTIMO item do array, que DEVE terminar com ponto ".". A mesma regra se aplica ao array "courses". Não use outros sinais de pontuação no final.

4) ITÁLICO PARA TERMOS EM INGLÊS (REGRA CRÍTICA): TODA palavra ou expressão em inglês/estrangeirismo no texto DEVE ser envolvida por asteriscos para itálico. Exemplos: *Business Partner*, *performance*, *feedback*, *turnover*, *endomarketing*, *compliance*, *LMS*, *headcount*, *onboarding*, *coaching*, *mindset*, *benchmarking*, *stakeholders*, *budget*, *forecast*, *KPI*, *core business*, *people analytics*, *soft skills*, *hard skills*, *home office*. Aplique em QUALQUER campo de texto (role, bullets, compensation, courses, etc.). NÃO marque siglas em português nem nomes próprios de empresas.

4.1) O ITÁLICO MARCA TERMOS, NUNCA FRASES (REGRA CRÍTICA): o itálico vale para os termos que PERMANECEM em outro idioma depois da tradução da regra 1 — jargão que o mercado brasileiro usa em inglês por convenção (*turnover*, *compliance*), além de nomes de sistemas, produtos, ferramentas e certificações (*Power BI*, *Azure Data Factory*, *ERP Senior*, *AWS Certified Cloud Practitioner*, *ITIL Foundation*). Se o currículo original estiver em inglês, o texto traduzido é português comum e NÃO leva itálico: um bullet inteiro entre asteriscos está SEMPRE errado. Na dúvida, traduza e não marque.

4.2) NUNCA use asteriscos no campo "company" — esse campo é renderizado sem interpretar itálico, então os asteriscos apareceriam literalmente no documento. O nome do empregador vai sempre sem marcação, mesmo sendo estrangeiro. (Citar a mesma empresa como fornecedor dentro de um bullet segue a regra 4.1 normalmente.)

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
            `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=hub_status`,
            {
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Accept: "application/json",
              },
            },
          );
          const profArr = (await profRes.json()) as Array<{ hub_status: string }>;
          if (!Array.isArray(profArr) || profArr[0]?.hub_status !== "approved") {
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
            return Response.json(
              { error: "Envie um arquivo PDF, DOCX ou TXT no campo 'pdf'." },
              { status: 400 },
            );
          }

          // 1) Extract text (PDF, DOCX or TXT)
          const buf = new Uint8Array(await pdf.arrayBuffer());
          const lowerName = pdf.name.toLowerCase();
          let pdfText = "";

          if (lowerName.endsWith(".txt") || pdf.type === "text/plain") {
            pdfText = new TextDecoder().decode(buf).trim();
          } else if (
            lowerName.endsWith(".docx") ||
            pdf.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ) {
            const { unzipSync, strFromU8 } = await import("fflate");
            const files = unzipSync(buf);
            const parts = Object.keys(files).filter(
              (n) => n === "word/document.xml" || /^word\/(header|footer)\d*\.xml$/.test(n),
            );
            const xml = parts.map((n) => strFromU8(files[n])).join("\n");
            pdfText = xml
              .replace(/<w:p[ >]/g, "\n<w:p ")
              .replace(/<w:tab\b[^>]*\/?>/g, "\t")
              .replace(/<w:br\b[^>]*\/?>/g, "\n")
              .replace(/<[^>]+>/g, "")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/[ \t]+\n/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
          } else {
            const doc = await getDocumentProxy(buf);
            const { text } = await extractText(doc, { mergePages: true });
            pdfText = (Array.isArray(text) ? text.join("\n") : text).trim();
          }

          if (!pdfText) {
            return Response.json(
              { error: "Não foi possível extrair texto do arquivo enviado." },
              { status: 422 },
            );
          }

          // 2) Ask Claude to structure it
          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
          }

          const anthropic = new Anthropic({ apiKey });

          let aiMessage: Anthropic.Message;
          try {
            // Streamed: a long CV plus adaptive thinking can outlast a plain request timeout.
            aiMessage = await anthropic.messages
              .stream({
                model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
                max_tokens: 32000,
                system: SYSTEM_PROMPT,
                messages: [{ role: "user", content: pdfText.slice(0, 60000) }],
                output_config: {
                  format: { type: "json_schema", schema: RESUME_JSON_SCHEMA },
                  // Extraction under fixed formatting rules — medium is the
                  // cost/quality sweet spot here. Override with ANTHROPIC_EFFORT.
                  effort: (process.env.ANTHROPIC_EFFORT || "medium") as
                    | "low"
                    | "medium"
                    | "high"
                    | "xhigh"
                    | "max",
                },
              })
              .finalMessage();
          } catch (e) {
            console.error("Anthropic error:", e);
            if (e instanceof Anthropic.RateLimitError) {
              return Response.json(
                { error: "Limite de uso da IA atingido. Tente novamente em instantes." },
                { status: 429 },
              );
            }
            if (e instanceof Anthropic.AuthenticationError) {
              return Response.json({ error: "Chave da API da Anthropic inválida." }, { status: 500 });
            }
            // 529: a API está sobrecarregada. O SDK já tentou de novo sozinho,
            // então aqui só resta pedir para o usuário repetir.
            if (
              e instanceof Anthropic.APIError &&
              (e.status === 529 || /overloaded/i.test(e.message))
            ) {
              return Response.json(
                { error: "A IA está temporariamente sobrecarregada. Tente novamente em instantes." },
                { status: 503 },
              );
            }
            if (e instanceof Anthropic.APIError && /credit|balance/i.test(e.message)) {
              return Response.json(
                { error: "Créditos da Anthropic esgotados. Recarregue o saldo da conta." },
                { status: 402 },
              );
            }
            return Response.json({ error: "Falha ao processar com IA." }, { status: 502 });
          }

          if (aiMessage.stop_reason === "refusal") {
            console.error("AI refused:", aiMessage.stop_details);
            return Response.json(
              { error: "A IA recusou processar este documento. Verifique o conteúdo do arquivo." },
              { status: 422 },
            );
          }
          if (aiMessage.stop_reason === "max_tokens") {
            return Response.json(
              { error: "O currículo é longo demais para ser processado de uma vez." },
              { status: 422 },
            );
          }

          const raw = aiMessage.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");
          let parsed: ResumeData;
          try {
            parsed = safeParseResumeJson(raw);
          } catch (e) {
            console.error("JSON parse failed:", e, "raw:", raw.slice(0, 500));
            return Response.json(
              { error: "A IA retornou um JSON inválido. Tente novamente." },
              { status: 502 },
            );
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

          const toTitleCase = (s: string) =>
            s.toLocaleLowerCase("pt-BR").replace(/(^|\s|-|')(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"));
          const nameParts = (parsed.name || "Candidato").trim().split(/\s+/).filter(Boolean).map(toTitleCase);
          const firstLast =
            nameParts.length >= 2
              ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
              : nameParts[0] || "Candidato";
          const filename = `${firstLast}_CV_Tailor.docx`;

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

// ---------- JSON parsing ----------

function safeParseResumeJson(raw: string): ResumeData {
  let s = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);

  const attempts: Array<() => string> = [
    () => s,
    () => s.replace(/,\s*([}\]])/g, "$1"), // trailing commas
    () => {
      // remove control chars inside strings
      return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    },
    () => {
      // insert missing commas between adjacent strings/objects/arrays
      let t = s.replace(/,\s*([}\]])/g, "$1");
      t = t.replace(/("(?:[^"\\]|\\.)*")(\s*)(?=")/g, "$1,$2");
      t = t.replace(/([}\]])(\s*)(?=["{\[])/g, "$1,$2");
      return t;
    },
    () => {
      // close unbalanced braces/brackets
      let t = s.replace(/,\s*([}\]])/g, "$1");
      let braces = 0, brackets = 0, inStr = false, esc = false;
      for (const c of t) {
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{") braces++;
        else if (c === "}") braces--;
        else if (c === "[") brackets++;
        else if (c === "]") brackets--;
      }
      if (inStr) t += '"';
      while (brackets-- > 0) t += "]";
      while (braces-- > 0) t += "}";
      return t;
    },
  ];

  let lastErr: unknown;
  for (const make of attempts) {
    try {
      return JSON.parse(make()) as ResumeData;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("JSON parse failed");
}
