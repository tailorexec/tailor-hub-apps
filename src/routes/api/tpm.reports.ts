import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";
import { requireApprovedUser } from "@/lib/tpm/auth.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Colunas do histórico. `report_data` é pesado — só vai na leitura de um item. */
const COLUNAS_LISTA =
  "id,company_name,created_at,updated_at,quality_score,share_token,simulation_generated,version";

export const Route = createFileRoute("/api/tpm/reports")({
  server: {
    handlers: {
      // Lista o histórico, ou um relatório inteiro com ?id=
      GET: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const id = new URL(request.url).searchParams.get("id");

        if (id) {
          if (!UUID_RE.test(id)) {
            return Response.json({ error: "Relatório inválido." }, { status: 400 });
          }
          const { data, error } = await tpmAdmin
            .from("tpm_reports")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (error) {
            console.error("[tpm] erro ao ler relatório:", error);
            return Response.json({ error: "Erro ao carregar o briefing." }, { status: 500 });
          }
          if (!data) {
            return Response.json({ error: "Briefing não encontrado." }, { status: 404 });
          }
          return Response.json({ report: data });
        }

        const { data, error } = await tpmAdmin
          .from("tpm_reports")
          .select(COLUNAS_LISTA)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) {
          console.error("[tpm] erro ao listar relatórios:", error);
          return Response.json({ error: "Erro ao carregar o histórico." }, { status: 500 });
        }
        return Response.json({ reports: data ?? [] });
      },

      // Grava o link de compartilhamento ou os cards da simulação.
      PATCH: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const body = (await request.json().catch(() => null)) as {
          id?: unknown;
          shareToken?: unknown;
          simulationCards?: unknown;
        } | null;

        const id = typeof body?.id === "string" ? body.id : "";
        if (!UUID_RE.test(id)) {
          return Response.json({ error: "Relatório inválido." }, { status: 400 });
        }

        const patch: Record<string, unknown> = {};
        if (typeof body?.shareToken === "string" && /^[a-f0-9]{12}$/.test(body.shareToken)) {
          patch.share_token = body.shareToken;
        }
        if (body?.simulationCards !== undefined) {
          patch.simulation_cards = body.simulationCards;
          patch.simulation_generated = true;
        }
        if (Object.keys(patch).length === 0) {
          return Response.json({ error: "Nada a atualizar." }, { status: 400 });
        }

        const { error } = await tpmAdmin.from("tpm_reports").update(patch).eq("id", id);
        if (error) {
          console.error("[tpm] erro ao atualizar relatório:", error);
          return Response.json({ error: "Erro ao salvar." }, { status: 500 });
        }
        return Response.json({ ok: true });
      },

      DELETE: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!UUID_RE.test(id)) {
          return Response.json({ error: "Relatório inválido." }, { status: 400 });
        }

        const { error } = await tpmAdmin.from("tpm_reports").delete().eq("id", id);
        if (error) {
          console.error("[tpm] erro ao excluir relatório:", error);
          return Response.json({ error: "Erro ao excluir." }, { status: 500 });
        }
        // Quem apagou o quê importa: o briefing pode ter sido usado numa reunião.
        console.log(`[tpm] ${gate.caller.email ?? gate.caller.userId} excluiu o TPM ${id}`);
        return Response.json({ ok: true });
      },
    },
  },
});
