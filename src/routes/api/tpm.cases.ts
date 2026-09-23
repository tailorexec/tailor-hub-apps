import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";
import { requireApprovedUser } from "@/lib/tpm/auth.server";

function texto(v: unknown, max = 300) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export const Route = createFileRoute("/api/tpm/cases")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const { data, error } = await tpmAdmin
          .from("tailor_cases")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          console.error("[tpm] erro ao listar cases:", error);
          return Response.json({ error: "Erro ao carregar os cases." }, { status: 500 });
        }
        return Response.json({ cases: data ?? [] });
      },

      POST: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const client_name = texto(body?.client_name, 200);
        const sector = texto(body?.sector, 200);
        const function_searched = texto(body?.function_searched, 200);
        if (!client_name || !sector || !function_searched) {
          return Response.json(
            { error: "Cliente, setor e função são obrigatórios." },
            { status: 400 },
          );
        }

        const { error } = await tpmAdmin.from("tailor_cases").insert({
          client_name,
          sector,
          function_searched,
          seniority: texto(body?.seniority, 50) || "Director",
          complexity: texto(body?.complexity, 20) || "Média",
          region: texto(body?.region, 100),
          result: texto(body?.result, 2000) || null,
          years: texto(body?.years, 50) || null,
          tags: Array.isArray(body?.tags)
            ? (body.tags as unknown[])
                .filter((t): t is string => typeof t === "string")
                .slice(0, 30)
            : [],
          confidential: body?.confidential === true,
        });
        if (error) {
          console.error("[tpm] erro ao gravar case:", error);
          return Response.json({ error: "Erro ao salvar o case." }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
