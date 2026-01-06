import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Lead {
  id: string;
  nome_empresa: string;
  whatsapp_numero: string | null;
  telefone_original: string | null;
  site: string | null;
  endereco: string | null;
  categoria: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  status: string | null;
  fonte: string | null;
  data_extracao: string;
  data_disparo: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      setLeads(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching leads:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(lead => 
              lead.id === (payload.new as Lead).id ? payload.new as Lead : lead
            ));
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(lead => lead.id !== (payload.old as Lead).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  return { leads, isLoading, error, refetch: fetchLeads };
}
