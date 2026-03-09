import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { PerformanceChart } from "@/components/analytics/PerformanceChart";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { Database, Phone, TrendingUp, Loader2, Workflow, BarChart3 } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useAutomationQueue } from "@/hooks/useAutomationQueue";
import { useMemo } from "react";
import { isWhatsAppCompatible } from "@/lib/phoneUtils";

export default function Analytics() {
  const { leads, isLoading: leadsLoading, getStats } = useLeads();
  const { stats: queueStats } = useAutomationQueue();

  const stats = useMemo(() => getStats(), [getStats]);

  const chartData = useMemo(() => {
    return stats.leadsByDay.map(day => ({
      date: day.date,
      leads: day.leads,
      messages: day.messages,
      delivered: day.messages
    }));
  }, [stats.leadsByDay]);

  const recentActivities = useMemo(() => {
    const sortedLeads = [...leads].sort((a, b) => {
      const dateA = a.data_mensagem_enviada || a.created_at;
      const dateB = b.data_mensagem_enviada || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return sortedLeads.slice(0, 8).map(lead => ({
      id: lead.id,
      phone: lead.whatsapp_numero ? `+${lead.whatsapp_numero}` : lead.telefone_original || '',
      company: lead.nome_empresa,
      status: lead.mensagem_enviada ? 'sent' as const : 'pending' as const,
      timestamp: formatTimeAgo(new Date(lead.data_mensagem_enviada || lead.created_at))
    }));
  }, [leads]);

  const mobileLeadsCount = useMemo(() => 
    leads.filter(l => isWhatsAppCompatible(l.whatsapp_numero)).length
  , [leads]);

  // Source breakdown
  const sourceStats = useMemo(() => ({
    googleMaps: leads.filter(l => l.fonte === 'google_maps' || l.fonte === 'apify').length,
    telegram: leads.filter(l => l.fonte === 'telegram').length,
    reviews: leads.filter(l => l.fonte === 'google_reviews').length,
  }), [leads]);

  if (leadsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Visão geral de todas as fontes de dados
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            title="Total Leads"
            value={stats.totalLeads}
            description="todas as fontes"
            icon={Database}
            variant="navy"
          />
          <StatCard
            title="Google Maps"
            value={sourceStats.googleMaps}
            description="leads"
            icon={Database}
          />
          <StatCard
            title="Telegram"
            value={sourceStats.telegram}
            description="grupos/usuários"
            icon={Database}
          />
          <StatCard
            title="Com Telefone"
            value={mobileLeadsCount}
            description="válidos"
            icon={Phone}
            variant="accent"
          />
          <StatCard
            title="Automação"
            value={queueStats.sent}
            description={`${queueStats.pending} pendentes`}
            icon={Workflow}
          />
          <StatCard
            title="Taxa Sucesso"
            value={queueStats.sent + queueStats.error > 0 
              ? `${Math.round((queueStats.sent / (queueStats.sent + queueStats.error)) * 100)}%` 
              : "—"}
            description="webhook N8N"
            icon={TrendingUp}
          />
        </div>

        {/* Chart and Activity */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <PerformanceChart data={chartData} className="lg:col-span-2" />
          <ActivityFeed activities={recentActivities} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${diffDays}d`;
}
