import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useLeadExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startExtraction = useCallback(async (keyword: string, location: string, apiProvider: 'apify' | 'mock' = 'apify', maxResults: number = 50) => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setIsExtracting(true);

    try {
      const { data, error } = await supabase.functions.invoke('extract-leads', {
        body: {
          keyword,
          location,
          sessionId: newSessionId,
          apiProvider,
          maxResults
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Extração concluída! ${data.leadsCount} leads encontrados.`);
      } else {
        toast.error('Erro na extração: ' + data.error);
      }

      return data;
    } catch (err: any) {
      console.error('Extraction error:', err);
      toast.error('Erro ao iniciar extração: ' + err.message);
      throw err;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  return { isExtracting, sessionId, startExtraction };
}
