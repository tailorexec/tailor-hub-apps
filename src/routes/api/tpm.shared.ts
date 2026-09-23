import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";

/**
 * Leitura pública de um briefing por link compartilhado.
 *
 * Única rota do TPM sem login — é o link que o consultor manda para o cliente.
 * Por isso ela devolve a VERSÃO CLIENTE: as seções internas são removidas aqui,
 * no servidor, e não escondidas no front.
 *
 * O que sai fora e por quê:
 * - `tailorConnections`: nomes de clientes da carteira, alguns confidenciais.
 * - `tailorAuthority`: faturamento por setor e lista de maiores clientes.
 * - `strategicReading`: dores, objeções e alavancas — é o roteiro comercial.
 * - `meetingSimulation`: as "munições" preparadas para a conversa.
 * - `quality.alerts`: avisos internos sobre a confiabilidade do próprio material.
 *
 * O app do Lovable mandava tudo isso no link. Mostrar ao cliente o argumento que
 * se pretendia usar com ele é pior do que não mandar link nenhum.
 */
export const Route = createFileRoute("/api/tpm/shared")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        // O token é gerado com 12 hex. Validar o formato antes de consultar evita
        // transformar o parâmetro em um filtro arbitrário.
        if (!/^[a-f0-9]{12}$/.test(token)) {
          return Response.json({ error: "Link inválido." }, { status: 400 });
        }

        const { data, error } = await tpmAdmin
          .from("tpm_reports")
          .select("id,company_name,created_at,report_data,input_data")
          .eq("share_token", token)
          .maybeSingle();

        if (error) {
          console.error("[tpm] erro ao ler briefing compartilhado:", error);
          return Response.json({ error: "Erro ao carregar o briefing." }, { status: 500 });
        }
        if (!data) {
          return Response.json({ error: "Briefing não encontrado." }, { status: 404 });
        }

        const bruto = (data.report_data ?? {}) as Record<string, unknown>;
        const {
          tailorConnections: _conexoes,
          tailorAuthority: _autoridade,
          strategicReading: _leitura,
          meetingSimulation: _simulacao,
          quality: qualidade,
          ...publico
        } = bruto;

        const q = (qualidade ?? {}) as Record<string, unknown>;
        const entrada = (data.input_data ?? {}) as Record<string, unknown>;

        return Response.json({
          report: {
            id: data.id,
            // Só o que identifica a reunião: o restante do input (texto livre do
            // consultor, print da agenda) é anotação interna.
            input: { companyName: entrada.companyName ?? data.company_name },
            ...publico,
            quality: {
              overallConfidence: q.overallConfidence ?? 0,
              sourcedDataPercent: q.sourcedDataPercent ?? 0,
              hypothesesPercent: q.hypothesesPercent ?? 0,
              alerts: [],
            },
            createdAt: data.created_at,
            version: "client",
          },
        });
      },
    },
  },
});
