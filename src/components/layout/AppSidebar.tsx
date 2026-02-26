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
  Menu,
  X,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  {
    title: "Extrator de Leads",
    description: "Google Maps",
    icon: Map,
    path: "/app",
  },
  {
    title: "Exportar WhatsApp",
    description: "Enviar Manual",
    icon: MessageCircle,
    path: "/whatsapp-export",
  },
  {
    title: "Disparo Automático",
    description: "Envio em Massa",
    icon: Send,
    path: "/auto-dispatch",
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  // Close mobile menu when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Header Bar */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <h1 className="text-base font-bold text-sidebar-foreground">LeadFlow</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>
      )}

      {/* Mobile Overlay */}
      {isMobile && mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
          isMobile 
            ? cn(
                "w-72 top-14 h-[calc(100vh-3.5rem)]",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )
            : cn(
                collapsed ? "w-20" : "w-64"
              )
        )}
      >
        {/* Logo - Desktop Only */}
        {!isMobile && (
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
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
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
                {(!collapsed || isMobile) && (
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

        {/* Collapse Toggle - Desktop Only */}
        {!isMobile && (
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
        )}
      </aside>
    </>
  );
}
