-- ============================================================================
-- Tailor Hub — NPS liberado para toda conta aprovada no hub
-- Projeto: tailor-site (xxltytblimzhcyqlvikx) — banco COMPARTILHADO com o site.
--
-- O hub passou a ter uma porta só: login com a conta aprovada (profiles.
-- hub_status = 'approved') libera todos os aplicativos. O NPS tinha uma
-- aprovação própria em nps_access; quem já tinha continua tendo, e agora
-- qualquer conta aprovada no hub também tem.
--
-- is_nps_admin (apagar respostas, gerir nps_access) NÃO muda.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_nps_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.nps_access
                  WHERE user_id = _uid AND status IN ('approved','admin'))
      OR EXISTS (SELECT 1 FROM public.profiles
                  WHERE id = _uid AND hub_status = 'approved')
$$;
