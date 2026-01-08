import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { PerformanceChart } from "@/components/analytics/PerformanceChart";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { Map, Users, Phone, TrendingUp, Loader2 } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useMemo } from "react";

export default function Analytics() {
  const { leads, isLoading: leadsLoading, getStats } = useLeads();

  const stats = useMemo(() => getStats(), [getStats]);

  const chartData = useMemo(() => {
    return stats.leadsByDay.map(day => ({
      date: day.date,
      leads: day.leads,
      messages: 0,
      delivered: 0
    }));
  }, [stats.leadsByDay]);

  const recentActivities = useMemo(() => {
    return leads.slice(0, 8).map(lead => ({
      id: lead.id,
      phone: lead.whatsapp_numero ? `+${lead.whatsapp_numero}` : lead.telefone_original || '',
      company: lead.nome_empresa,
      status: 'pending' as 'delivered' | 'sent' | 'pending' | 'failed',
      timestamp: formatTimeAgo(new Date(lead.created_at))
    }));
  }, [leads]);

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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Analytics</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho das suas extrações
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Leads"
            value={stats.totalLeads}
            description="todos os leads extraídos"
            icon={Map}
            variant="navy"
          />
          <StatCard
            title="Leads com Telefone"
            value={stats.leadsWithPhone}
            description="com WhatsApp válido"
            icon={Phone}
            trend={stats.totalLeads > 0 ? { value: Math.round((stats.leadsWithPhone / stats.totalLeads) * 100), isPositive: true } : undefined}
          />
          <StatCard
            title="Novos Esta Semana"
            value={stats.leadsThisWeek}
            description="últimos 7 dias"
            icon={Users}
            variant="accent"
          />
          <StatCard
            title="Taxa de Telefones"
            value={stats.totalLeads > 0 ? `${Math.round((stats.leadsWithPhone / stats.totalLeads) * 100)}%` : "0%"}
            description="leads qualificados"
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