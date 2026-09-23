// Cliente do projeto Supabase do TPM (Tailor Pre-Meeting).
//
// O TPM vive num projeto Supabase PRÓPRIO, separado do `tailor-site` que guarda
// a autenticação do hub. Quem autentica continua sendo o `tailor-site`; este
// projeto aqui só guarda dados e é acessado exclusivamente pelo servidor, com a
// service key.
//
// Por que não deixar o navegador falar direto com ele: as sessões do hub são
// emitidas pelo `tailor-site`, então o RLS daqui não teria como reconhecê-las —
// qualquer política teria de liberar para `anon`, que foi exatamente o buraco
// herdado do Lovable (tudo `USING (true)`, chave anon no bundle). Com o acesso
// só pelo servidor, o porteiro é a sessão do hub e o RLS pode ficar fechado.
import { createClient } from "@supabase/supabase-js";

function createTpmAdminClient() {
  const TPM_SUPABASE_URL = process.env.TPM_SUPABASE_URL;
  const TPM_SUPABASE_SERVICE_ROLE_KEY = process.env.TPM_SUPABASE_SERVICE_ROLE_KEY;

  if (!TPM_SUPABASE_URL || !TPM_SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!TPM_SUPABASE_URL ? ["TPM_SUPABASE_URL"] : []),
      ...(!TPM_SUPABASE_SERVICE_ROLE_KEY ? ["TPM_SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    const message =
      `Variável(is) de ambiente do TPM faltando: ${missing.join(", ")}. ` +
      `Configure no .env (local) ou nas variáveis de ambiente da Vercel (produção).`;
    console.error(`[TPM] ${message}`);
    throw new Error(message);
  }

  return createClient(TPM_SUPABASE_URL, TPM_SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _tpmAdmin: ReturnType<typeof createTpmAdminClient> | undefined;

// SEGURANÇA: bypassa RLS. Só pode ser importado por rotas de API (servidor).
// A criação é preguiçosa para que a ausência da variável só quebre a rota do
// TPM, e não o build inteiro do hub.
export const tpmAdmin = new Proxy({} as ReturnType<typeof createTpmAdminClient>, {
  get(_, prop, receiver) {
    if (!_tpmAdmin) _tpmAdmin = createTpmAdminClient();
    return Reflect.get(_tpmAdmin, prop, receiver);
  },
});
