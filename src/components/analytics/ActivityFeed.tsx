import { Phone, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  phone: string;
  company: string;
  status: "sent" | "delivered" | "failed" | "pending";
  timestamp: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const statusConfig = {
  sent: {
    icon: Clock,
    label: "Enviado",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  delivered: {
    icon: CheckCircle2,
    label: "Entregue",
    color: "text-success",
    bg: "bg-success/10",
  },
  failed: {
    icon: XCircle,
    label: "Falhou",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  pending: {
    icon: Clock,
    label: "Pendente",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-card rounded-xl shadow-card border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Atividade Recente</h3>
        <p className="text-sm text-muted-foreground">
          Últimas mensagens enviadas
        </p>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhuma atividade recente</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            const status = statusConfig[activity.status];
            const StatusIcon = status.icon;
            return (
              <div
                key={activity.id}
                className="p-4 hover:bg-muted/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", status.bg)}>
                    <StatusIcon className={cn("h-4 w-4", status.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">
                        {activity.company}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {activity.timestamp}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {activity.phone}
                      </code>
                      <span
                        className={cn("text-xs font-medium", status.color)}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
