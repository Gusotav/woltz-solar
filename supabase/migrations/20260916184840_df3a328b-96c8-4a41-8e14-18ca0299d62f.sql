ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gad_source text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text;