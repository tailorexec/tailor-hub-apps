-- ============================================================================
-- Tailor Hub — migration ADITIVA para o banco compartilhado com o site
-- Projeto: tailor-site (xxltytblimzhcyqlvikx)
--
-- REGRAS DESTE ARQUIVO:
--   * Nada é dropado, renomeado ou alterado em estrutura já existente.
--   * Tudo é idempotente (pode rodar duas vezes sem erro).
--   * Políticas do hub usam o prefixo "hub_" para não colidir com as do site
--     (o site já tem "Admins can manage roles", "Admins can view all roles",
--      "Profiles are viewable by everyone", etc.).
--   * Nenhum usuário é criado com senha fixa.
-- ============================================================================

-- ─── 1. profiles: adiciona apenas a coluna `email`, que o hub precisa ────────
-- O site já tem a tabela com id, full_name, avatar_url, bio, job_title,
-- created_at, updated_at e status(text). Só falta o email.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill a partir do auth.users (só preenche o que está vazio)
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE u.id = p.id
   AND p.email IS NULL;

-- PRIVACIDADE: o site expõe profiles publicamente pela policy
-- "Profiles are viewable by everyone". Sem o bloco abaixo, o e-mail de todos os
-- usuários ficaria legível por qualquer pessoa com a chave anon — que está no
-- bundle JS público do site.
--
-- Um "REVOKE SELECT (email)" sozinho NÃO resolve: no Postgres, privilégio de
-- coluna e de tabela são independentes, e o Supabase concede SELECT no nível da
-- tabela para anon. É preciso revogar a tabela e reconceder coluna a coluna.
-- Efeito colateral: colunas criadas no futuro precisarão de GRANT explícito
-- para o anon.
DO $$
DECLARE cols text;
BEGIN
  IF has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'profiles'
       AND column_name <> 'email';

    EXECUTE 'REVOKE SELECT ON public.profiles FROM anon';
    EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon', cols);
    RAISE NOTICE 'anon agora lê profiles sem a coluna email';
  END IF;
END $$;

-- O cadastro do hub chama apenas auth.signUp(), então a linha de profiles vem de
-- trigger. O site JÁ tem o trigger `on_auth_user_created`, que é quem cria a
-- linha — este aqui apenas COMPLEMENTA o email, que é coluna nova e portanto
-- nenhuma função existente preenche.
--
-- Dois cuidados deliberados:
--   1) Nome com prefixo "zz_": triggers do Postgres disparam em ordem
--      alfabética. "zz_" garante que este rode DEPOIS de on_auth_user_created,
--      quando a linha do profile já existe.
--   2) Só faz UPDATE, nunca INSERT. Um INSERT aqui competiria com o trigger do
--      site e, se a função dele não usar ON CONFLICT, quebraria o cadastro
--      inteiro com erro de chave duplicada.
CREATE OR REPLACE FUNCTION public.zz_hub_fill_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET email = NEW.email
   WHERE id = NEW.id
     AND email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS hub_on_auth_user_created ON auth.users;  -- versão anterior
DROP TRIGGER IF EXISTS zz_hub_fill_profile_email ON auth.users;
CREATE TRIGGER zz_hub_fill_profile_email
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.zz_hub_fill_profile_email();

-- Rede de segurança para o acesso do hub.
--
-- O hub libera o gerador com status = 'approved'. Hoje a tabela tem 2 linhas,
-- ambas 'approved' — o mesmo vocabulário do hub. O que não dá para afirmar é
-- como um cadastro NOVO chega: se o trigger do site gravar 'approved' por
-- padrão, qualquer um que se cadastrasse ganharia acesso ao gerador sozinho.
--
-- Se a coluna não tem DEFAULT, define 'pending'. Assim, um INSERT que omita
-- status passa a cair em 'pending' em vez de NULL, e a aprovação fica sendo
-- sempre um ato explícito de um admin. Se já houver DEFAULT, nada é alterado —
-- não se sobrepõe a uma decisão do site.
--
-- Isto NÃO cobre o caso do trigger do site gravar 'approved' explicitamente:
-- nesse caso o DEFAULT é ignorado. Ver a verificação pós-deploy no README.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND column_name = 'status' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';
    RAISE NOTICE 'profiles.status agora tem DEFAULT pending';
  ELSE
    RAISE NOTICE 'profiles.status já tinha DEFAULT — mantido como está';
  END IF;
