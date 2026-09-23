-- ============================================================================
-- Concede à service_role o acesso às tabelas do TPM.
--
-- POR QUE ISTO EXISTE: a migration anterior ligou o RLS e fez
-- `REVOKE ALL ... FROM anon, authenticated`, contando com os privilégios padrão
-- do Supabase para que a `service_role` continuasse enxergando as tabelas. Isso
-- não aconteceu — tabelas criadas pelo editor SQL não receberam o GRANT — e
-- TODA rota do TPM respondia 403 "permission denied for table ...".
--
-- RLS e GRANT são coisas diferentes e as duas precisam estar certas:
--   - GRANT decide se o papel pode tocar na tabela.
--   - RLS decide quais linhas ele vê depois de poder tocar.
-- A service_role ignora o RLS, mas não ignora a falta de GRANT.
--
-- O que NÃO muda: `anon` e `authenticated` continuam sem nenhum privilégio,
-- que é o ponto da migration anterior.
--
-- Idempotente.
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sectors','companies','executives','tailor_cases','tailor_clients',
    'tpm_reports','surgical_questions','tpm_section_feedback'
  ] LOOP
    -- O hub precisa de DELETE também (exclusão de briefing no histórico).
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    -- Reafirma o fechamento, caso algum GRANT padrão tenha voltado.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Tabelas futuras neste schema já nascem com o mesmo arranjo.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
