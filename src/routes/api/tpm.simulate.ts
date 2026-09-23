import Anthropic from "@anthropic-ai/sdk";
import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";
import { requireApprovedUser } from "@/lib/tpm/auth.server";
import { buildSimulateSystemPrompt } from "@/lib/tpm/prompts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "argument", "evidence", "hook"],
        properties: {
          type: {
            type: "string",
            enum: [
              "pain_point",
              "market_insight",
              "case_proof",
              "executive_hook",
              "urgency_trigger",
              "value_proposition",
            ],
          },
          title: { type: "string" },
          argument: { type: "string" },
          evidence: { type: "string" },
          hook: { type: "string" },
        },
      },
    },
  },
};

export const Route = createFileRoute("/api/tpm/simulate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
        }

        const body = (await request.json().catch(() => null)) as { reportId?: unknown } | null;
        const reportId = typeof body?.reportId === "string" ? body.reportId : "";
        if (!UUID_RE.test(reportId)) {
          return Response.json({ error: "Briefing inválido." }, { status: 400 });
        }

        // O relatório vem do banco, não do corpo da requisição: assim os cards
        // são gerados sobre o briefing que está de fato salvo, e o cliente não
        // consegue mandar um relatório forjado para dentro do prompt.
        const { data: linha, error: readError } = await tpmAdmin
          .from("tpm_reports")
          .select("company_name,report_data,simulation_cards")
          .eq("id", reportId)
          .maybeSingle();
        if (readError) {
          console.error("[tpm] erro ao ler relatório para simulação:", readError);
          return Response.json({ error: "Erro ao carregar o briefing." }, { status: 500 });
        }
        if (!linha) {
          return Response.json({ error: "Briefing não encontrado." }, { status: 404 });
        }

        // Já gerado antes: devolve o que está salvo em vez de gastar outra
        // chamada de IA.
        if (linha.simulation_cards) {
          return Response.json({
            cards: (linha.simulation_cards as { cards?: unknown }).cards ?? linha.simulation_cards,
          });
        }

        const relatorio = (linha.report_data ?? {}) as Record<string, unknown>;
        const companyName = linha.company_name || "Empresa";

        const contexto = JSON.stringify({
          executiveSummary: relatorio.executiveSummary,
          market: relatorio.market,
          company: relatorio.company,
          executives: Array.isArray(relatorio.executives)
            ? (relatorio.executives as Record<string, unknown>[]).map((e) => ({
                name: e.name,
                title: e.title,
                probableAgenda: e.probableAgenda,
                connectionPoints: e.connectionPoints,
              }))
            : [],
          tailorConnections: relatorio.tailorConnections,
          tailorAuthority: relatorio.tailorAuthority,
          strategicReading: relatorio.strategicReading,
        });

        try {
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
            max_tokens: 8000,
            system: buildSimulateSystemPrompt(companyName),
            messages: [
              {
                role: "user",
                content: `Gere 6 cards estratégicos para a reunião com ${companyName}.\n\nRELATÓRIO TPM COMPLETO:\n${contexto}`,
              },
            ],
            output_config: {
              format: { type: "json_schema", schema: CARDS_SCHEMA },
              effort: "medium",
            },
          });

          if (msg.stop_reason === "refusal") {
            return Response.json({ error: "A IA recusou gerar a simulação." }, { status: 422 });
          }

          const bruto = msg.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");

          let cards: unknown;
          try {
            cards = (JSON.parse(bruto) as { cards?: unknown }).cards;
          } catch {
            console.error("[tpm] simulate devolveu JSON inválido:", bruto.slice(0, 300));
            return Response.json({ error: "A IA devolveu um JSON inválido." }, { status: 502 });
          }

          const { error: saveError } = await tpmAdmin
            .from("tpm_reports")
            .update({ simulation_cards: { cards }, simulation_generated: true })
            .eq("id", reportId);
          if (saveError) {
            // Os cards já existem; não vale perder a geração por falha de escrita.
            console.error("[tpm] erro ao salvar cards da simulação:", saveError);
          }

          return Response.json({ cards });
        } catch (e) {
          console.error("[tpm] simulate error:", e);
          if (e instanceof Anthropic.RateLimitError) {
            return Response.json(
              { error: "Limite de uso da IA atingido. Tente em instantes." },
              { status: 429 },
            );
          }
          return Response.json({ error: "Erro ao gerar a simulação." }, { status: 500 });
        }
      },
    },
  },
});
