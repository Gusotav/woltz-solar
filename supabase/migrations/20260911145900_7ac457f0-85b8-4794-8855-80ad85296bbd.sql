ALTER TYPE public.lead_stage ADD VALUE IF NOT EXISTS 'primeiro_contato' BEFORE 'orcamento';

CREATE TABLE public.responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;
GRANT ALL ON public.responsaveis TO service_role;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM members manage responsaveis" ON public.responsaveis FOR ALL TO authenticated
  USING (public.is_crm_member(auth.uid())) WITH CHECK (public.is_crm_member(auth.uid()));
CREATE TRIGGER update_responsaveis_updated_at BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.motivos_perda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motivo text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_perda TO authenticated;
GRANT ALL ON public.motivos_perda TO service_role;
ALTER TABLE public.motivos_perda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM members manage motivos_perda" ON public.motivos_perda FOR ALL TO authenticated
  USING (public.is_crm_member(auth.uid())) WITH CHECK (public.is_crm_member(auth.uid()));
CREATE TRIGGER update_motivos_perda_updated_at BEFORE UPDATE ON public.motivos_perda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.motivos_perda (motivo) VALUES
  ('Preço acima do orçamento'),
  ('Fechou com concorrente'),
  ('Sem retorno do cliente'),
  ('Fora da região de atendimento'),
  ('Prazo incompatível'),
  ('Desistiu da instalação'),
  ('Lead sem perfil'),
  ('Outro');

ALTER TABLE public.leads ADD COLUMN responsavel_id uuid REFERENCES public.responsaveis(id) ON DELETE SET NULL;
CREATE INDEX idx_leads_responsavel ON public.leads(responsavel_id);

CREATE TABLE public.lead_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  due_at timestamptz,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tarefas TO authenticated;
GRANT ALL ON public.lead_tarefas TO service_role;
ALTER TABLE public.lead_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM members manage lead_tarefas" ON public.lead_tarefas FOR ALL TO authenticated
  USING (public.is_crm_member(auth.uid())) WITH CHECK (public.is_crm_member(auth.uid()));
CREATE TRIGGER update_lead_tarefas_updated_at BEFORE UPDATE ON public.lead_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_lead_tarefas_lead ON public.lead_tarefas(lead_id);
CREATE INDEX idx_lead_tarefas_due ON public.lead_tarefas(due_at);