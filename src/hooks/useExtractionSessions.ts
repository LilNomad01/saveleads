import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ExtractionSession {
  id: string;
  extraction_number: number;
  user_id: string;
  query: string;
  location: string | null;
  source: string;
  search_type: string | null;
  api_provider: string | null;
  website_filter: string | null;
  requested_max_results: number | null;
  leads_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useExtractionSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ExtractionSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }

    setIsLoading(true);

    try {
      const PAGE_SIZE = 500;
      const all: ExtractionSession[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('extraction_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const page = (data || []) as ExtractionSession[];
        all.push(...page);

        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
        if (from >= 10000) break;
      }

      setSessions(all);
    } catch (error) {
      console.error('Error loading extraction sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    refetch: fetchSessions,
  };
}
