ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS veriphone_api_key TEXT;
