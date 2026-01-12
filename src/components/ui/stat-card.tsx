import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "accent" | "navy" | "success";
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const variants = {
    default: "bg-card border border-border",
    accent: "bg-accent text-accent-foreground",
    navy: "bg-navy text-white",
    success: "bg-success text-white",
  };

  const iconVariants = {
    default: "bg-primary/10 text-primary",
    accent: "bg-white/20 text-white",
    navy: "bg-white/20 text-white",
    success: "bg-white/20 text-white",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 sm:p-6 shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up",
        variants[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <p
            className={cn(
              "text-xs sm:text-sm font-medium truncate",
              variant === "default" ? "text-muted-foreground" : "opacity-80"
            )}
          >
            {title}
          </p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{value}</p>
          {description && (
            <p
              className={cn(
                "text-[10px] sm:text-xs truncate",
                variant === "default" ? "text-muted-foreground" : "opacity-70"
              )}
            >
              {description}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                "text-[10px] sm:text-xs font-medium flex items-center gap-1",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              <span className="opacity-60 hidden sm:inline">vs. semana anterior</span>
            </p>
          )}
        </div>
        <div className={cn("p-2 sm:p-3 rounded-xl shrink-0", iconVariants[variant])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}
