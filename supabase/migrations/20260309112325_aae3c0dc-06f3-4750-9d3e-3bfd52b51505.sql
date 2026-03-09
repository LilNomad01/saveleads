
-- Tabela telegram_leads
CREATE TABLE public.telegram_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  nome TEXT NOT NULL,
  username TEXT,
  link TEXT,
  membros INTEGER,
  descricao TEXT,
  categoria TEXT,
  fonte TEXT DEFAULT 'telegram',
  tipo TEXT DEFAULT 'grupo',
  data_extracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram_leads" ON public.telegram_leads FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own telegram_leads" ON public.telegram_leads FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own telegram_leads" ON public.telegram_leads FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Public insert telegram_leads" ON public.telegram_leads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public select telegram_leads" ON public.telegram_leads FOR SELECT TO public USING (true);

-- Tabela reviews_negativos
CREATE TABLE public.reviews_negativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  empresa TEXT NOT NULL,
  telefone TEXT,
  website TEXT,
  endereco TEXT,
  cidade TEXT,
  rating_medio NUMERIC,
  total_reviews INTEGER,
  review TEXT,
  rating NUMERIC,
  autor TEXT,
  data_review TIMESTAMP WITH TIME ZONE,
  fonte TEXT DEFAULT 'google_reviews',
  data_extracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews_negativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reviews_negativos" ON public.reviews_negativos FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews_negativos" ON public.reviews_negativos FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews_negativos" ON public.reviews_negativos FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Public insert reviews_negativos" ON public.reviews_negativos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public select reviews_negativos" ON public.reviews_negativos FOR SELECT TO public USING (true);

-- Tabela automation_queue
CREATE TABLE public.automation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  lead_id UUID,
  lead_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  erro TEXT,
  fonte TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation_queue" ON public.automation_queue FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own automation_queue" ON public.automation_queue FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automation_queue" ON public.automation_queue FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automation_queue" ON public.automation_queue FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Public insert automation_queue" ON public.automation_queue FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public select automation_queue" ON public.automation_queue FOR SELECT TO public USING (true);
CREATE POLICY "Public update automation_queue" ON public.automation_queue FOR UPDATE TO public USING (true);

-- Adicionar campo webhook_url ao profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;

-- Adicionar campos extras à tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;
