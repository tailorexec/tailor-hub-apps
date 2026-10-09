-- ============================================================================
-- Tailor Hub — avisos da faixa da página inicial
-- Projeto: tailor-site (xxltytblimzhcyqlvikx) — banco COMPARTILHADO com o site.
--
-- Mesmas regras de 20260909120000: só acrescenta, idempotente, políticas com
-- prefixo "hub_".
--
-- Quem lê: qualquer usuário logado, e só os avisos publicados. A página
-- inicial é pública, mas aviso interno não é — `anon` não enxerga nada.
-- Quem escreve: admin do hub (user_roles.role = 'admin', via has_role, a mesma
-- régua que o painel /admin usa).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hub_avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 200),
  publicado boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_avisos_publicados_idx
  ON public.hub_avisos (created_at DESC) WHERE publicado;

ALTER TABLE public.hub_avisos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_avisos TO authenticated;
GRANT ALL ON public.hub_avisos TO service_role;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT * FROM (VALUES
      ('hub_avisos_ler_publicados', 'SELECT',
       'publicado OR public.has_role(auth.uid(), ''admin'')', NULL),
      ('hub_avisos_admin_cria', 'INSERT',
       NULL, 'public.has_role(auth.uid(), ''admin'')'),
      ('hub_avisos_admin_altera', 'UPDATE',
       'public.has_role(auth.uid(), ''admin'')', NULL),
      ('hub_avisos_admin_apaga', 'DELETE',
       'public.has_role(auth.uid(), ''admin'')', NULL)
    ) AS t(name, cmd, using_expr, check_expr)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'hub_avisos'
                      AND policyname = pol.name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.hub_avisos FOR %s TO authenticated %s',
        pol.name, pol.cmd,
        CASE WHEN pol.check_expr IS NOT NULL
             THEN 'WITH CHECK (' || pol.check_expr || ')'
             ELSE 'USING (' || pol.using_expr || ')' END
      );
    END IF;
  END LOOP;
END $$;
