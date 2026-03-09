import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeadSearchForm, DataSource, SearchType } from "@/components/leads/LeadSearchForm";
import { LeadsTableReal } from "@/components/leads/LeadsTableReal";
import { ExtractionConsole } from "@/components/leads/ExtractionConsole";
import { StatCard } from "@/components/ui/stat-card";
import { Database, Building2, CheckCircle2, Phone, Star } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useLeadExtraction } from "@/hooks/useLeadExtraction";
import { useExtractionLogs } from "@/hooks/useExtractionLogs";
import { Badge } from "@/components/ui/badge";

export default function LeadExtractor() {
  const { leads, isLoading: isLoadingLeads, deleteLeads, extractPhoneNumbers } = useLeads();
  const { isExtracting, sessionId, startExtraction } = useLeadExtraction();
  const { logs } = useExtractionLogs(sessionId);
  const [sessionLeadsCount, setSessionLeadsCount] = useState(0);

  const handleSearch = async (params: {
    source: DataSource;
    searchType: SearchType;
    query: string;
    location: string;
    maxResults: number;
    apiProvider: 'apify' | 'mock';
  }) => {
    const previousCount = leads.length;
    await startExtraction(
      params.query,
      params.location,
      params.apiProvider,
      params.maxResults,
      params.source,
      params.searchType
    );
    setTimeout(() => {
      setSessionLeadsCount(leads.length - previousCount);
    }, 2000);
  };

  const totalLeads = leads.length;
  const leadsWithPhone = leads.filter((l) => l.whatsapp_numero).length;
  const validatedLeads = leads.filter((l) => l.status === 'validado').length;

  // Leads by source
  const sourceBreakdown = {
    google_maps: leads.filter(l => l.fonte === 'google_maps' || l.fonte === 'apify').length,
    telegram: leads.filter(l => l.fonte === 'telegram').length,
    reviews: leads.filter(l => l.fonte === 'google_reviews').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Extração de Dados
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Extraia leads de múltiplas fontes: Google Maps, Telegram, Reviews
            </p>
          </div>
          {isExtracting && (
            <Badge variant="outline" className="animate-pulse bg-primary/10 text-primary border-primary self-start sm:self-auto">
              <span className="mr-2 h-2 w-2 rounded-full bg-primary animate-ping" />
              Extração em andamento...
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            title="Total de Leads"
            value={totalLeads}
            description="todas as fontes"
            icon={Database}
            variant="navy"
          />
          <StatCard
            title="Com Telefone"
            value={leadsWithPhone}
            description="números válidos"
            icon={Phone}
            trend={totalLeads > 0 ? { value: Math.round((leadsWithPhone / totalLeads) * 100), isPositive: true } : undefined}
            variant="accent"
          />
          <StatCard
            title="Validados"
            value={validatedLeads}
            description="prontos"
            icon={CheckCircle2}
          />
          <StatCard
            title="Google Maps"
            value={sourceBreakdown.google_maps}
            description="leads extraídos"
            icon={Building2}
          />
          <StatCard
            title="Nesta Sessão"
            value={sessionLeadsCount}
            description="extraídos agora"
            icon={Star}
            variant="success"
          />
        </div>

        {/* Search Form */}
        <LeadSearchForm onSearch={handleSearch} isLoading={isExtracting} />

        {/* Extraction Console */}
        <ExtractionConsole logs={logs} isExtracting={isExtracting} />

        {/* Results Table */}
        <LeadsTableReal 
          leads={leads} 
          isLoading={isLoadingLeads} 
          onDelete={deleteLeads}
          onExtractPhones={extractPhoneNumbers}
        />
      </div>
    </DashboardLayout>
  );
}
