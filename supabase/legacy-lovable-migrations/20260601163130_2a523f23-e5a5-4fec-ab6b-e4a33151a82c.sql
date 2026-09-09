
-- Enum for NPS access status
CREATE TYPE public.nps_role AS ENUM ('pending','approved','rejected','admin');

-- Table for storing NPS form responses (public submissions)
CREATE TABLE public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  consultor text,
  contratado boolean NOT NULL,
  nps_score smallint NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  entendimento smallint CHECK (entendimento BETWEEN 1 AND 7),
  atendimento smallint CHECK (atendimento BETWEEN 1 AND 7),
  projeto smallint CHECK (projeto BETWEEN 1 AND 7),
  comentarios text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.nps_responses TO anon, authenticated;
GRANT SELECT ON public.nps_responses TO authenticated;
GRANT ALL ON public.nps_responses TO service_role;

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

-- Table tracking per-user access to NPS app
CREATE TABLE public.nps_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status public.nps_role NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_access TO authenticated;
GRANT ALL ON public.nps_access TO service_role;

ALTER TABLE public.nps_access ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_nps_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nps_access WHERE user_id = _uid AND status = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_nps_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nps_access WHERE user_id = _uid AND status IN ('approved','admin'))
$$;

-- RLS policies for nps_responses
CREATE POLICY "Anyone can submit NPS"
  ON public.nps_responses FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "NPS access users can view responses"
  ON public.nps_responses FOR SELECT TO authenticated
  USING (public.has_nps_access(auth.uid()));

CREATE POLICY "NPS admins can delete responses"
  ON public.nps_responses FOR DELETE TO authenticated
  USING (public.is_nps_admin(auth.uid()));

-- RLS policies for nps_access
CREATE POLICY "Users view own nps_access"
  ON public.nps_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pending request"
  ON public.nps_access FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "NPS admin views all access"
  ON public.nps_access FOR SELECT TO authenticated
  USING (public.is_nps_admin(auth.uid()));

CREATE POLICY "NPS admin updates access"
  ON public.nps_access FOR UPDATE TO authenticated
  USING (public.is_nps_admin(auth.uid()));

CREATE POLICY "NPS admin deletes access"
  ON public.nps_access FOR DELETE TO authenticated
  USING (public.is_nps_admin(auth.uid()));

-- Seed Flavio as initial NPS admin
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'flavio.junior@tailorexec.com.br';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'flavio.junior@tailorexec.com.br', crypt('<SENHA REMOVIDA - VER HISTORICO>', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Flavio Junior"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      created_at, updated_at, last_sign_in_at
    ) VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'flavio.junior@tailorexec.com.br'),
      'email', v_uid::text, now(), now(), now()
    );
  END IF;

  -- Ensure approved profile for Flavio (handle_new_user trigger creates it pending)
  UPDATE public.profiles SET status = 'approved' WHERE id = v_uid;

  INSERT INTO public.nps_access (user_id, status) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET status = 'admin';
END $$;
