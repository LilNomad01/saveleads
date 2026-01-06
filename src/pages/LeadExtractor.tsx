import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeadSearchForm } from "@/components/leads/LeadSearchForm";
import { LeadsTableReal } from "@/components/leads/LeadsTableReal";
import { ExtractionConsole } from "@/components/leads/ExtractionConsole";
import { StatCard } from "@/components/ui/stat-card";
import { Map, Building2, CheckCircle2, Phone, MessageSquare, Send } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useLeadExtraction } from "@/hooks/useLeadExtraction";
import { useExtractionLogs } from "@/hooks/useExtractionLogs";
import { Badge } from "@/components/ui/badge";

export default function LeadExtractor() {
  const { leads, isLoading: isLoadingLeads } = useLeads();
  const { isExtracting, sessionId, startExtraction } = useLeadExtraction();
  const { logs } = useExtractionLogs(sessionId);
  const [sessionLeadsCount, setSessionLeadsCount] = useState(0);

  const handleSearch = async (keyword: string, location: string, apiProvider: 'apify' | 'mock', maxResults: number) => {
    const previousCount = leads.length;
    await startExtraction(keyword, location, apiProvider, maxResults);
    // The count will update via real-time subscription
    setTimeout(() => {
      setSessionLeadsCount(leads.length - previousCount);
    }, 2000);
  };

  const totalLeads = leads.length;
  const leadsWithPhone = leads.filter((l) => l.whatsapp_numero).length;
  const validatedLeads = leads.filter((l) => l.status === 'validado').length;
  const sentLeads = leads.filter((l) => l.status === 'enviado' || l.status === 'entregue').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Extrator de Leads B2B</h1>
            <p className="text-muted-foreground">
              Extraia leads reais do Google Maps usando a API Apify
            </p>
          </div>
          {isExtracting && (
            <Badge variant="outline" className="animate-pulse bg-primary/10 text-primary border-primary">
              <span className="mr-2 h-2 w-2 rounded-full bg-primary animate-ping" />
              Extração em andamento...
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total de Leads"
            value={totalLeads}
            description="no banco de dados"
            icon={Map}
            variant="navy"
          />
          <StatCard
            title="Com WhatsApp"
            value={leadsWithPhone}
            description="números válidos"
            icon={Phone}
            trend={totalLeads > 0 ? { value: Math.round((leadsWithPhone / totalLeads) * 100), isPositive: true } : undefined}
            variant="accent"
          />
          <StatCard
            title="Validados"
            value={validatedLeads}
            description="prontos para envio"
            icon={CheckCircle2}
          />
          <StatCard
            title="Já Enviados"
            value={sentLeads}
            description="mensagens disparadas"
            icon={Send}
          />
          <StatCard
            title="Nesta Sessão"
            value={sessionLeadsCount}
            description="leads extraídos agora"
            icon={Building2}
            variant="success"
          />
        </div>

        {/* Search Form */}
        <LeadSearchForm onSearch={handleSearch} isLoading={isExtracting} />

        {/* Extraction Console */}
        <ExtractionConsole logs={logs} isExtracting={isExtracting} />

        {/* Results Table */}
        <LeadsTableReal leads={leads} isLoading={isLoadingLeads} />
      </div>
    </DashboardLayout>
  );
}
