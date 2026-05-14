import { createFileRoute } from "@tanstack/react-router";

const DAILY_LIMIT = 15;

export const Route = createFileRoute("/api/usage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
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
          const { id: userId } = (await userRes.json()) as { id?: string };
          if (!userId) {
            return Response.json({ error: "Sessão inválida." }, { status: 401 });
          }

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
          const used = parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;

          return Response.json({ used, limit: DAILY_LIMIT });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro interno";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
