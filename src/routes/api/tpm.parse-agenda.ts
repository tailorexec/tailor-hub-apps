import Anthropic from "@anthropic-ai/sdk";
import { createFileRoute } from "@tanstack/react-router";

import { requireApprovedUser } from "@/lib/tpm/auth.server";
import { PARSE_AGENDA_SYSTEM_PROMPT } from "@/lib/tpm/prompts";

const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
type TipoAceito = (typeof TIPOS_ACEITOS)[number];

/** A imagem viaja em base64 dentro do JSON; 8 MB de base64 ≈ 6 MB de arquivo. */
const MAX_BASE64 = 8 * 1024 * 1024;

const AGENDA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["participants"],
  properties: {
    participants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          company: { type: ["string", "null"] },
          linkedinSearchQuery: { type: ["string", "null"] },
        },
      },
    },
    companyName: { type: ["string", "null"] },
    website: { type: ["string", "null"] },
    meetingSubject: { type: ["string", "null"] },
    meetingDate: { type: ["string", "null"] },
    meetingLocation: { type: ["string", "null"] },
    additionalContext: { type: ["string", "null"] },
  },
};

export const Route = createFileRoute("/api/tpm/parse-agenda")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
        }

        const body = (await request.json().catch(() => null)) as {
          imageBase64?: unknown;
          mimeType?: unknown;
        } | null;

        const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
        if (!imageBase64) {
          return Response.json({ error: "Envie a imagem da agenda." }, { status: 400 });
        }
        if (imageBase64.length > MAX_BASE64) {
          return Response.json({ error: "A imagem é grande demais." }, { status: 413 });
        }

        const informado = typeof body?.mimeType === "string" ? body.mimeType : "";
        const mimeType: TipoAceito = (TIPOS_ACEITOS as readonly string[]).includes(informado)
          ? (informado as TipoAceito)
          : "image/png";

        try {
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
            max_tokens: 4000,
            system: PARSE_AGENDA_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mimeType, data: imageBase64 },
                  },
                  {
                    type: "text",
                    text: "Analise esta imagem de convite/agenda de reunião e extraia todas as informações dos participantes.",
                  },
                ],
              },
            ],
            output_config: {
              format: { type: "json_schema", schema: AGENDA_SCHEMA },
              effort: "low",
            },
          });

          if (msg.stop_reason === "refusal") {
            return Response.json({ error: "A IA recusou analisar esta imagem." }, { status: 422 });
          }

          const bruto = msg.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");

          try {
            return Response.json({ data: JSON.parse(bruto) });
          } catch {
            console.error("[tpm] parse-agenda devolveu JSON inválido:", bruto.slice(0, 300));
            return Response.json(
              { error: "Não foi possível ler os dados da imagem." },
              { status: 502 },
            );
          }
        } catch (e) {
          console.error("[tpm] parse-agenda error:", e);
          if (e instanceof Anthropic.RateLimitError) {
            return Response.json(
              { error: "Limite de uso da IA atingido. Tente em instantes." },
              { status: 429 },
            );
          }
          if (e instanceof Anthropic.AuthenticationError) {
            return Response.json({ error: "Chave da Anthropic inválida." }, { status: 500 });
          }
          return Response.json({ error: "Erro ao ler a agenda." }, { status: 500 });
        }
      },
    },
  },
});
