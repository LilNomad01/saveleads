-- Phone Lookup / SMS eligibility fields
-- Adds persistent Twilio Lookup results to Google Maps leads.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_line_type TEXT,
  ADD COLUMN IF NOT EXISTS phone_carrier TEXT,
  ADD COLUMN IF NOT EXISTS phone_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS phone_lookup_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS phone_lookup_error TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS leads_phone_lookup_status_idx
  ON public.leads (phone_lookup_status);

CREATE INDEX IF NOT EXISTS leads_phone_line_type_idx
  ON public.leads (phone_line_type);
