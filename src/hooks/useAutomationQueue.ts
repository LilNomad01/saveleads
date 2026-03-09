import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Lead } from './useLeads';

interface QueueItem {
  id: string;
  lead_id: string | null;
  lead_data: Record<string, any>;
  status: string;
  erro: string | null;
  fonte: string | null;
  created_at: string;
  sent_at: string | null;
}

export function useAutomationQueue() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      setQueue((data || []) as QueueItem[]);
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchQueue();
  }, [user, fetchQueue]);

  const stats = useMemo(() => ({
    pending: queue.filter(q => q.status === 'pending').length,
    sent: queue.filter(q => q.status === 'sent').length,
    error: queue.filter(q => q.status === 'error').length,
  }), [queue]);

  const sendToAutomation = useCallback(async (leads: Lead[], webhookUrl: string) => {
    if (!user) return;

    // Insert all to queue first
    const queueItems = leads.map(lead => ({
      user_id: user.id,
      lead_id: lead.id,
      lead_data: {
        nome_empresa: lead.nome_empresa,
        telefone: lead.whatsapp_numero || lead.telefone_original,
        cidade: lead.endereco,
        categoria: lead.categoria,
        fonte: lead.fonte,
        website: lead.site,
        rating: lead.avaliacao,
      },
      status: 'pending',
      fonte: lead.fonte,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('automation_queue')
      .insert(queueItems)
      .select();

    if (insertError) throw insertError;

    // Send webhook for each lead
    const results = await Promise.allSettled(
      leads.map(async (lead) => {
        const payload = {
          nome_empresa: lead.nome_empresa,
          telefone: lead.whatsapp_numero || lead.telefone_original,
          cidade: lead.endereco,
          categoria: lead.categoria,
          fonte: lead.fonte,
          website: lead.site,
          rating: lead.avaliacao,
        };

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`Webhook failed: ${res.status}`);
        return lead.id;
      })
    );

    // Update statuses
    const sentIds: string[] = [];
    const errorIds: string[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        sentIds.push(leads[i].id);
      } else {
        errorIds.push(leads[i].id);
      }
    });

    if (sentIds.length > 0 && inserted) {
      const sentQueueIds = (inserted as QueueItem[])
        .filter(q => sentIds.includes(q.lead_id || ''))
        .map(q => q.id);
      
      if (sentQueueIds.length > 0) {
        await supabase
          .from('automation_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .in('id', sentQueueIds);
      }
    }

    if (errorIds.length > 0 && inserted) {
      const errorQueueIds = (inserted as QueueItem[])
        .filter(q => errorIds.includes(q.lead_id || ''))
        .map(q => q.id);
      
      if (errorQueueIds.length > 0) {
        await supabase
          .from('automation_queue')
          .update({ status: 'error', erro: 'Webhook failed' })
          .in('id', errorQueueIds);
      }
    }

    await fetchQueue();
  }, [user, fetchQueue]);

  return { queue, isLoading, sendToAutomation, stats, refetch: fetchQueue };
}
