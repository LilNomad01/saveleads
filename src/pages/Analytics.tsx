import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { PerformanceChart } from "@/components/analytics/PerformanceChart";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { Map, Users, Send, TrendingUp, Loader2 } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMemo } from "react";

export default function Analytics() {
  const { leads, isLoading: leadsLoading, getStats } = useLeads();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();

  const stats = useMemo(() => getStats(), [getStats]);
  
  const campaignStats = useMemo(() => {
    const totalSent = campaigns.reduce((acc, c) => acc + (c.total_enviados || 0), 0);
    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.total_entregues || 0), 0);
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    return { totalSent, totalDelivered, deliveryRate };
  }, [campaigns]);

  const chartData = useMemo(() => {
    return stats.leadsByDay.map(day => ({
      date: day.date,
      leads: day.leads,
      messages: Math.floor(day.leads * 0.8), // Placeholder until we track messages by day
      delivered: Math.floor(day.leads * 0.75)
    }));
  }, [stats.leadsByDay]);

  const recentActivities = useMemo(() => {
    return leads.slice(0, 8).map(lead => ({
      id: lead.id,
      phone: lead.whatsapp_numero ? `+${lead.whatsapp_numero}` : lead.telefone_original || '',
      company: lead.nome_empresa,
      status: (lead.status === 'entregue' ? 'delivered' : 
               lead.status === 'enviado' ? 'sent' :
               lead.status === 'falhou' ? 'failed' : 'pending') as 'delivered' | 'sent' | 'pending' | 'failed',
      timestamp: formatTimeAgo(new Date(lead.created_at))
    }));
  }, [leads]);

  const isLoading = leadsLoading || campaignsLoading;

  if (isLoading) {
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Analytics</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho das suas campanhas
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Leads Extraídos"
            value={stats.totalLeads}
            description="últimos 7 dias"
            icon={Map}
            trend={stats.leadsThisWeek > 0 ? { value: stats.leadsThisWeek, isPositive: true } : undefined}
            variant="navy"
          />
          <StatCard
            title="Leads Qualificados"
            value={stats.leadsWithPhone}
            description="com telefone válido"
            icon={Users}
            trend={stats.leadsWithPhone > 0 ? { value: Math.round((stats.leadsWithPhone / Math.max(stats.totalLeads, 1)) * 100), isPositive: true } : undefined}
          />
          <StatCard
            title="Mensagens Enviadas"
            value={campaignStats.totalSent}
            description="via WhatsApp"
            icon={Send}
            variant="accent"
          />
          <StatCard
            title="Taxa de Entrega"
            value={`${campaignStats.deliveryRate.toFixed(1)}%`}
            description="mensagens entregues"
            icon={TrendingUp}
          />
        </div>

        {/* Chart and Activity */}
        <div className="grid gap-6 lg:grid-cols-3">
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
