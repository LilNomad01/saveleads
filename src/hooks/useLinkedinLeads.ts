import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface LinkedinLead {
  id: string;
  nome: string;
  cargo: string | null;
  empresa: string | null;
  localizacao: string | null;
  perfil_url: string | null;
  email: string | null;
  telefone: string | null;
  setor: string | null;
  conexoes: number | null;
  descricao: string | null;
  fonte: string | null;
  data_extracao: string;
  created_at: string;
  user_id: string | null;
}

export function useLinkedinLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LinkedinLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('linkedin_leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching linkedin leads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const deleteLeads = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return false;
    try {
      const { error } = await supabase.from('linkedin_leads').delete().in('id', ids).eq('user_id', user.id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      return true;
    } catch { return false; }
  }, [user]);

  useEffect(() => { if (user) fetchLeads(); }, [user, fetchLeads]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('linkedin-leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'linkedin_leads', filter: `user_id=eq.${user.id}` }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLeads]);

  return { leads, isLoading, deleteLeads, refetch: fetchLeads };
}
