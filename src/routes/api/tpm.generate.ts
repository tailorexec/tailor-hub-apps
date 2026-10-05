import Anthropic from "@anthropic-ai/sdk";
import { createFileRoute } from "@tanstack/react-router";

import { tpmAdmin } from "@/integrations/tpm/client.server";
import { requireApprovedUser } from "@/lib/tpm/auth.server";
import { calcularConexoes, gerarBriefing, rasparWebsite } from "@/lib/tpm/generate.server";
import type { CaseRow } from "@/lib/tpm/matching";
import type { TPMInput } from "@/lib/tpm/types";

export const Route = createFileRoute("/api/tpm/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireApprovedUser(request);
        if (gate.response) return gate.response;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
        }

        const body = (await request.json().catch(() => null)) as { input?: TPMInput } | null;
        const input = body?.input;
        if (!input?.companyName?.trim()) {
          return Response.json({ error: "Informe o nome da empresa." }, { status: 400 });
        }
        const usuario = gate.caller.email ?? gate.caller.userId;

        // Tudo daqui até o stream acontece ANTES de qualquer chamada paga.
        //
        // Em 05/10/2026 o projeto Supabase do TPM estava pausado: cada briefing
        // pesquisava na web no Opus, pagava, e só no fim falhava ao salvar com
        // "tente de novo" — e o consultor tentava. ~US$ 21 em duas horas sem
        // nenhum relatório gravado. Esta contagem é também o teste de que o
        // banco responde: se ela falhar, nada é gasto.
        //
        // Dois tetos: por consultor, e da casa inteira — o segundo é o que
        // segura a fatura quando vários usam no mesmo dia.
        const limiteDiario = Number(process.env.TPM_LIMITE_DIARIO) || 3;
        const limiteGlobal = Number(process.env.TPM_LIMITE_GLOBAL_DIARIO) || 10;
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [doUsuario, daCasa] = await Promise.all([
          tpmAdmin
            .from("tpm_reports")
            .select("id", { count: "exact", head: true })
            .eq("created_by", gate.caller.userId)
            .gte("created_at", desde),
          tpmAdmin
            .from("tpm_reports")
            .select("id", { count: "exact", head: true })
            .gte("created_at", desde),
        ]);
        const contagemErro = doUsuario.error ?? daCasa.error;
        const feitosHoje = doUsuario.count;
        if (contagemErro) {
          console.error("[tpm] banco do TPM indisponível:", contagemErro);
          return Response.json(
            {
              error:
                "O banco do TPM está fora do ar. Avise o administrador antes de tentar de novo.",
            },
            { status: 503 },
          );
        }
        if ((feitosHoje ?? 0) >= limiteDiario) {
          return Response.json(
            {
              error: `Você atingiu o limite de ${limiteDiario} briefings em 24 horas. Contate o administrador.`,
            },
            { status: 429 },
          );
        }
        if ((daCasa.count ?? 0) >= limiteGlobal) {
          return Response.json(
            {
              error: `A Tailor atingiu o limite de ${limiteGlobal} briefings em 24 horas. Contate o administrador.`,
            },
            { status: 429 },
          );
        }

        console.log(`[tpm] ${usuario} iniciou o briefing de ${input.companyName}`);

        // A geração faz várias buscas na web e leva minutos. Resposta em stream
        // para o consultor ver que está andando — e para não estourar o tempo
        // limite de uma resposta única.
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let fechado = false;
            const send = (obj: Record<string, unknown>) => {
              if (fechado) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            };
            const fail = (error: string) => {
              send({ stage: "erro", error });
              fechado = true;
              controller.close();
            };

            try {
              const anthropic = new Anthropic({ apiKey });

              send({ stage: "site", pct: 5, label: "Lendo o site da empresa" });
              const websiteContent = await rasparWebsite(input.website);

              send({ stage: "cases", pct: 12, label: "Cruzando com os cases da Tailor" });
              const { data: cases, error: casesError } = await tpmAdmin
                .from("tailor_cases")
                .select("id,client_name,sector,function_searched,tags,confidential");
              if (casesError) {
                // Banco caiu entre a checagem e aqui. Parar antes da pesquisa
                // paga — o relatório não teria onde ser salvo.
                console.error("[tpm] falha ao ler cases:", casesError);
                return fail("O banco do TPM está fora do ar. Avise o administrador.");
              }

              const { conexoes } = await calcularConexoes(
                anthropic,
                usuario,
                input,
                (cases ?? []) as CaseRow[],
                websiteContent,
              );
              send({
                stage: "cases",
                pct: 25,
                label:
                  conexoes.length > 0
                    ? `${conexoes.length} cliente(s) Tailor com afinidade`
                    : "Sem cliente Tailor do mesmo setor",
              });

              send({ stage: "pesquisa", pct: 30, label: "Pesquisando na web" });
              const { reportData, buscasFeitas } = await gerarBriefing(
                anthropic,
                usuario,
                input,
                conexoes,
                websiteContent,
                (buscas) => {
                  // A barra acompanha as buscas reais. Satura perto de 90 porque
                  // não se sabe quantas o modelo ainda vai querer fazer.
                  const pct = Math.min(90, 30 + Math.floor(60 * (1 - Math.exp(-buscas / 8))));
                  send({ stage: "pesquisa", pct, label: `${buscas} fonte(s) consultada(s)` });
                },
              );

              send({ stage: "salvando", pct: 94, label: "Salvando o briefing" });
              const reportId = crypto.randomUUID();
              const shareToken = crypto.randomUUID().replace(/-/g, "").substring(0, 12);
              const quality = reportData.quality as { overallConfidence?: number } | undefined;

              const { error: insertError } = await tpmAdmin.from("tpm_reports").insert({
                id: reportId,
                company_name: input.companyName,
                input_data: input,
                report_data: reportData,
                quality_score: quality?.overallConfidence ?? 0,
                share_token: shareToken,
                created_by: gate.caller.userId,
                created_by_email: gate.caller.email,
              });
              if (insertError) {
                console.error("[tpm] falha ao gravar o relatório:", insertError);
                return fail("O briefing foi gerado mas não pôde ser salvo. Tente de novo.");
              }

              send({
                stage: "pronto",
                pct: 100,
                label: "Briefing pronto",
                buscasFeitas,
                report: {
                  id: reportId,
                  input,
                  ...reportData,
                  createdAt: new Date().toISOString(),
                  version: "internal",
                  shareToken,
                },
              });
              fechado = true;
              controller.close();
            } catch (e) {
              console.error("[tpm] generate error:", e);
              if (e instanceof Anthropic.RateLimitError) {
                return fail("Limite de uso da IA atingido. Tente novamente em instantes.");
              }
              if (e instanceof Anthropic.AuthenticationError) {
                return fail("Chave da API da Anthropic inválida.");
              }
              if (
                e instanceof Anthropic.APIError &&
                (e.status === 529 || /overloaded/i.test(e.message))
              ) {
                return fail("A IA está sobrecarregada. Tente novamente em instantes.");
              }
              if (e instanceof Anthropic.APIError && /credit|balance/i.test(e.message)) {
                return fail("Créditos da Anthropic esgotados. Recarregue o saldo da conta.");
              }
              return fail(e instanceof Error ? e.message : "Erro ao gerar o briefing.");
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
