DROP TABLE IF EXISTS public.lead_attachments CASCADE;
DROP TABLE IF EXISTS public.lead_notes CASCADE;
DROP TABLE IF EXISTS public.lead_tarefas CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.motivos_perda CASCADE;
DROP TABLE IF EXISTS public.responsaveis CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

DROP FUNCTION IF EXISTS public.is_crm_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

DROP TYPE IF EXISTS public.investimento_faixa CASCADE;
DROP TYPE IF EXISTS public.estagio_obra CASCADE;
DROP TYPE IF EXISTS public.lead_stage CASCADE;
DROP TYPE IF EXISTS public.lead_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;