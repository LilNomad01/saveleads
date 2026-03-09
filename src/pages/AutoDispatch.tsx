import { useState, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeads } from "@/hooks/useLeads";
import { useProfile } from "@/hooks/useProfile";
import { useAutomationQueue } from "@/hooks/useAutomationQueue";
import { toast } from "sonner";
import {
  Workflow,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  List,
  Zap,
  ExternalLink,
} from "lucide-react";

type SourceFilter = 'all' | 'google_maps' | 'telegram' | 'google_reviews';

export default function AutoDispatch() {
  const { leads } = useLeads();
  const { profile } = useProfile();
  const { queue, isLoading: queueLoading, sendToAutomation, stats } = useAutomationQueue();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [isSending, setIsSending] = useState(false);

  const webhookUrl = profile?.n8n_webhook_url;

  // Filter leads not yet queued
  const queuedLeadIds = useMemo(() => new Set(queue.map(q => q.lead_id)), [queue]);

  const availableLeads = useMemo(() => {
    let filtered = leads.filter(l => !queuedLeadIds.has(l.id));
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(l => {
        if (sourceFilter === 'google_maps') return l.fonte === 'google_maps' || l.fonte === 'apify';
        return l.fonte === sourceFilter;
      });
    }
    return filtered;
  }, [leads, queuedLeadIds, sourceFilter]);

  const handleSendAll = useCallback(async () => {
    if (!webhookUrl) {
      toast.error('Configure o Webhook N8N URL em Configurações antes de enviar.');
      return;
    }
    if (availableLeads.length === 0) {
      toast.warning('Nenhum lead disponível para enviar.');
      return;
    }

    setIsSending(true);
    try {
      await sendToAutomation(availableLeads, webhookUrl);
      toast.success(`${availableLeads.length} leads enviados para automação!`);
    } catch {
      toast.error('Erro ao enviar leads para automação.');
    } finally {
      setIsSending(false);
    }
  }, [availableLeads, webhookUrl, sendToAutomation]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Workflow className="h-6 w-6 text-primary" />
              Fila de Automação
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Envie leads para automação N8N via webhook
            </p>
          </div>
          {!webhookUrl && (
            <Badge variant="destructive" className="self-start sm:self-auto gap-1">
              <AlertTriangle className="h-3 w-3" />
              Webhook N8N não configurado
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <List className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Disponíveis</span>
              </div>
              <p className="text-2xl font-bold">{availableLeads.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
              </div>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Enviados</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground">Erros</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.error}</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fontes</SelectItem>
                  <SelectItem value="google_maps">🗺️ Google Maps</SelectItem>
                  <SelectItem value="telegram">✈️ Telegram</SelectItem>
                  <SelectItem value="google_reviews">⭐ Google Reviews</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button
                onClick={handleSendAll}
                disabled={isSending || availableLeads.length === 0 || !webhookUrl}
                className="w-full sm:w-auto"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar {availableLeads.length} leads para automação
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Queue Log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              Logs de Automação
            </CardTitle>
            <CardDescription>Histórico de envios para N8N</CardDescription>
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : queue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Workflow className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum envio registrado ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.status === 'sent' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : item.status === 'error' ? (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {(item.lead_data as any)?.nome_empresa || 'Lead'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(item.lead_data as any)?.telefone || (item.lead_data as any)?.whatsapp_numero || '—'}
                            {item.fonte && ` • ${item.fonte}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={item.status === 'sent' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {item.status === 'sent' ? 'Enviado' : item.status === 'error' ? 'Erro' : 'Pendente'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
