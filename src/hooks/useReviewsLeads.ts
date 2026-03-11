import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ReviewLead {
  id: string;
  empresa: string;
  telefone: string | null;
  website: string | null;
  endereco: string | null;
  cidade: string | null;
  rating: number | null;
  rating_medio: number | null;
  total_reviews: number | null;
  review: string | null;
  autor: string | null;
  data_review: string | null;
  fonte: string | null;
  data_extracao: string;
  created_at: string;
  user_id: string | null;
}

export function useReviewsLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<ReviewLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews_negativos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const deleteLeads = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return false;
    try {
      const { error } = await supabase.from('reviews_negativos').delete().in('id', ids).eq('user_id', user.id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      return true;
    } catch { return false; }
  }, [user]);

  useEffect(() => { if (user) fetchLeads(); }, [user, fetchLeads]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('reviews-leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews_negativos', filter: `user_id=eq.${user.id}` }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLeads]);

  return { leads, isLoading, deleteLeads, refetch: fetchLeads };
}
