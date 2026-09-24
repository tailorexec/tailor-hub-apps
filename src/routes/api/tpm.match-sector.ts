import Anthropic from "@anthropic-ai/sdk";
import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";
import { requireApprovedUser } from "@/lib/tpm/auth.server";
import { expandirPorFamilia, extrairTagsUnicas, type CaseRow } from "@/lib/tpm/matching";
import { MATCH_SECTOR_SYSTEM_PROMPT } from "@/lib/tpm/prompts";
import { registraUso } from "@/lib/ai-usage.server";

const MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["companyName", "mainSector", "matchingSectors"],
  properties: {
    companyName: { type: "string" },
    mainSector: { type: "string" },
    businessModel: { type: "string" },
    relatedSectors: { type: "array", items: { type: "string" } },
    matchingSectors: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
  },
};

/**
 * Busca por afinidade setorial na base de cases.
 *
 * A lista de tags vem do banco no servidor — o navegador não precisa (nem deve)
 * receber a carteira inteira só para montar a consulta.
 */
export const Route = createFileRoute("/api/tpm/match-sector")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
        }

        const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
        const query = typeof body?.query === "string" ? body.query.trim().slice(0, 500) : "";
        if (!query) {
          return Response.json({ error: "Informe a empresa a pesquisar." }, { status: 400 });
        }

        const { data: cases, error } = await tpmAdmin
          .from("tailor_cases")
          .select("id,client_name,sector,function_searched,tags,confidential");
        if (error) {
          console.error("[tpm] erro ao ler cases para matching:", error);
          return Response.json({ error: "Erro ao carregar os cases." }, { status: 500 });
        }

        const tags = extrairTagsUnicas((cases ?? []) as CaseRow[]);
        if (tags.length === 0) {
          return Response.json({ match: { matchingSectors: [] }, expandidos: [] });
        }

        try {
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL_TPM || "claude-opus-5",
            max_tokens: 2000,
            system: MATCH_SECTOR_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Empresa pesquisada: "${query}"\n\nSetores/tags disponíveis na base (cada um é uma tag individual): ${JSON.stringify(
                  tags,
                )}\n\nIdentifique o setor REAL desta empresa e retorne SOMENTE os setores da lista que têm afinidade genuína. Seja CÉTICO — prefira não retornar nada a retornar matches forçados.`,
              },
            ],
            output_config: {
              format: { type: "json_schema", schema: MATCH_SCHEMA },
              effort: "low",
            },
          });

          registraUso("tpm-busca-setor", msg);

          if (msg.stop_reason === "refusal") {
            return Response.json({ error: "A IA recusou a consulta." }, { status: 422 });
          }

          const bruto = msg.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");

          const match = JSON.parse(bruto) as { matchingSectors?: string[] };
          // A mesma expansão por família usada na geração, para que a busca da
          // tela e o matching do briefing deem o mesmo resultado.
          const expandidos = expandirPorFamilia(match.matchingSectors ?? [], tags);

          return Response.json({ match, expandidos });
        } catch (e) {
          console.error("[tpm] match-sector error:", e);
          if (e instanceof Anthropic.RateLimitError) {
            return Response.json(
              { error: "Limite de uso da IA atingido. Tente em instantes." },
              { status: 429 },
            );
          }
          return Response.json({ error: "Erro na busca por setor." }, { status: 500 });
        }
      },
    },
  },
});
