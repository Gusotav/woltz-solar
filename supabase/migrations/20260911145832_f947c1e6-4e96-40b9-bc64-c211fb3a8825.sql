CREATE TYPE public.investimento_faixa AS ENUM ('ate_5k','5k_15k','15k_30k','30k_50k','acima_50k');
CREATE TYPE public.lead_stage AS ENUM ('novos','atendimento','orcamento','vendas');
CREATE TYPE public.lead_status AS ENUM ('aberto','ganho','abandonado');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  cidade text,
  tipo_esquadria text[] NOT NULL DEFAULT '{}'::text[],
  investimento public.investimento_faixa,
  investimento_valor numeric,
  mensagem text,
  stage public.lead_stage NOT NULL DEFAULT 'novos',
  status public.lead_status NOT NULL DEFAULT 'aberto',
  quality_score smallint,
  motivo_perda text,
  fechado_em timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_page text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert leads" ON public.leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);
CREATE INDEX leads_fechado_em_idx ON public.leads (fechado_em);

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_notes_lead_id_idx ON public.lead_notes(lead_id, created_at DESC);

CREATE TABLE public.lead_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.lead_notes(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_attachments TO authenticated;
GRANT ALL ON public.lead_attachments TO service_role;
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_attachments_lead_id_idx ON public.lead_attachments(lead_id, created_at DESC);
CREATE INDEX lead_attachments_note_id_idx ON public.lead_attachments(note_id);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS email text;

CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_crm_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
$$;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CRM members can select leads"
ON public.leads FOR SELECT TO authenticated
USING (public.is_crm_member(auth.uid()));

CREATE POLICY "CRM members can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (public.is_crm_member(auth.uid()))
WITH CHECK (public.is_crm_member(auth.uid()));

CREATE POLICY "Only admins can delete leads"
ON public.leads FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CRM members read lead_notes" ON public.lead_notes FOR SELECT TO authenticated
USING (public.is_crm_member(auth.uid()));
CREATE POLICY "CRM members insert lead_notes" ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (public.is_crm_member(auth.uid()));
CREATE POLICY "CRM members update lead_notes" ON public.lead_notes FOR UPDATE TO authenticated
USING (public.is_crm_member(auth.uid())) WITH CHECK (public.is_crm_member(auth.uid()));
CREATE POLICY "Only admins delete lead_notes" ON public.lead_notes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CRM members read lead_attachments" ON public.lead_attachments FOR SELECT TO authenticated
USING (public.is_crm_member(auth.uid()));
CREATE POLICY "CRM members insert lead_attachments" ON public.lead_attachments FOR INSERT TO authenticated
WITH CHECK (public.is_crm_member(auth.uid()));
CREATE POLICY "CRM members update lead_attachments" ON public.lead_attachments FOR UPDATE TO authenticated
USING (public.is_crm_member(auth.uid())) WITH CHECK (public.is_crm_member(auth.uid()));
CREATE POLICY "Only admins delete lead_attachments" ON public.lead_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CRM members read lead attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lead-attachments' AND public.is_crm_member(auth.uid()));

CREATE POLICY "CRM members upload lead attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lead-attachments' AND public.is_crm_member(auth.uid()));

CREATE POLICY "CRM members update lead attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lead-attachments' AND public.is_crm_member(auth.uid()))
WITH CHECK (bucket_id = 'lead-attachments' AND public.is_crm_member(auth.uid()));

CREATE POLICY "CRM members delete lead attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lead-attachments' AND public.is_crm_member(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_crm_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_crm_member(uuid) TO authenticated, service_role;

CREATE TYPE public.estagio_obra AS ENUM ('planejamento', 'execucao', 'finalizacao');
ALTER TABLE public.leads ADD COLUMN estagio_obra public.estagio_obra DEFAULT 'planejamento'::public.estagio_obra;