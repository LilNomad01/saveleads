import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

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
  user_id: string | null;
}

export interface LeadsStats {
  totalLeads: number;
  leadsWithPhone: number;
  leadsThisWeek: number;
  leadsByDay: { date: string; leads: number }[];
}

export function useLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      setLeads(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching leads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const deleteLeads = useCallback(async (leadIds: string[]) => {
    if (!user || leadIds.length === 0) return false;
    
    try {
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIds)
        .eq('user_id', user.id);
      
      if (deleteError) throw deleteError;
      
      setLeads(prev => prev.filter(lead => !leadIds.includes(lead.id)));
      toast.success(`${leadIds.length} lead(s) excluído(s) com sucesso!`);
      return true;
    } catch (err: any) {
      toast.error('Erro ao excluir leads: ' + err.message);
      return false;
    }
  }, [user]);

  const updateLeadStatus = useCallback(async (leadIds: string[], status: string) => {
    if (!user || leadIds.length === 0) return false;
    
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', leadIds)
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;
      
      setLeads(prev => prev.map(lead => 
        leadIds.includes(lead.id) ? { ...lead, status } : lead
      ));
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar leads: ' + err.message);
      return false;
    }
  }, [user]);

  const getStats = useCallback((): LeadsStats => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= weekAgo);
    
    // Group by day
    const dayMap: Record<string, number> = {};
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = 0;
    }
    
    leadsThisWeek.forEach(l => {
      const key = l.created_at.split('T')[0];
      if (dayMap[key] !== undefined) {
        dayMap[key]++;
      }
    });
    
    const leadsByDay = Object.entries(dayMap).map(([date, count]) => {
      const d = new Date(date);
      return { date: dayNames[d.getDay()], leads: count };
    });

    return {
      totalLeads: leads.length,
      leadsWithPhone: leads.filter(l => l.whatsapp_numero).length,
      leadsThisWeek: leadsThisWeek.length,
      leadsByDay
    };
  }, [leads]);

  const extractPhoneNumbers = useCallback((leadIds?: string[]): string[] => {
    const targetLeads = leadIds 
      ? leads.filter(l => leadIds.includes(l.id))
      : leads;
    
    return targetLeads
      .filter(l => l.whatsapp_numero)
      .map(l => l.whatsapp_numero as string);
  }, [leads]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user, fetchLeads]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${user.id}`
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
  }, [user]);

  return { 
    leads, 
    isLoading, 
    error, 
    refetch: fetchLeads, 
    deleteLeads, 
    updateLeadStatus,
    getStats,
    extractPhoneNumbers
  };
}
