-- Quem gerou cada briefing.
--
-- Em 05/10/2026 o TPM gastou ~US$ 21 de API em duas horas (84 buscas na web no
-- Opus 5) e não havia como dizer qual consultor gerou os briefings: a tabela
-- guardava a empresa e o horário, mas não a pessoa.
--
-- Sem FK de propósito: o usuário vive no `tailor-site`, outro projeto Supabase.
-- O e-mail fica gravado junto porque o id sozinho não se resolve daqui.
--
-- Também sustenta o limite diário por usuário em `api/tpm/generate`. Sem esta
-- migration aplicada, a contagem falha e a rota recusa TODO briefing com 503 —
-- o TPM fica parado, mas não gasta nada.
ALTER TABLE public.tpm_reports
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

CREATE INDEX IF NOT EXISTS tpm_reports_created_by_idx
  ON public.tpm_reports (created_by, created_at DESC);
