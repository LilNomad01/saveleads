ALTER TABLE public.extraction_sessions
  ADD COLUMN IF NOT EXISTS apify_run_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS apify_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_input JSONB,
  ADD COLUMN IF NOT EXISTS apify_tried_key_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS extraction_sessions_apify_run_id_idx
  ON public.extraction_sessions (apify_run_id);
