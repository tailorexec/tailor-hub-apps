import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";
import { requireApprovedUser } from "@/lib/tpm/auth.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Os valores são os que o app do Lovable já gravou — mudar aqui deixaria os
// registros existentes órfãos da interface.
const FEEDBACKS = ["positive", "negative"] as const;

export const Route = createFileRoute("/api/tpm/feedback")({
  server: {
    handlers: {
      // Feedbacks já dados num briefing, para a interface marcar os botões.
      GET: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const reportId = new URL(request.url).searchParams.get("reportId") ?? "";
        if (!UUID_RE.test(reportId)) {
          return Response.json({ error: "Briefing inválido." }, { status: 400 });
        }

        const { data, error } = await tpmAdmin
          .from("tpm_section_feedback")
          .select("section_key,feedback")
          .eq("report_id", reportId);
        if (error) {
          console.error("[tpm] erro ao ler feedback:", error);
          return Response.json({ error: "Erro ao carregar." }, { status: 500 });
        }
        return Response.json({ feedback: data ?? [] });
      },

      POST: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const body = (await request.json().catch(() => null)) as {
          reportId?: unknown;
          sectionKey?: unknown;
          feedback?: unknown;
        } | null;

        const reportId = typeof body?.reportId === "string" ? body.reportId : "";
        const sectionKey = typeof body?.sectionKey === "string" ? body.sectionKey.slice(0, 80) : "";
        const feedback = typeof body?.feedback === "string" ? body.feedback : "";

        if (!UUID_RE.test(reportId) || !sectionKey) {
          return Response.json({ error: "Dados inválidos." }, { status: 400 });
        }
        if (!(FEEDBACKS as readonly string[]).includes(feedback)) {
          return Response.json({ error: "Feedback inválido." }, { status: 400 });
        }

        const { error } = await tpmAdmin
          .from("tpm_section_feedback")
          .insert({ report_id: reportId, section_key: sectionKey, feedback });
        if (error) {
          console.error("[tpm] erro ao gravar feedback:", error);
          return Response.json({ error: "Erro ao salvar." }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
