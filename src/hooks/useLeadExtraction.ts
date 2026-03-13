import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export function useLeadExtraction() {
  const { user } = useAuth();
  const [isExtracting, setIsExtracting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startExtraction = useCallback(async (
    keyword: string,
    location: string,
    apiProvider: 'apify' | 'mock' = 'apify',
    maxResults: number = 100,
    source: string = 'google_maps',
    searchType: string = 'empresas'
  ) => {
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
          maxResults,
          userId: user?.id,
          source,
          searchType
        }
      });

      // supabase.functions.invoke throws FunctionsHttpError for non-2xx
      // But since we now return 200 always, error should be null
      if (error) {
        // Try to parse the error body for a real message
        const errorBody = typeof error === 'object' && 'context' in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        const msg = errorBody?.error || error.message || 'Erro desconhecido na Edge Function';
        toast.error(msg);
        return { success: false, error: msg };
      }

      if (data?.success) {
        toast.success(`Extração concluída! ${data.leadsCount} resultados encontrados.`);
      } else {
        // Edge function returned 200 but success: false
        const errorMsg = data?.error || 'Erro desconhecido na extração';
        const details = data?.details ? ` (${data.details})` : '';
        toast.error(errorMsg + details);
      }

      return data;
    } catch (err: any) {
      console.error('Extraction error:', err);
      const msg = err?.message || 'Erro ao iniciar extração';
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsExtracting(false);
    }
  }, [user]);

  return { isExtracting, sessionId, startExtraction };
}
