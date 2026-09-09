-- ============================================================================
-- Separa a permissão do hub da permissão de autor do blog
--
-- PROBLEMA: profiles.status era usado pelos dois sistemas com significados
-- diferentes. No site (Dashboard) significa "autor aprovado do blog":
--
--   from("profiles").update({status:"approved"})   -- "Conta aprovada como autor."
--   from("profiles").update({status:"rejected"})   -- "Conta reprovada."
--
-- No hub significava "pode usar o gerador de currículo". Na prática, aprovar
-- alguém para escrever um post dava acesso a uma ferramenta que processa
-- currículos de candidatos, e vice-versa — elevação de privilégio.
--
-- SOLUÇÃO: o hub passa a ter a própria coluna. `status` volta a ser exclusiva
-- do site; nenhuma linha dele é reescrita.
-- ============================================================================

-- Enum próprio do hub (o site usa text livre em `status`, não é afetado)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_status') THEN
    CREATE TYPE public.profile_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_status public.profile_status NOT NULL DEFAULT 'pending';

-- Preserva quem já usava o hub: copia o status atual uma única vez, só nas
-- linhas que ainda estão no default. Assim você e a Taynara não perdem acesso.
UPDATE public.profiles
   SET hub_status = CASE
         WHEN status = 'approved' THEN 'approved'::public.profile_status
         WHEN status = 'rejected' THEN 'rejected'::public.profile_status
         ELSE 'pending'::public.profile_status
       END
 WHERE hub_status = 'pending'
   AND status IS NOT NULL;

-- Devolve profiles.status ao site: o DEFAULT 'pending' que a migration anterior
-- forçou existia só para proteger o acesso do hub. Agora que o hub tem coluna
-- própria, a coluna do site volta a ser decisão do site.
--
-- Nota: o site já tem fluxo de aprovação de autor no Dashboard, então cadastros
-- novos continuam precisando de aprovação lá — a proteção não se perde.
ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;

-- hub_status NÃO é concedida ao anon: a migration anterior revogou o SELECT de
-- tabela e concedeu coluna a coluna, então colunas novas já nascem invisíveis
-- para o anon. O site não precisa dela. O papel `authenticated` mantém o SELECT
-- de tabela, que é como o próprio hub lê.

COMMENT ON COLUMN public.profiles.status IS
  'Do SITE: aprovação de autor do blog. Não usar no hub.';
COMMENT ON COLUMN public.profiles.hub_status IS
  'Do HUB: libera o gerador de currículo quando = approved. Não usar no site.';
