import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Mesmo mínimo do /signup, para não criar duas regras de senha no produto.
const MIN_LEN = 6;
// O bcrypt do GoTrue ignora tudo além de 72 bytes. Aceitar mais do que isso
// guardaria uma senha menor do que a digitada — melhor recusar e avisar.
const MAX_BYTES = 72;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/admin-set-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!token) {
            return Response.json({ error: "Não autenticado." }, { status: 401 });
          }

          // O token é a única fonte confiável de quem está pedindo: o corpo da
          // requisição vem do navegador e pode afirmar qualquer coisa.
          const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(token);
          if (callerError || !caller?.user) {
            return Response.json({ error: "Sessão inválida." }, { status: 401 });
          }

          // Mesma checagem que o useAuth faz no cliente — só que aqui ela vale,
          // porque o cliente pode ser contornado com um curl.
          const { data: roles, error: rolesError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", caller.user.id)
            .eq("role", "admin")
            .limit(1);
          if (rolesError) {
            return Response.json(
              { error: "Não foi possível verificar suas permissões." },
              { status: 500 },
            );
          }
          if (!roles?.length) {
            return Response.json({ error: "Ação restrita a administradores." }, { status: 403 });
          }

          const body = (await request.json().catch(() => null)) as {
            userId?: unknown;
            password?: unknown;
          } | null;
          const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
          const password = typeof body?.password === "string" ? body.password : "";

          if (!UUID_RE.test(userId)) {
            return Response.json({ error: "Usuário inválido." }, { status: 400 });
          }
          if (password.length < MIN_LEN) {
            return Response.json(
              { error: `A senha precisa ter ao menos ${MIN_LEN} caracteres.` },
              { status: 400 },
            );
          }
          if (new TextEncoder().encode(password).length > MAX_BYTES) {
            return Response.json(
              { error: `A senha é longa demais (limite de ${MAX_BYTES} bytes).` },
              { status: 400 },
            );
          }

          const { data: updated, error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(userId, { password });
          if (updateError) {
            const status = updateError.status === 404 ? 404 : 400;
            return Response.json({ error: updateError.message }, { status });
          }

          // Trilha de auditoria mínima: senha de terceiro trocada por um admin é
          // o tipo de evento que se precisa reconstruir depois. Vai para os logs
          // da Vercel; a senha em si nunca é registrada.
          console.log(
            `[admin-set-password] ${caller.user.email ?? caller.user.id} alterou a senha de ${
              updated.user?.email ?? userId
            }`,
          );

          return Response.json({ ok: true, email: updated.user?.email ?? null });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro interno";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
