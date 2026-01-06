import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { LeadSearchForm } from "@/components/leads/LeadSearchForm";
import { LeadsTable, Lead } from "@/components/leads/LeadsTable";
import { StatCard } from "@/components/ui/stat-card";
import { Map, Building2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

// Mock data for demonstration
const mockLeads: Lead[] = [
  {
    id: "1",
    company: "Pizzaria Bella Napoli",
    phone: "+55 11 98765-4321",
    website: "https://bellanapolipizza.com.br",
    status: "extracted",
  },
  {
    id: "2",
    company: "Pizzaria Don Corleone",
    phone: "+55 11 99876-5432",
    website: "https://doncorleone.com.br",
    status: "extracted",
  },
  {
    id: "3",
    company: "Pizza Express SP",
    phone: "+55 11 97654-3210",
    website: "https://pizzaexpresssp.com.br",
    status: "pending",
  },
  {
    id: "4",
    company: "Forneria São Paulo",
    phone: "+55 11 96543-2109",
    website: "https://forneria-sp.com.br",
    status: "extracted",
  },
  {
    id: "5",
    company: "La Pizza Artesanal",
    phone: "+55 11 95432-1098",
    website: "https://lapizzaartesanal.com.br",
    status: "error",
  },
];

export default function LeadExtractor() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (keyword: string, location: string) => {
    setIsLoading(true);
    setLeads([]);

    // Simulate API call with progressive loading
    for (let i = 0; i < mockLeads.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLeads((prev) => [...prev, { ...mockLeads[i], id: `${Date.now()}-${i}` }]);
    }

    setIsLoading(false);
    toast.success(`${mockLeads.length} leads extraídos para "${keyword}" em ${location}`);
  };

  const handleExport = (selectedIds: string[]) => {
    toast.success(`${selectedIds.length} leads exportados para Excel`);
  };

  const handleSendToCampaign = (selectedIds: string[]) => {
    toast.success(`${selectedIds.length} leads enviados para campanha de disparo`);
  };

  const extractedCount = leads.filter((l) => l.status === "extracted").length;
  const pendingCount = leads.filter((l) => l.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extrator de Leads</h1>
          <p className="text-muted-foreground">
            Extraia leads qualificados do Google Maps
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Extraído"
            value={leads.length}
            description="leads nesta sessão"
            icon={Map}
            variant="navy"
          />
          <StatCard
            title="Empresas Encontradas"
            value={extractedCount}
            description="dados completos"
            icon={Building2}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Qualificados"
            value={extractedCount}
            description="com telefone válido"
            icon={CheckCircle2}
            variant="accent"
          />
          <StatCard
            title="Em Processamento"
            value={pendingCount}
            description="aguardando extração"
            icon={Clock}
          />
        </div>

        {/* Search Form */}
        <LeadSearchForm onSearch={handleSearch} isLoading={isLoading} />

        {/* Results Table */}
        <LeadsTable
          leads={leads}
          onExport={handleExport}
          onSendToCampaign={handleSendToCampaign}
        />
      </div>
    </DashboardLayout>
  );
}
