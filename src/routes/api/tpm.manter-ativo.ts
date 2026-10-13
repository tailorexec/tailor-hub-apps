import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";

// Mantém o projeto Supabase do TPM acordado.
//
// O plano gratuito pausa o projeto depois de 7 dias sem uso. Aconteceu em
// 05/10/2026 (o TPM pagava a pesquisa e só falhava ao salvar) e de novo em
// 13/10/2026 (aí a trava de api/tpm/generate já recusava antes de gastar, mas
// o TPM ficava fora do ar até alguém reativar o projeto à mão).
//
// A Vercel chama esta rota uma vez por dia (crons em vite.config.ts). Uma
// leitura de uma linha basta para contar como uso. Não devolve dado nenhum.
//
// Se o projeto JÁ estiver pausado, isto não o reativa — só reativar no painel.
// Aqui ele apenas deixa de pausar enquanto o cron estiver rodando.
export const Route = createFileRoute("/api/tpm/manter-ativo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Com CRON_SECRET definido na Vercel, só a própria Vercel chama.
        const segredo = process.env.CRON_SECRET;
        if (segredo && request.headers.get("authorization") !== `Bearer ${segredo}`) {
          return Response.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { error } = await tpmAdmin.from("tailor_cases").select("id").limit(1);
        if (error) {
          console.error("[tpm] manter-ativo: banco do TPM não respondeu:", error);
          return Response.json({ ok: false }, { status: 503 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
