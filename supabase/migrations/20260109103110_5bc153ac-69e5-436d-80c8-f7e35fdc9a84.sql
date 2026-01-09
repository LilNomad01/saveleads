-- Add column to track WhatsApp message sent status
ALTER TABLE public.leads 
ADD COLUMN mensagem_enviada boolean DEFAULT false,
ADD COLUMN data_mensagem_enviada timestamp with time zone;

-- Create index for faster queries on message status
CREATE INDEX idx_leads_mensagem_enviada ON public.leads(mensagem_enviada) WHERE mensagem_enviada = true;