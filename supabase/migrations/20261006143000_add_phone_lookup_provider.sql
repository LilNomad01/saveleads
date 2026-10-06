ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_lookup_provider TEXT;
