import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExtractionLog {
  id: string;
  session_id: string;
  tipo: 'info' | 'success' | 'error' | 'warning';
  mensagem: string;
  dados: Record<string, any> | null;
  created_at: string;
}

export function useExtractionLogs(sessionId: string | null) {
  const [logs, setLogs] = useState<ExtractionLog[]>([]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLogs([]);
      return;
    }

    // Fetch existing logs for this session
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('extraction_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setLogs(data as ExtractionLog[]);
      }
    };

    fetchLogs();

    // Subscribe to realtime updates for this session
    const channel = supabase
      .channel(`logs-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'extraction_logs',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          setLogs(prev => [...prev, payload.new as ExtractionLog]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { logs, clearLogs };
}
