import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type DataType = "citas" | "productividad" | "ingresos" | "servicios";

interface DeleteDataButtonProps {
  dataType: DataType;
  year: number;
  month?: string;
  week?: number;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function DeleteDataButton({ dataType, year, month, week }: DeleteDataButtonProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isWeekly = !!week;
  const isFullYear = !isWeekly && (!month || month === "all" || month === "-1" || month === "Todo el año");
  
  const getMonthInfo = (): { name?: string; number?: number } => {
    if (isFullYear || isWeekly) return {};
    
    // Si es un número (índice), convertir a nombre
    const monthIndex = parseInt(month || "");
    if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
      return { 
        name: MONTH_NAMES[monthIndex],
        number: monthIndex + 1
      };
    }
    
    // Ya es nombre, buscar índice
    const foundIndex = MONTH_NAMES.indexOf(month || "");
    return { 
      name: month,
      number: foundIndex !== -1 ? foundIndex + 1 : undefined
    };
  };

  const { name: monthName, number: monthNumber } = getMonthInfo();

  const getDataTypeLabel = () => {
    switch (dataType) {
      case "citas": return "citas";
      case "productividad": return "productividad (citas, horas, ocupación por profesional)";
      case "ingresos": return "ingresos (balance mensual y profesional)";
      case "servicios": return "servicios";
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      let errors: any[] = [];

      switch (dataType) {
        case "citas":
          if (isWeekly) {
            const { error } = await supabase.from("listado_citas").delete().eq("anio", year).eq("semana", week);
            if (error) errors.push(error);
          } else if (isFullYear) {
            const { error } = await supabase.from("listado_citas").delete().eq("anio", year);
            if (error) errors.push(error);
          } else {
            const { error } = await supabase.from("listado_citas").delete().eq("anio", year).eq("mes", monthName);
            if (error) errors.push(error);
          }
          break;

        case "productividad":
          // Estas tablas solo tienen datos anuales o mensuales por usuario
          const { error: e1 } = await supabase.from("citas_profesional").delete().eq("anio", year);
          const { error: e2 } = await supabase.from("horas_profesional").delete().eq("anio", year);
          const { error: e3 } = await supabase.from("ocupacion_profesional").delete().eq("anio", year);
          if (isFullYear) {
            const { error: e4 } = await supabase.from("balance_profesional").delete().eq("anio", year);
            if (e4) errors.push(e4);
          } else if (monthName) {
            const { error: e4 } = await supabase.from("balance_profesional").delete().eq("anio", year).eq("mes", monthName);
            if (e4) errors.push(e4);
          }
          if (e1) errors.push(e1);
          if (e2) errors.push(e2);
          if (e3) errors.push(e3);
          break;

        case "ingresos":
          if (isFullYear) {
            const { error: e1 } = await supabase.from("balance_mensual").delete().eq("anio", year);
            const { error: e2 } = await supabase.from("balance_profesional").delete().eq("anio", year);
            if (e1) errors.push(e1);
            if (e2) errors.push(e2);
          } else if (monthName) {
            const { error: e1 } = await supabase.from("balance_mensual").delete().eq("anio", year).eq("mes", monthName);
            const { error: e2 } = await supabase.from("balance_profesional").delete().eq("anio", year).eq("mes", monthName);
            if (e1) errors.push(e1);
            if (e2) errors.push(e2);
          }
          break;

        case "servicios":
          if (isFullYear) {
            const { error } = await supabase.from("analisis_servicios").delete().eq("anio", year);
            if (error) errors.push(error);
          } else {
            const { error } = await supabase.from("analisis_servicios").delete().eq("anio", year).eq("mes", monthNumber);
            if (error) errors.push(error);
          }
          break;
      }

      if (errors.length > 0) {
        console.error("Errors deleting data:", errors);
        toast.error("Error al eliminar algunos datos");
      } else {
        const periodSuccessText = isWeekly 
          ? `semana ${week} de ${year}`
          : isFullYear ? `año ${year}` : `${monthName} ${year}`;
        
        toast.success(`Datos de ${getDataTypeLabel()} de ${periodSuccessText} eliminados`);
        
        // Invalidar queries relacionadas según el tipo de datos
        switch (dataType) {
          case "citas":
            queryClient.invalidateQueries({ queryKey: ["controlCitas"] });
            queryClient.invalidateQueries({ queryKey: ["controlCitasFiltros"] });
            queryClient.invalidateQueries({ queryKey: ["controlCitasMensuales"] });
            queryClient.invalidateQueries({ queryKey: ["overviewData"] });
            break;
          case "productividad":
            queryClient.invalidateQueries({ queryKey: ["productividadEquipo"] });
            queryClient.invalidateQueries({ queryKey: ["overviewData"] });
            break;
          case "ingresos":
            queryClient.invalidateQueries({ queryKey: ["ingresos"] });
            queryClient.invalidateQueries({ queryKey: ["ingresosHistorial"] });
            queryClient.invalidateQueries({ queryKey: ["ingresosAniosDisponibles"] });
            queryClient.invalidateQueries({ queryKey: ["overviewData"] });
            break;
          case "servicios":
            queryClient.invalidateQueries({ queryKey: ["servicios"] });
            queryClient.invalidateQueries({ queryKey: ["serviciosPeriodos"] });
            break;
        }
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error("Error deleting data:", error);
      toast.error("Error al eliminar los datos");
    } finally {
      setIsDeleting(false);
    }
  };

  const periodText = isWeekly
    ? `la semana ${week} de ${year}`
    : isFullYear ? `todo el año ${year}` : `${monthName} ${year}`;

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Eliminar datos"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Eliminar datos
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              ¿Estás seguro de que quieres eliminar los datos de <strong>{getDataTypeLabel()}</strong> de <strong>{periodText}</strong>?
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Esta acción no se puede deshacer
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
