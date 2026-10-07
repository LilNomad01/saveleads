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
  cidade: string | null;
  extraction_session_id: string | null;
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
  mensagem_enviada: boolean | null;
  data_mensagem_enviada: string | null;
  phone_line_type: string | null;
  phone_carrier: string | null;
  phone_valid: boolean | null;
  phone_lookup_status: string;
  phone_lookup_error: string | null;
  phone_lookup_provider: string | null;
  phone_verified_at: string | null;
}

export interface LeadsStats {
  totalLeads: number;
  leadsWithPhone: number;
  leadsThisWeek: number;
  messagesSent: number;
  messagesThisWeek: number;
  leadsByDay: { date: string; leads: number; messages: number }[];
}

export function useLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingPhones, setIsVerifyingPhones] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Supabase/PostgREST commonly limits a single response to 1,000 rows.
      // Load in pages so leads from older extractions never disappear from the frontend.
      const PAGE_SIZE = 1000;
      const allLeads: Lead[] = [];
      let from = 0;

      while (true) {
        const { data, error: fetchError } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (fetchError) throw fetchError;

        const page = (data || []) as Lead[];
        allLeads.push(...page);

        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;

        // Safety guard: supports up to 100,000 leads in one account load.
        if (from >= 100000) break;
      }

      // Defensive de-duplication by database id in case rows change while pages load.
      const uniqueLeads = Array.from(
        new Map(allLeads.map((lead) => [lead.id, lead])).values()
      );

      setLeads(uniqueLeads);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching leads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const deleteLeads = useCallback(async (leadIds: string[]) => {
    if (!user || leadIds.length === 0) return false;

    const uniqueIds = Array.from(new Set(leadIds));
    const CHUNK_SIZE = 100;
    const deletedIds = new Set<string>();

    try {
      for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
        const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);

        const { error: deleteError } = await supabase
          .from('leads')
          .delete()
          .in('id', chunk)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        chunk.forEach((id) => deletedIds.add(id));

        if (uniqueIds.length > CHUNK_SIZE && (i / CHUNK_SIZE) % 5 === 4) {
          toast.info(`Excluindo leads... ${Math.min(i + CHUNK_SIZE, uniqueIds.length)}/${uniqueIds.length}`);
        }
      }

      setLeads(prev => prev.filter(lead => !deletedIds.has(lead.id)));
      toast.success(`${deletedIds.size} lead(s) excluído(s) com sucesso!`);
      return true;
    } catch (err: any) {
      // Reflect successful chunks immediately even if a later chunk fails.
      if (deletedIds.size > 0) {
        setLeads(prev => prev.filter(lead => !deletedIds.has(lead.id)));
      }
      toast.error(
        `Erro ao excluir leads após ${deletedIds.size}/${uniqueIds.length}: ${err.message}`
      );
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

  const markMessageSent = useCallback(async (leadId: string) => {
    if (!user) return false;
    
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          mensagem_enviada: true, 
          data_mensagem_enviada: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', leadId)
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;
      
      setLeads(prev => prev.map(lead => 
        lead.id === leadId ? { 
          ...lead, 
          mensagem_enviada: true, 
          data_mensagem_enviada: new Date().toISOString() 
        } : lead
      ));
      return true;
    } catch (err: any) {
      console.error('Error marking message sent:', err);
      return false;
    }
  }, [user]);

  const verifyPhoneNumbers = useCallback(async (leadIds: string[]) => {
    if (!user || leadIds.length === 0) return false;

    const uniqueIds = Array.from(new Set(leadIds));
    const chunks: string[][] = [];
    // Edge Function accepts up to 50 IDs; use the full batch size so
    // verifying thousands of selected leads needs fewer requests.
    for (let i = 0; i < uniqueIds.length; i += 50) {
      chunks.push(uniqueIds.slice(i, i + 50));
    }

    setIsVerifyingPhones(true);

    let mobile = 0;
    let landline = 0;
    let voip = 0;
    let invalid = 0;
    let errors = 0;
    let localOnly = 0;
    let veriphone = 0;
    let ambiguous = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        const { data, error: invokeError } = await supabase.functions.invoke('verify-phone-numbers', {
          body: { leadIds: chunks[i] },
        });

        if (invokeError) throw invokeError;
        if (!data?.success) throw new Error(data?.error || 'Falha ao verificar telefones');

        mobile += Number(data?.summary?.mobile || 0);
        landline += Number(data?.summary?.landline || 0);
        voip += Number(data?.summary?.voip || 0);
        invalid += Number(data?.summary?.invalid || 0);
        errors += Number(data?.summary?.errors || 0);
        localOnly += Number(data?.summary?.localOnly || 0);
        veriphone += Number(data?.summary?.veriphone || 0);
        ambiguous += Number(data?.summary?.ambiguous || 0);

        if (chunks.length > 1 && (i === 0 || (i + 1) % 5 === 0 || i === chunks.length - 1)) {
          toast.info(`Verificação: ${Math.min((i + 1) * 50, uniqueIds.length)}/${uniqueIds.length} números processados`);
        }
      }

      await fetchLeads();

      const providerText = veriphone > 0
        ? `${veriphone} via Veriphone grátis`
        : `${localOnly} via libphonenumber local`;

      toast.success(
        `Verificação grátis concluída: ${mobile} móveis, ${landline} fixos, ${voip} VoIP, ${invalid} inválidos${ambiguous ? `, ${ambiguous} tipos incertos` : ''}${errors ? `, ${errors} erros` : ''}. ${providerText}.`
      );
      return true;
    } catch (err: any) {
      console.error('Error verifying phone numbers:', err);
      toast.error(err?.message || 'Erro ao verificar telefones');
      return false;
    } finally {
      setIsVerifyingPhones(false);
    }
  }, [user, fetchLeads]);

  const getStats = useCallback((): LeadsStats => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const leadsThisWeek = leads.filter(l => new Date(l.created_at) >= weekAgo);
    const messagesSent = leads.filter(l => l.mensagem_enviada).length;
    const messagesThisWeek = leads.filter(l => 
      l.mensagem_enviada && l.data_mensagem_enviada && new Date(l.data_mensagem_enviada) >= weekAgo
    ).length;
    
    // Group by day
    const dayMap: Record<string, { leads: number; messages: number }> = {};
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { leads: 0, messages: 0 };
    }
    
    leadsThisWeek.forEach(l => {
      const key = l.created_at.split('T')[0];
      if (dayMap[key] !== undefined) {
        dayMap[key].leads++;
      }
    });

    // Count messages by day they were sent
    leads.forEach(l => {
      if (l.mensagem_enviada && l.data_mensagem_enviada) {
        const key = l.data_mensagem_enviada.split('T')[0];
        if (dayMap[key] !== undefined) {
          dayMap[key].messages++;
        }
      }
    });
    
    const leadsByDay = Object.entries(dayMap).map(([date, counts]) => {
      const d = new Date(date);
      return { date: dayNames[d.getDay()], leads: counts.leads, messages: counts.messages };
    });

    return {
      totalLeads: leads.length,
      leadsWithPhone: leads.filter(l => l.whatsapp_numero).length,
      leadsThisWeek: leadsThisWeek.length,
      messagesSent,
      messagesThisWeek,
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
            // Avoid duplicates when realtime INSERT arrives while a paginated refetch is running.
            setLeads(prev => {
              const inserted = payload.new as Lead;
              return prev.some(lead => lead.id === inserted.id)
                ? prev.map(lead => lead.id === inserted.id ? inserted : lead)
                : [inserted, ...prev];
            });
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
    markMessageSent,
    getStats,
    extractPhoneNumbers,
    verifyPhoneNumbers,
    isVerifyingPhones
  };
}
