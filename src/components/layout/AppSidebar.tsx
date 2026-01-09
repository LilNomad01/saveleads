import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Map,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Zap,
  Settings,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Extrator de Leads",
    description: "Google Maps",
    icon: Map,
    path: "/",
  },
  {
    title: "Exportar WhatsApp",
    description: "Enviar Mensagens",
    icon: MessageCircle,
    path: "/whatsapp-export",
  },
  {
    title: "Analytics",
    description: "Dashboard",
    icon: BarChart3,
    path: "/analytics",
  },
  {
    title: "Configurações",
    description: "Conta e API",
    icon: Settings,
    path: "/settings",
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
            <Zap className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold text-sidebar-foreground">LeadFlow</h1>
              <p className="text-xs text-sidebar-foreground/60">B2B Automation</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-200",
                  !isActive && "group-hover:scale-110"
                )}
              />
              {!collapsed && (
                <div className="animate-fade-in">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p
                    className={cn(
                      "text-xs",
                      isActive
                        ? "text-sidebar-primary-foreground/70"
                        : "text-sidebar-foreground/50"
                    )}
                  >
                    {item.description}
                  </p>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2">Recolher</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
