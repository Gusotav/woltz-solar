ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS kommo_lead_id BIGINT,
  ADD COLUMN IF NOT EXISTS kommo_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS kommo_error TEXT,
  ADD COLUMN IF NOT EXISTS kommo_sent_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.kommo_field_map (
  field_key TEXT PRIMARY KEY,
  field_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.kommo_field_map TO service_role;

ALTER TABLE public.kommo_field_map ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_kommo_field_map_updated_at
BEFORE UPDATE ON public.kommo_field_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();