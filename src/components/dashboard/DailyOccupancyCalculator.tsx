import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ExtraAppointment {
  duration: number; // in hours
}

interface MonthlyOccupancyEditorProps {
  inline?: boolean;
  preselectedPhysio?: string;
  month?: number; // 0-11
  year?: number;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Re-export as DailyOccupancyCalculator for backwards compatibility where the name is still used in UI
export function DailyOccupancyCalculator(props: MonthlyOccupancyEditorProps) {
  return <MonthlyOccupancyEditor {...props} />;
}

export function MonthlyOccupancyEditor({ inline = false, preselectedPhysio, month, year }: MonthlyOccupancyEditorProps) {
  const currentMonthIndex = new Date().getMonth();
  const currentYearVal = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(month ?? currentMonthIndex);
  const [selectedYear, setSelectedYear] = useState<number>(year ?? currentYearVal);
  
  // Keep selectedDate for the arbitrary day picker if no month/year is forced
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  const [isOpen, setIsOpen] = useState(false);
  
  // If inline, we don't need the dialog to be open to fetch data
  const isQueryEnabled = inline ? true : isOpen;
  
  // Custom manual state
  const [baseHours, setBaseHours] = useState<Record<string, number>>({});
  const [extraAppointments, setExtraAppointments] = useState<Record<string, ExtraAppointment[]>>({});

  const isMonthlyMode = month !== undefined && year !== undefined;
  const isYearlyMode = month === undefined && year !== undefined;
  const isGroupingByDate = isMonthlyMode && !!preselectedPhysio;
  const isGroupingByMonth = isYearlyMode && !!preselectedPhysio;

  const { data: citas, isLoading } = useQuery({
    queryKey: ["occupancy_editor", isYearlyMode ? "yearly" : (isMonthlyMode ? "monthly" : "daily"), isYearlyMode ? `${selectedYear}` : (isMonthlyMode ? `${selectedYear}-${selectedMonth}` : selectedDate)],
    enabled: isQueryEnabled,
    queryFn: async () => {
      let query = supabase
        .from("listado_citas")
        .select("agenda, estado, fecha_cita, mes, anio, servicio, asunto, paciente_nombre, tipo");

      if (isYearlyMode) {
        query = query.eq("anio", selectedYear);
      } else if (isMonthlyMode) {
        query = query.eq("anio", selectedYear).eq("mes", MONTH_NAMES[selectedMonth]);
      } else {
        query = query.eq("fecha_cita", selectedDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out anuladas/canceladas
      return (data || []).filter(c => {
        const est = (c.estado || "").toLowerCase();
        return !est.includes("anulada") && !est.includes("cancelada");
      });
    }
  });

  const { data: dbHorasReal } = useQuery({
    queryKey: ["occupancy_editor_horas", isYearlyMode ? "yearly" : (isMonthlyMode ? "monthly" : "daily"), isYearlyMode ? `${selectedYear}` : (isMonthlyMode ? `${selectedYear}-${selectedMonth}` : selectedDate)],
    enabled: isQueryEnabled,
    queryFn: async () => {
      let query = supabase
        .from("horas_profesional")
        .select("usuario, fecha, horas, anio, mes");

      if (isYearlyMode) {
        query = query.eq("anio", selectedYear);
      } else if (isMonthlyMode) {
        query = query.eq("anio", selectedYear).eq("mes", MONTH_NAMES[selectedMonth].toLowerCase());
      } else {
        query = query.eq("fecha", selectedDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const physioStats = useMemo(() => {
    if (!citas) return [];
    // Group appointments by key
    const groupMap = new Map<string, any[]>();
    citas.forEach(cita => {
      const p = cita.agenda || "Sin asignar";
      if (preselectedPhysio && p !== preselectedPhysio) return;
      
      let key = p;
      if (isGroupingByDate) {
        key = cita.fecha_cita;
      } else if (isGroupingByMonth) {
        key = cita.mes || "Sin mes";
      }
      
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(cita);
    });

    // Horas real mapping
    const horasMap = new Map<string, number>();
    const horasRealData = (dbHorasReal as any[]) || [];
    if (horasRealData.length > 0) {
      horasRealData.forEach(h => {
        let key = h.usuario;
        if (isGroupingByDate) key = h.fecha;
        else if (isGroupingByMonth) key = h.mes; 
        
        // Correct month casing if needed
        if (isGroupingByMonth && key) {
          const foundMonth = MONTH_NAMES.find(m => m.toLowerCase() === key.toLowerCase());
          if (foundMonth) key = foundMonth;
        }

        horasMap.set(key, (horasMap.get(key) || 0) + (Number(h.horas) || 0));
      });
    }

    return Array.from(groupMap.entries()).map(([name, group]) => {
      const count = group.length;
      // Use DB hours as base if available, fallback to 1h per appt
      const originalOccupied = horasMap.get(name) ?? count;
      
      // The hierarchy of base hours: Manual override in UI > Worked Hours (Domicilios fallback) > Default 8
      let y = baseHours[name] || 0;
      if (y === 0) {
        // If no manual override, check for activity
        if (originalOccupied > 0) {
          y = originalOccupied;
        } else {
          y = 8; // Absolute fallback for empty days
        }
      }
      
      const extras = extraAppointments[name] || [];
      const extraHours = extras.reduce((sum, e) => sum + e.duration, 0);
      
      const totalOccupied = originalOccupied + extraHours;
      const occupancyPercent = y > 0 ? (totalOccupied / y) * 100 : 0;

      return {
        name,
        count,
        originalOccupied,
        totalOccupied,
        y,
        extras,
        occupancyPercent
      };
    }).sort((a, b) => {
      if (isGroupingByDate) {
        return new Date(a.name).getTime() - new Date(b.name).getTime();
      } else if (isGroupingByMonth) {
        return MONTH_NAMES.indexOf(a.name) - MONTH_NAMES.indexOf(b.name);
      }
      return b.totalOccupied - a.totalOccupied;
    });
  }, [citas, dbHorasReal, baseHours, extraAppointments, isGroupingByDate, isGroupingByMonth, preselectedPhysio]);

  const formatTitle = (name: string) => {
    if (isGroupingByDate) {
      try {
        const parts = name.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      } catch { /* ignore */ }
    }
    return name;
  };

  const handleBaseHoursChange = (name: string, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setBaseHours(prev => ({ ...prev, [name]: num }));
    }
  };

  const handleAddExtra = (name: string, pDuration: number) => {
    if (isNaN(pDuration) || pDuration <= 0) return;
    setExtraAppointments(prev => {
      const current = prev[name] || [];
      return { ...prev, [name]: [...current, { duration: pDuration }] };
    });
  };

  const handleRemoveExtra = (name: string, index: number) => {
    setExtraAppointments(prev => {
      const current = [...(prev[name] || [])];
      current.splice(index, 1);
      return { ...prev, [name]: current };
    });
  };

  const Content = () => (
    <div className={`space-y-6 ${inline ? 'p-4 bg-muted/30 rounded-lg border border-border mt-2' : 'py-4'}`}>
      {!inline && (
        <DialogHeader>
          <DialogTitle>Editor de Ocupación</DialogTitle>
        </DialogHeader>
      )}

      {!isMonthlyMode && !isYearlyMode && (
        <div className="flex items-center gap-4">
          <Label htmlFor="date" className="font-semibold">
            {inline ? `Seleccione fecha:` : `Fecha a consultar:`}
          </Label>
          <Input 
            id="date" 
            type="date" 
            className="w-48 bg-background border-border"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      )}
      
      {(isMonthlyMode || isYearlyMode) && inline && (
        <div className="flex items-center gap-2">
          <Label className="font-semibold text-foreground">
            Datos de ocupación para:
          </Label>
          <span className="text-muted-foreground font-medium">
            {isMonthlyMode ? `${MONTH_NAMES[selectedMonth]} ` : ''}{selectedYear}
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground w-full text-center py-4">Cargando datos...</p>
      ) : physioStats.length === 0 ? (
        <p className="text-sm text-muted-foreground w-full text-center py-4">
          No hay citas registradas (ni confirmadas ni realizadas) en este periodo{preselectedPhysio ? ` para ${preselectedPhysio}` : ''}.
        </p>
      ) : (
        isGroupingByDate || isGroupingByMonth ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
             {physioStats.map(stat => (
                <div key={stat.name} className="bg-background border rounded-lg p-3 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b">
                    <span className="font-semibold text-primary">{formatTitle(stat.name)}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${stat.occupancyPercent >= 80 ? 'bg-green-100 text-green-700' : stat.occupancyPercent >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {stat.occupancyPercent.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="text-center mb-3">
                    <span className={`text-xl font-bold ${stat.occupancyPercent >= 80 ? 'text-green-600' : stat.occupancyPercent >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {stat.totalOccupied}h
                    </span>
                    <span className="text-sm text-muted-foreground"> / {stat.y}h</span>
                  </div>
                  
                  <div className="space-y-2 mt-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Citas (h base)</span>
                      <span className="text-xs font-medium">{stat.originalOccupied}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Jornada</span>
                      <div className="flex items-center gap-1">
                        <Input 
                          type="number" step="0.5" min="0" className="w-14 h-6 text-right text-xs px-1"
                          value={baseHours[stat.name] || 8}
                          onChange={(e) => handleBaseHoursChange(stat.name, e.target.value)}
                        />
                        <span className="text-[10px] text-muted-foreground">h</span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t mt-2">
                      {stat.extras.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center mb-2">
                          <span className="text-[10px] text-muted-foreground w-full">Extras:</span>
                          {stat.extras.map((ex, i) => (
                             <div key={i} className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded">
                               +{ex.duration}h
                               <button className="ml-0.5 hover:text-destructive" onClick={() => handleRemoveExtra(stat.name, i)}>✕</button>
                             </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="w-full h-6 text-[10px] border-dashed" onClick={() => {
                         const val = prompt(`Duración extra para ${formatTitle(stat.name)} (ej: 1, 1.5):`, "1");
                         if (val) handleAddExtra(stat.name, parseFloat(val));
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Añadir extra
                      </Button>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden bg-background">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {!preselectedPhysio && <TableHead>Profesional</TableHead>}
                  <TableHead className="text-center font-semibold">Citas (h base)</TableHead>
                  <TableHead className="text-center font-semibold">Jornada (Y h)</TableHead>
                  <TableHead className="text-center font-semibold">Citas Extra</TableHead>
                  <TableHead className="text-right font-semibold">Ocupación Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {physioStats.map((stat) => (
                  <TableRow key={stat.name} className="hover:bg-muted/30">
                    {!preselectedPhysio && <TableCell className="font-medium">{stat.name}</TableCell>}
                    <TableCell className="text-center">{stat.originalOccupied}h</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Input 
                          type="number" 
                          step="0.5" 
                          className="w-20 text-center h-8" 
                          value={baseHours[stat.name] || 8}
                          onChange={(e) => handleBaseHoursChange(stat.name, e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-2 items-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {stat.extras.map((ex, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded">
                              + {ex.duration}h
                              <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-primary/20 hover:text-primary rounded-full" onClick={() => handleRemoveExtra(stat.name, i)}>✕</Button>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2 mt-1 border-dashed" onClick={() => {
                          const val = prompt("Duración de la nueva cita (en horas, ej: 1, 1.5, 0.5):", "1");
                          if (val) handleAddExtra(stat.name, parseFloat(val));
                        }}>
                          <Plus className="w-3 h-3 mr-1" /> Añadir cita extra
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-foreground bg-background px-2 py-1 rounded border shadow-sm">
                          {stat.totalOccupied}h / {stat.y}h
                        </span>
                        <span className={`text-sm mt-1 font-semibold ${stat.occupancyPercent >= 80 ? 'text-green-600' : stat.occupancyPercent >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {stat.occupancyPercent.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </div>
  );

  if (inline) {
    return <Content />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calculator className="w-4 h-4" />
          Calculadora Ocupación Diaria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <Content />
      </DialogContent>
    </Dialog>
  );
}
