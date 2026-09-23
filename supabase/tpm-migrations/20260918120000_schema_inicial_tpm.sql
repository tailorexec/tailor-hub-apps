-- ============================================================================
-- Schema do TPM (Tailor Pre-Meeting) no projeto próprio.
--
-- Origem: supabase/migrations/* do repositório tailorexec/tailor-pre-meeting,
-- que o Lovable gerou. As colunas são as mesmas, para que os 326 briefings e os
-- 626 cases já existentes possam ser importados sem conversão.
--
-- A DIFERENÇA ESTÁ NO RLS. No projeto original toda tabela tinha
-- `USING (true)` — "viewable by everyone", "inserted by anyone", "deleted by
-- anyone" — e a app não tinha login nenhum. Como a chave anon vai no bundle do
-- navegador e estava commitada no repositório, qualquer pessoa com ela lia,
-- alterava e apagava a carteira de clientes (incluindo os marcados como
-- confidenciais) e todos os briefings.
--
-- Aqui: RLS ligado e NENHUMA policy. A service key do servidor do hub passa por
-- cima do RLS por definição; `anon` e `authenticated` não enxergam nada. O
-- porteiro passa a ser a sessão do hub, validada em src/lib/tpm/auth.server.ts.
--
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  linkedin_url TEXT,
  sector_id UUID REFERENCES public.sectors(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.executives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  company_id UUID REFERENCES public.companies(id),
  linkedin_url TEXT,
  trajectory TEXT,
  time_at_company TEXT,
  power_level TEXT CHECK (power_level IN ('Decisor', 'Influenciador', 'Executor')),
  probable_agenda TEXT,
  connection_points TEXT[],
  approach_risks TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tailor_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  function_searched TEXT NOT NULL,
  seniority TEXT NOT NULL,
  complexity TEXT NOT NULL,
  region TEXT NOT NULL,
  result TEXT,
  years TEXT DEFAULT '',
  tags TEXT[],
  confidential BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tailor_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  subsector TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tpm_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version TEXT NOT NULL DEFAULT 'internal' CHECK (version IN ('internal', 'client')),
  quality_score INTEGER DEFAULT 0,
  share_token TEXT,
  simulation_cards JSONB,
  simulation_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.surgical_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tpm_section_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL,
  section_key TEXT NOT NULL,
  feedback TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O link de compartilhamento é procurado por token a cada acesso público.
CREATE UNIQUE INDEX IF NOT EXISTS tpm_reports_share_token_key
  ON public.tpm_reports (share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS tpm_reports_created_at_idx
  ON public.tpm_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS tpm_section_feedback_report_idx
  ON public.tpm_section_feedback (report_id);

-- updated_at automático, como no projeto original.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','executives','tailor_cases','tpm_reports'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgname = 'update_' || t || '_updated_at'
         AND tgrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    END IF;
  END LOOP;
END $$;

-- ─── RLS: ligado, sem policy ────────────────────────────────────────────────
-- Sem política, `anon` e `authenticated` não leem nem escrevem nada. A service
-- key do servidor do hub não é afetada. É este bloco que fecha o buraco que
-- veio do Lovable.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sectors','companies','executives','tailor_cases','tailor_clients',
    'tpm_reports','surgical_questions','tpm_section_feedback'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

COMMENT ON TABLE public.tailor_cases IS
  'Carteira da Tailor. Contém client_name e a flag confidential — nunca expor ao anon.';
COMMENT ON TABLE public.tpm_reports IS
  'Briefings pré-reunião. report_data traz leitura estratégica interna; a rota pública /api/tpm/shared remove essas seções antes de responder.';
