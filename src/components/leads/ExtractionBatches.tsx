import { useMemo } from 'react';
import { CalendarDays, CheckCircle2, Filter, Layers3, Loader2, MapPin, Search, Smartphone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead } from '@/hooks/useLeads';
import { ExtractionSession } from '@/hooks/useExtractionSessions';
import { cn } from '@/lib/utils';

interface ExtractionBatchesProps {
  sessions: ExtractionSession[];
  leads: Lead[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onShowAll: () => void;
  isLoading?: boolean;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExtractionBatches({
  sessions,
  leads,
  selectedSessionId,
  onSelectSession,
  onShowAll,
  isLoading = false,
}: ExtractionBatchesProps) {
  const statsBySession = useMemo(() => {
    const map = new Map<string, { loaded: number; mobile: number; verified: number }>();

    for (const lead of leads) {
      if (!lead.extraction_session_id) continue;

      const current = map.get(lead.extraction_session_id) || {
        loaded: 0,
        mobile: 0,
        verified: 0,
      };

      current.loaded += 1;

      if (lead.phone_lookup_status === 'verified') {
        current.verified += 1;
      }

      if (
        lead.phone_lookup_status === 'verified' &&
        lead.phone_valid === true &&
        lead.phone_line_type === 'mobile'
      ) {
        current.mobile += 1;
      }

      map.set(lead.extraction_session_id, current);
    }

    return map;
  }, [leads]);

  const legacyCount = useMemo(
    () => leads.filter((lead) => !lead.extraction_session_id).length,
    [leads]
  );

  const googleMapsSessions = sessions.filter((session) => session.source === 'google_maps');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5" />
              Extrações identificadas
            </CardTitle>
            <CardDescription>
              Cada busca vira um lote numerado. Abra um lote para trabalhar somente com os leads daquela extração.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={selectedSessionId ? 'outline' : 'default'}
            size="sm"
            onClick={onShowAll}
          >
            <Filter className="h-4 w-4" />
            Todos os leads ({leads.length})
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando extrações...
          </div>
        ) : googleMapsSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            As próximas extrações do Google Maps aparecerão aqui automaticamente com número, busca, cidade e data.
          </div>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {googleMapsSessions.map((session, index) => {
              const stats = statsBySession.get(session.id) || {
                loaded: 0,
                mobile: 0,
                verified: 0,
              };
              const selected = selectedSessionId === session.id;
              const running = session.status === 'running';
              const failed = session.status === 'error';

              return (
                <div
                  key={session.id}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-background'
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selected ? 'default' : 'secondary'}>
                          Extração #{session.extraction_number}
                        </Badge>
                        {index === 0 && <Badge variant="outline">Mais recente</Badge>}
                        {running ? (
                          <Badge variant="outline" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Em andamento
                          </Badge>
                        ) : failed ? (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Erro
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Concluída
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Search className="h-3.5 w-3.5 text-muted-foreground" />
                          {session.query}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {session.location || 'Sem localização'}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(session.started_at)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">
                          {stats.loaded || session.leads_count} leads no lote
                        </Badge>
                        <Badge variant="outline">
                          {stats.verified} verificados
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Smartphone className="h-3 w-3" />
                          {stats.mobile} móveis
                        </Badge>
                        {session.requested_max_results && (
                          <Badge variant="outline">
                            solicitado: {session.requested_max_results}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => onSelectSession(session.id)}
                      disabled={running || failed}
                      className="shrink-0"
                    >
                      <Filter className="h-4 w-4" />
                      {selected ? 'Lote aberto' : 'Ver leads deste lote'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {legacyCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {legacyCount} lead(s) antigos foram extraídos antes da identificação por lote. Eles continuam disponíveis em “Todos os leads”.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
