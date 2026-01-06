-- Tabela de leads extraídos do Google Maps
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa TEXT NOT NULL,
  whatsapp_numero TEXT,
  telefone_original TEXT,
  site TEXT,
  endereco TEXT,
  categoria TEXT,
  avaliacao DECIMAL(2,1),
  total_avaliacoes INTEGER,
  status TEXT DEFAULT 'extraido' CHECK (status IN ('extraido', 'validado', 'enviado', 'entregue', 'falhou')),
  fonte TEXT DEFAULT 'google_maps',
  data_extracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_disparo TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de campanhas de disparo
CREATE TABLE public.campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagens JSONB NOT NULL DEFAULT '[]',
  delay_min INTEGER DEFAULT 15,
  delay_max INTEGER DEFAULT 40,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluida')),
  total_enviados INTEGER DEFAULT 0,
  total_entregues INTEGER DEFAULT 0,
  total_falhas INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de extração (feedback em tempo real)
CREATE TABLE public.extraction_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('info', 'success', 'error', 'warning')),
  mensagem TEXT NOT NULL,
  dados JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_logs ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para MVP (ajustar para autenticação depois)
CREATE POLICY "Leads são públicos para leitura" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Leads podem ser inseridos" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Leads podem ser atualizados" ON public.leads FOR UPDATE USING (true);

CREATE POLICY "Campanhas são públicas para leitura" ON public.campanhas FOR SELECT USING (true);
CREATE POLICY "Campanhas podem ser inseridas" ON public.campanhas FOR INSERT WITH CHECK (true);
CREATE POLICY "Campanhas podem ser atualizadas" ON public.campanhas FOR UPDATE USING (true);

CREATE POLICY "Logs são públicos para leitura" ON public.extraction_logs FOR SELECT USING (true);
CREATE POLICY "Logs podem ser inseridos" ON public.extraction_logs FOR INSERT WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campanhas_updated_at
  BEFORE UPDATE ON public.campanhas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para logs (feedback em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.extraction_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;