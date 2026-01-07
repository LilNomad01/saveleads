import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface MessageBlock {
  id: string;
  content: string;
  delay: number;
  image?: string;
}

export interface Campaign {
  id: string;
  nome: string;
  mensagens: MessageBlock[];
  status: string | null;
  delay_min: number | null;
  delay_max: number | null;
  total_enviados: number | null;
  total_entregues: number | null;
  total_falhas: number | null;
  created_at: string;
  updated_at: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('campanhas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      const parsedCampaigns: Campaign[] = (data || []).map(c => ({
        ...c,
        mensagens: parseMessages(c.mensagens)
      }));
      
      setCampaigns(parsedCampaigns);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching campaigns:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCampaign = useCallback(async (
    nome: string, 
    mensagens: MessageBlock[], 
    delayMin: number = 15, 
    delayMax: number = 40
  ): Promise<Campaign | null> => {
    try {
      const { data, error: insertError } = await supabase
        .from('campanhas')
        .insert({
          nome,
          mensagens: mensagens as unknown as Json,
          delay_min: delayMin,
          delay_max: delayMax,
          status: 'rascunho'
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      const newCampaign: Campaign = {
        ...data,
        mensagens: parseMessages(data.mensagens)
      };
      
      setCampaigns(prev => [newCampaign, ...prev]);
      toast.success('Campanha criada com sucesso!');
      return newCampaign;
    } catch (err: any) {
      toast.error('Erro ao criar campanha: ' + err.message);
      return null;
    }
  }, []);

  const updateCampaign = useCallback(async (
    id: string, 
    updates: Partial<Omit<Campaign, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.mensagens) {
        updateData.mensagens = updates.mensagens as unknown as Json;
      }
      
      const { error: updateError } = await supabase
        .from('campanhas')
        .update(updateData)
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      setCampaigns(prev => prev.map(c => 
        c.id === id ? { ...c, ...updates } : c
      ));
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar campanha: ' + err.message);
      return false;
    }
  }, []);

  const updateCampaignStats = useCallback(async (
    id: string, 
    enviados: number, 
    entregues: number, 
    falhas: number
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('campanhas')
        .update({
          total_enviados: enviados,
          total_entregues: entregues,
          total_falhas: falhas
        })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      setCampaigns(prev => prev.map(c => 
        c.id === id ? { 
          ...c, 
          total_enviados: enviados, 
          total_entregues: entregues, 
          total_falhas: falhas 
        } : c
      ));
      return true;
    } catch (err: any) {
      console.error('Error updating campaign stats:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { 
    campaigns, 
    isLoading, 
    error, 
    refetch: fetchCampaigns,
    createCampaign,
    updateCampaign,
    updateCampaignStats
  };
}

function parseMessages(mensagens: Json): MessageBlock[] {
  if (Array.isArray(mensagens)) {
    return mensagens.map((m: any) => ({
      id: m.id || `msg-${Date.now()}`,
      content: m.content || '',
      delay: m.delay || 5,
      image: m.image
    }));
  }
  return [];
}
