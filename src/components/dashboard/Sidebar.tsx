import {
  LayoutDashboard,
  Calendar,
  Upload,
  Activity,
  LogOut,
  BookOpen,
  ClipboardList,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Wallet,
  UserCheck,
  Megaphone,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navItems = [
  { id: "overview", label: "Panel Principal", icon: LayoutDashboard },
  { id: "historico", label: "Citas y Servicios", icon: Calendar },
  { id: "contabilidad", label: "Contabilidad y Beneficios", icon: Wallet },
  { id: "equipo", label: "Análisis de Equipo", icon: UserCheck },
  { id: "pacientes", label: "Control de Pacientes", icon: Users },
  { id: "aiconsejos", label: "Análisis y Consejos con IA", icon: Brain },
  { id: "marketing", label: "Marketing y Control de Campañas", icon: Megaphone },
  { id: "upload", label: "Importar Datos", icon: Upload },
  { id: "documentacion", label: "Documentación", icon: BookOpen },
];

export function Sidebar({ activeSection, onSectionChange, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente.",
    });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "hidden md:flex min-h-screen bg-sidebar flex-col transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className="h-[76px] px-4 flex items-center border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              <img 
                src="https://i.ibb.co/KzqnVbP0/freepik-0001-1-removebg-preview.png" 
                alt="Marbellafisio Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-sidebar-foreground text-lg">Marbellafisio</h1>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <div className="px-3 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expandir menú" : "Minimizar menú"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "nav-item w-full text-left",
                    collapsed && "justify-center px-2",
                    activeSection === item.id && "nav-item-active"
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-3">
          {user && !collapsed && (
            <div className="text-xs text-sidebar-foreground/70 truncate px-2">
              {user.email}
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "px-0"
                )}
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="ml-2">Cerrar Sesión</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">Cerrar Sesión</TooltipContent>
            )}
          </Tooltip>
          {!collapsed && (
            <p className="text-xs text-sidebar-foreground/50 text-center">
              © 2026 CliniQube
            </p>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