END $$;

-- ─── 2. generations: quota diária do gerador de currículo ───────────────────

CREATE TABLE IF NOT EXISTS public.generations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON public.generations (user_id, created_at DESC);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.generations TO authenticated;
GRANT ALL    ON public.generations TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='generations'
                    AND policyname='hub_users_view_own_generations') THEN
    CREATE POLICY hub_users_view_own_generations
      ON public.generations FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 3. NPS ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_role') THEN
    CREATE TYPE public.nps_role AS ENUM ('pending','approved','rejected','admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.nps_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text,
  consultor    text,
  contratado   boolean NOT NULL,
  nps_score    smallint NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  entendimento smallint CHECK (entendimento BETWEEN 1 AND 7),
  atendimento  smallint CHECK (atendimento BETWEEN 1 AND 7),
  projeto      smallint CHECK (projeto BETWEEN 1 AND 7),
  comentarios  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.nps_responses TO anon, authenticated;
GRANT SELECT ON public.nps_responses TO authenticated;
GRANT ALL    ON public.nps_responses TO service_role;

CREATE TABLE IF NOT EXISTS public.nps_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status     public.nps_role NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_access ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_access TO authenticated;
GRANT ALL ON public.nps_access TO service_role;

-- Helpers SECURITY DEFINER (evitam recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_nps_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nps_access WHERE user_id = _uid AND status = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_nps_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nps_access
                  WHERE user_id = _uid AND status IN ('approved','admin'))
$$;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT * FROM (VALUES
      ('nps_responses','hub_anyone_can_submit_nps','INSERT','anon, authenticated',
       NULL, 'true'),
      ('nps_responses','hub_nps_users_view_responses','SELECT','authenticated',
       'public.has_nps_access(auth.uid())', NULL),
      ('nps_responses','hub_nps_admin_delete_responses','DELETE','authenticated',
       'public.is_nps_admin(auth.uid())', NULL),
      ('nps_access','hub_users_view_own_nps_access','SELECT','authenticated',
       'auth.uid() = user_id', NULL),
      ('nps_access','hub_nps_admin_view_all_access','SELECT','authenticated',
       'public.is_nps_admin(auth.uid())', NULL),
      ('nps_access','hub_nps_admin_update_access','UPDATE','authenticated',
       'public.is_nps_admin(auth.uid())', NULL),
      ('nps_access','hub_nps_admin_delete_access','DELETE','authenticated',
       'public.is_nps_admin(auth.uid())', NULL)
    ) AS t(tbl, name, cmd, roles, using_expr, check_expr)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename=pol.tbl
                      AND policyname=pol.name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s TO %s %s',
        pol.name, pol.tbl, pol.cmd, pol.roles,
        CASE WHEN pol.check_expr IS NOT NULL
             THEN 'WITH CHECK (' || pol.check_expr || ')'
             ELSE 'USING (' || pol.using_expr || ')' END
      );
    END IF;
  END LOOP;
END $$;

-- ─── 4. Bootstrap do primeiro admin ─────────────────────────────────────────
-- Sem isto ninguém consegue aprovar ninguém (o /admin exige um admin).
-- Diferente da migration original do Lovable, aqui NÃO se cria usuário nem se
-- define senha em código: o usuário precisa já existir em auth.users (cadastre
-- normalmente pela tela /signup antes de rodar, se ainda não existir).
DO $$
DECLARE
  v_email text := 'flavio.junior@tailorexec.com.br';
  v_uid   uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'Usuário % não existe em auth.users — bootstrap do admin ignorado. Cadastre-o em /signup e rode este bloco de novo.', v_email;
    RETURN;
  END IF;

  -- Perfil aprovado (não cria a linha: o trigger já cuidou disso)
  UPDATE public.profiles SET status = 'approved' WHERE id = v_uid;

  -- Papel de admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles
                  WHERE user_id = v_uid AND role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin');
  END IF;

  -- Admin do NPS
  INSERT INTO public.nps_access (user_id, status) VALUES (v_uid, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET status = 'admin';

  RAISE NOTICE 'Admin configurado para % (%)', v_email, v_uid;
END $$;
