// Porteiro das rotas do TPM.
//
// O TPM guarda dossiês de executivos e a carteira de clientes da Tailor (626
// cases, alguns marcados como confidenciais). Quem entra é quem já passou pela
// aprovação do hub — a mesma régua do gerador de currículo.
//
// A validação é toda contra o `tailor-site`, que é quem emite as sessões. O
// projeto Supabase do TPM não participa da autenticação.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface TpmCaller {
  userId: string;
  email: string | null;
}

/**
 * Devolve `{ caller }` quando a requisição vem de um usuário aprovado, ou
 * `{ response }` com o erro HTTP pronto quando não vem. Sempre testar o
 * `response` primeiro:
 *
 *   const gate = await requireApprovedUser(request);
 *   if (gate.response) return gate.response;
 *   // a partir daqui, gate.caller existe
 */
export async function requireApprovedUser(
  request: Request,
): Promise<{ caller: TpmCaller; response?: never } | { caller?: never; response: Response }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { response: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  const { data: user, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user?.user) {
    return { response: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("hub_status")
    .eq("id", user.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      response: Response.json({ error: "Não foi possível verificar seu acesso." }, { status: 500 }),
    };
  }
  if (profile?.hub_status !== "approved") {
    return {
      response: Response.json(
        { error: "Cadastro ainda não aprovado por um administrador." },
        { status: 403 },
      ),
    };
  }

  return { caller: { userId: user.user.id, email: user.user.email ?? null } };
}
