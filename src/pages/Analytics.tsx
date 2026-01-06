import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { PerformanceChart } from "@/components/analytics/PerformanceChart";
import { ActivityFeed } from "@/components/analytics/ActivityFeed";
import { Map, Users, Send, TrendingUp } from "lucide-react";

const chartData = [
  { date: "Seg", leads: 45, messages: 32, delivered: 30 },
  { date: "Ter", leads: 52, messages: 48, delivered: 45 },
  { date: "Qua", leads: 38, messages: 35, delivered: 33 },
  { date: "Qui", leads: 65, messages: 58, delivered: 55 },
  { date: "Sex", leads: 72, messages: 65, delivered: 62 },
  { date: "Sáb", leads: 28, messages: 22, delivered: 20 },
  { date: "Dom", leads: 15, messages: 12, delivered: 11 },
];

const recentActivities = [
  {
    id: "1",
    phone: "+55 11 98765-4321",
    company: "Pizzaria Bella Napoli",
    status: "delivered" as const,
    timestamp: "há 2 min",
  },
  {
    id: "2",
    phone: "+55 11 99876-5432",
    company: "Restaurante Don Carlo",
    status: "sent" as const,
    timestamp: "há 5 min",
  },
  {
    id: "3",
    phone: "+55 11 97654-3210",
    company: "Lanchonete Express",
    status: "delivered" as const,
    timestamp: "há 8 min",
  },
  {
    id: "4",
    phone: "+55 11 96543-2109",
    company: "Café Central",
    status: "failed" as const,
    timestamp: "há 12 min",
  },
  {
    id: "5",
    phone: "+55 11 95432-1098",
    company: "Padaria São Paulo",
    status: "delivered" as const,
    timestamp: "há 15 min",
  },
  {
    id: "6",
    phone: "+55 11 94321-0987",
    company: "Doceria Artesanal",
    status: "pending" as const,
    timestamp: "há 20 min",
  },
  {
    id: "7",
    phone: "+55 11 93210-9876",
    company: "Hamburgueria Prime",
    status: "delivered" as const,
    timestamp: "há 25 min",
  },
  {
    id: "8",
    phone: "+55 11 92109-8765",
    company: "Sushi House",
    status: "delivered" as const,
    timestamp: "há 30 min",
  },
];

export default function Analytics() {
  const totalLeads = 315;
  const qualifiedLeads = 287;
  const messagesSent = 272;
  const deliveryRate = 94.5;

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
            value={totalLeads}
            description="últimos 7 dias"
            icon={Map}
            trend={{ value: 23, isPositive: true }}
            variant="navy"
          />
          <StatCard
            title="Leads Qualificados"
            value={qualifiedLeads}
            description="com telefone válido"
            icon={Users}
            trend={{ value: 18, isPositive: true }}
          />
          <StatCard
            title="Mensagens Enviadas"
            value={messagesSent}
            description="via WhatsApp"
            icon={Send}
            trend={{ value: 15, isPositive: true }}
            variant="accent"
          />
          <StatCard
            title="Taxa de Entrega"
            value={`${deliveryRate}%`}
            description="mensagens entregues"
            icon={TrendingUp}
            trend={{ value: 2.3, isPositive: true }}
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
