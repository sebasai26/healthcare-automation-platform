import { useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Upload,
  Activity,
  LogOut,
  Menu,
  X,
  BookOpen,
  ClipboardList,
  Users,
  Wallet,
  UserCheck,
  Megaphone,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MobileSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
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

export function MobileSidebar({ activeSection, onSectionChange }: MobileSidebarProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente.",
    });
    setOpen(false);
  };

  const handleSectionChange = (section: string) => {
    onSectionChange(section);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full bg-sidebar">
          {/* Logo */}
          <div className="h-[76px] px-6 flex items-center border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                <img 
                  src="https://i.ibb.co/KzqnVbP0/freepik-0001-1-removebg-preview.png" 
                  alt="Marbellafisio Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-bold text-foreground text-lg">Marbellafisio</h1>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={cn(
                  "nav-item w-full text-left",
                  activeSection === item.id && "nav-item-active"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Footer with user info and logout */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            {user && (
              <div className="text-xs text-muted-foreground truncate px-2">
                {user.email}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              © 2026 CliniQube
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
