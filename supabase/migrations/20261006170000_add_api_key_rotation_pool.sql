CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('apify', 'veriphone')),
  label TEXT,
  key_value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  disabled_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_user_provider_value_idx
  ON public.api_keys (user_id, provider, key_value);

CREATE INDEX IF NOT EXISTS api_keys_user_provider_active_idx
  ON public.api_keys (user_id, provider, is_active, priority, last_used_at);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
CREATE POLICY "Users can view own api keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own api keys" ON public.api_keys;
CREATE POLICY "Users can insert own api keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own api keys" ON public.api_keys;
CREATE POLICY "Users can update own api keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own api keys" ON public.api_keys;
CREATE POLICY "Users can delete own api keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Importa as chaves únicas antigas para o pool automaticamente.
INSERT INTO public.api_keys (user_id, provider, label, key_value, priority)
SELECT user_id, 'apify', 'Apify principal', trim(apify_api_token), 10
FROM public.profiles
WHERE apify_api_token IS NOT NULL AND trim(apify_api_token) <> ''
ON CONFLICT (user_id, provider, key_value) DO NOTHING;

INSERT INTO public.api_keys (user_id, provider, label, key_value, priority)
SELECT user_id, 'veriphone', 'Veriphone principal', trim(veriphone_api_key), 10
FROM public.profiles
WHERE veriphone_api_key IS NOT NULL AND trim(veriphone_api_key) <> ''
ON CONFLICT (user_id, provider, key_value) DO NOTHING;
