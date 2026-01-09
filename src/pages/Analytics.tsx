import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { PerformanceChart } from "@/components/analytics/PerformanceChart";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { Map, Users, Phone, TrendingUp, Loader2, MessageCircle, CheckCircle2 } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useMemo } from "react";
import { isWhatsAppCompatible } from "@/lib/phoneUtils";

export default function Analytics() {
  const { leads, isLoading: leadsLoading, getStats } = useLeads();

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
    // Sort by most recent activity (message sent or created)
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

  // Mobile leads count
  const mobileLeadsCount = useMemo(() => 
    leads.filter(l => isWhatsAppCompatible(l.whatsapp_numero)).length
  , [leads]);

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total de Leads"
            value={stats.totalLeads}
            description="todos os leads extraídos"
            icon={Map}
            variant="navy"
          />
          <StatCard
            title="WhatsApp Válidos"
            value={mobileLeadsCount}
            description="números móveis"
            icon={Phone}
            trend={stats.totalLeads > 0 ? { value: Math.round((mobileLeadsCount / stats.totalLeads) * 100), isPositive: true } : undefined}
          />
          <StatCard
            title="Mensagens Enviadas"
            value={stats.messagesSent}
            description="total enviadas"
            icon={MessageCircle}
            variant="accent"
          />
          <StatCard
            title="Enviadas Esta Semana"
            value={stats.messagesThisWeek}
            description="últimos 7 dias"
            icon={CheckCircle2}
          />
          <StatCard
            title="Taxa de Contato"
            value={mobileLeadsCount > 0 ? `${Math.round((stats.messagesSent / mobileLeadsCount) * 100)}%` : "0%"}
            description="leads contatados"
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