import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeadSearchForm } from "@/components/leads/LeadSearchForm";
import { LeadsTableReal } from "@/components/leads/LeadsTableReal";
import { ExtractionConsole } from "@/components/leads/ExtractionConsole";
import { StatCard } from "@/components/ui/stat-card";
import { Map, Building2, CheckCircle2, Phone } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useLeadExtraction } from "@/hooks/useLeadExtraction";
import { useExtractionLogs } from "@/hooks/useExtractionLogs";

export default function LeadExtractor() {
  const { leads, isLoading: isLoadingLeads } = useLeads();
  const { isExtracting, sessionId, startExtraction } = useLeadExtraction();
  const { logs } = useExtractionLogs(sessionId);

  const handleSearch = async (keyword: string, location: string) => {
    await startExtraction(keyword, location);
  };

  const totalLeads = leads.length;
  const leadsWithPhone = leads.filter((l) => l.whatsapp_numero).length;
  const validatedLeads = leads.filter((l) => l.status === 'validado').length;
  const sentLeads = leads.filter((l) => l.status === 'enviado' || l.status === 'entregue').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extrator de Leads</h1>
          <p className="text-muted-foreground">
            Extraia leads qualificados do Google Maps em tempo real
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            icon={Building2}
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
