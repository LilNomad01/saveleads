
CREATE TABLE public.linkedin_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  nome text NOT NULL,
  cargo text,
  empresa text,
  localizacao text,
  perfil_url text,
  email text,
  telefone text,
  setor text,
  conexoes integer,
  descricao text,
  fonte text DEFAULT 'linkedin',
  data_extracao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert linkedin_leads" ON public.linkedin_leads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public select linkedin_leads" ON public.linkedin_leads FOR SELECT TO public USING (true);
CREATE POLICY "Users can delete own linkedin_leads" ON public.linkedin_leads FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own linkedin_leads" ON public.linkedin_leads FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own linkedin_leads" ON public.linkedin_leads FOR SELECT TO public USING (auth.uid() = user_id);
