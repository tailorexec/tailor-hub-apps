-- ============================================================================
-- CORREÇÃO URGENTE: cadastro novo estava quebrado
--
-- A migration 20260909130000 fez:
--     ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
--
-- O raciocínio era devolver `status` ao site, já que o hub passou a usar
-- `hub_status`. Mas `status` é NOT NULL e a handle_new_user() do site insere
-- apenas (id, full_name, avatar_url) — sem informar status. Sem DEFAULT, todo
-- signup passou a falhar com:
--
--     23502: null value in column "status" of relation "profiles"
--            violates not-null constraint
--
-- O erro acontece dentro do trigger, então a transação inteira reverte e nem o
-- usuário em auth.users é criado — o cadastro simplesmente não funciona.
--
-- Aqui o DEFAULT volta. Fica 'pending' (e não o 'approved' original) porque o
-- Dashboard do site tem fluxo de aprovação de autor — "Conta aprovada como
-- autor" / "Conta reprovada" — então nascer pendente é o comportamento
-- coerente, e a direção da falha é negar acesso em vez de conceder.
--
-- Se o site precisar que novos cadastros já nasçam aprovados como autor, basta
-- trocar 'pending' por 'approved' abaixo.
-- ============================================================================

ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

-- Rede de segurança: se alguma linha ficou com status nulo (não deveria haver,
-- porque a constraint impede), normaliza antes que algo mais tropece nela.
UPDATE public.profiles SET status = 'pending' WHERE status IS NULL;

DO $$
DECLARE
  v_default text;
BEGIN
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status';

  IF v_default IS NULL THEN
    RAISE EXCEPTION 'profiles.status continua sem DEFAULT — o cadastro seguiria quebrado';
  END IF;

  RAISE NOTICE 'profiles.status DEFAULT restaurado: %', v_default;
END $$;
