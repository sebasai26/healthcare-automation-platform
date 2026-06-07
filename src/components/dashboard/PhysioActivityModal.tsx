import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, Plus, Clock, Users, Activity, Info, Search, Check, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PhysioActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  physioName: string;
  year: number;
  month?: number; // 0-11, if undefined means all year (optional, but requested by current UI usage)
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

interface ExtraAppointment {
  id?: string;
  duration: number; // in hours
  servicio?: string;
}

export function PhysioActivityModal({ isOpen, onClose, physioName, year, month }: PhysioActivityModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAllYear = month === undefined || month === -1;
  const isCristinaPonce = physioName.toLowerCase().includes("cristina ponce");

  const extractServiceName = (asunto: string) => {
    if (!asunto) return "-";
    // Check if there are parentheses at the end or at least one set of parentheses
    // Handle nested parentheses: extract from the first '(' that closes with the last ')'
    const lastParenEnd = asunto.lastIndexOf(')');
    if (lastParenEnd !== -1) {
      let balance = 0;
      let startIdx = -1;
      for (let i = asunto.length - 1; i >= 0; i--) {
        if (asunto[i] === ')') balance++;
        if (asunto[i] === '(') balance--;
        if (balance === 0 && startIdx === -1 && asunto[i] === '(') {
          startIdx = i;
          break;
        }
      }
      if (startIdx !== -1) {
        return asunto.substring(startIdx + 1, lastParenEnd);
      }
    }
    return asunto;
  };

  // Custom manual state per day
  const [baseHours, setBaseHours] = useState<Record<string, number>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Fetch ALL historical service names (across all years) to populate the selector
  const { data: allServiceNames } = useQuery({
    queryKey: ["all_service_names"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analisis_servicios" as any)
        .select("servicio");
      if (error) throw error;
      const names = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.servicio) names.add(row.servicio);
      });
      return Array.from(names).sort();
    }
  });
  const availableServices = allServiceNames || [];

  const { data: citas, isLoading } = useQuery({
    queryKey: ["physio_activity", physioName, year, month],
    enabled: isOpen && !!physioName,
    queryFn: async () => {
      const firstName = physioName.trim().split(' ')[0];
      
      let query = supabase
        .from("listado_citas")
        .select("fecha_cita, paciente_nombre, tipo, asunto, estado, servicio, agenda")
        .ilike("agenda", `%${firstName}%`)
        .eq("anio", year);

      if (!isAllYear && month !== undefined) {
        query = query.eq("mes", MONTH_NAMES[month]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // STRICT filter: only allow appointments where estado starts with "realizada"
      return (data as any[] || []).filter(c => {
        const est = (c.estado || "").toLowerCase();
        const agenda = (c.agenda || "").toLowerCase();
        
        // Exact agenda match strategy
        const isAgendaMatch = agenda.includes(firstName.toLowerCase()) || 
                              physioName.toLowerCase().includes(agenda);
                              
        return est.startsWith("realizada") && isAgendaMatch;
      });
    }
  });

  // Fetch daily custom base hours from our new jornada_profesional table
  const { data: jornadasInfo } = useQuery({
    queryKey: ["physio_jornadas", physioName, year, month],
    enabled: isOpen && !!physioName,
    queryFn: async () => {
      const firstName = physioName.trim().split(' ')[0];
      let query = (supabase as any)
        .from("jornada_profesional")
        .select("fecha, horas_jornada")
        .ilike("usuario", `%${firstName}%`)
        .eq("anio", year);

      if (!isAllYear && month !== undefined) {
        query = query.eq("mes", MONTH_NAMES[month].toLowerCase());
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching jornadas:", error);
        return [];
      }
      return data || [];
    }
  });

  // Fetch extra appointments from our new table
  const { data: dbExtras, refetch: refetchExtras } = useQuery({
    queryKey: ["physio_extras", physioName, year, month],
    enabled: isOpen && !!physioName,
    queryFn: async () => {
      const firstName = physioName.trim().split(' ')[0];
      let query = (supabase as any)
        .from("citas_extras_profesional")
        .select("id, fecha, duracion, servicio")
        .ilike("usuario", `%${firstName}%`)
        .eq("anio", year);

      if (!isAllYear && month !== undefined) {
        query = query.eq("mes", MONTH_NAMES[month].toLowerCase());
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching extras:", error);
        return [];
      }
      return data || [];
    }
  });

  // Fetch actual hours worked from horas_profesional
  const { data: dbHorasReal } = useQuery({
    queryKey: ["physio_horas_real", physioName, year, month],
    enabled: isOpen && !!physioName,
    queryFn: async () => {
      const firstName = physioName.trim().split(' ')[0];
      let query = (supabase as any)
        .from("horas_profesional")
        .select("fecha, horas")
        .ilike("usuario", `%${firstName}%`)
        .eq("anio", year);

      if (!isAllYear && month !== undefined) {
        query = query.eq("mes", MONTH_NAMES[month].toLowerCase());
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching horas real:", error);
        return [];
      }
      return data || [];
    }
  });

  const dailyStats = useMemo(() => {
    if (!citas) return [];
    
    // Group by day
    const byDay = new Map<string, any[]>();
    citas.forEach(c => {
      const day = c.fecha_cita;
      if (!day) return;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(c);
    });

    // Also include days that only have extras or jornadas but no citas
    if (jornadasInfo) {
      jornadasInfo.forEach(j => {
        if (j.fecha && !byDay.has(j.fecha)) byDay.set(j.fecha, []);
      });
    }
    if (dbExtras) {
      dbExtras.forEach(e => {
        if (e.fecha && !byDay.has(e.fecha)) byDay.set(e.fecha, []);
      });
    }
    // Provide mappings for O(1) daily lookup
    const dbHorasMap = new Map<string, number>();
    if (dbHorasReal) {
      dbHorasReal.forEach(h => {
        if (h.fecha && typeof h.horas === 'number') {
          dbHorasMap.set(h.fecha, h.horas);
        }
      });
    }

    const dbJornadas = new Map<string, number>();
    if (jornadasInfo) {
      jornadasInfo.forEach(j => {
        if (j.fecha && typeof j.horas_jornada === 'number') {
          dbJornadas.set(j.fecha, j.horas_jornada);
        }
      });
    }

    return Array.from(byDay.entries()).map(([dateStr, appointments]) => {
      // Order appointments by patient name
      appointments.sort((a, b) => (a.paciente_nombre || "").localeCompare(b.paciente_nombre || ""));
      
      const realAppointmentsCount = appointments.length;
      // Use DB hours if available, otherwise count appointments as 1h each
      const baseWorkloadHours = dbHorasMap.get(dateStr) ?? realAppointmentsCount;
      
      // The hierarchy of base hours: Manual override in UI > DB Value > Worked Hours (Domicilios) > Default 8
      let y = baseHours[dateStr] !== undefined 
        ? baseHours[dateStr] 
        : (dbJornadas.get(dateStr) ?? 0);
      
      const extras: ExtraAppointment[] = (dbExtras || [])
        .filter(e => e.fecha === dateStr)
        .map(e => ({ id: e.id, duration: Number(e.duracion), servicio: e.servicio }));

      const extraHours = extras.reduce((sum, e) => sum + e.duration, 0);
      const totalOccupied = baseWorkloadHours + extraHours;

      // If no journey record and no manual override, but there is activity, assume journey = totalOccupied
      if (y === 0 && (baseWorkloadHours > 0 || extraHours > 0)) {
        y = totalOccupied;
      } else if (y === 0) {
        y = 8; // Absolute fallback for empty days
      }
      
      const occupancyPercent = y > 0 ? (totalOccupied / y) * 100 : 0;

      return {
        dateStr,
        appointments,
        realAppointmentsCount,
        baseWorkloadHours, // Precise hours from DB
        extras,
        totalOccupied,
        occupancyPercent,
        y // base hours
      };
    }).sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()); // Sort alphabetically/chronologically assuming YYYY-MM-DD
  }, [citas, baseHours, jornadasInfo, dbExtras, dbHorasReal]);

  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch { /* ignore */ }
    return dateStr;
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const handleBaseHoursChange = (dateStr: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setBaseHours(prev => ({ ...prev, [dateStr]: num }));
    }
  };

  const handleAddExtra = async (dateStr: string, pDuration: number, pServicio: string) => {
    if (isNaN(pDuration) || pDuration <= 0) return;
    
    // Safer month extraction from YYYY-MM-DD
    const dateParts = dateStr.split('-');
    const mIdx = parseInt(dateParts[1]) - 1;
    const monthName = MONTH_NAMES[mIdx].toLowerCase();

    const { error } = await (supabase as any).from("citas_extras_profesional").insert({
      usuario: physioName.trim(),
      fecha: dateStr,
      duracion: pDuration,
      servicio: pServicio || null,
      anio: year,
      mes: monthName
    });

    if (error) {
      console.error("Error adding extra:", error);
      toast({
        title: "Error al guardar",
        description: `No se pudo guardar la cita extra: ${error.message}`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Cita guardada",
        description: "La cita extra se ha registrado correctamente."
      });
      refetchExtras();
      queryClient.invalidateQueries({ queryKey: ["productividad_equipo"] });
      queryClient.invalidateQueries({ queryKey: ["ocupacion_equipo"] });
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
    }
  };

  const handleRemoveExtra = async (dateStr: string, index: number, extraId?: string) => {
    if (!extraId) return;

    const { error } = await (supabase as any)
      .from("citas_extras_profesional")
      .delete()
      .eq("id", extraId);

    if (error) {
      console.error("Error removing extra:", error);
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Cita eliminada",
        description: "La cita extra se ha eliminado correctamente."
      });
      refetchExtras();
      queryClient.invalidateQueries({ queryKey: ["productividad_equipo"] });
      queryClient.invalidateQueries({ queryKey: ["ocupacion_equipo"] });
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col p-4 sm:p-6">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Actividad de {physioName} {isAllYear ? `Año ${year}` : `- ${MONTH_NAMES[month!]} ${year}`}
          </DialogTitle>
          <div className="flex items-start gap-2 mt-2 px-1">
            <Info className="w-4 h-4 text-blue-500/70 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Las citas provienen de <strong>"Listado de citas"</strong>. La ocupación utiliza las <strong>"Horas trabajadas por profesional"</strong> y la jornada viene de <strong>"Ocupación por profesional"</strong>, ambos del <strong>"Análisis de Productividad"</strong>.
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-x-auto border rounded-xl bg-card shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Activity className="w-6 h-6 animate-pulse mr-2" />
              Cargando citas...
            </div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay citas registradas (ni confirmadas ni realizadas) para este periodo.
            </div>
          ) : (
             <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="font-semibold text-foreground whitespace-nowrap">Día🗓️</TableHead>
                    <TableHead className="text-center font-semibold text-foreground whitespace-nowrap">Citas Reales / Horas</TableHead>
                    {!isCristinaPonce && <TableHead className="text-center font-semibold text-foreground whitespace-nowrap">Jornada (h)</TableHead>}
                    <TableHead className="text-center font-semibold text-foreground min-w-[150px]">Citas Extra</TableHead>
                    {!isCristinaPonce && <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">Ocupación</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyStats.map((stat) => (
                    <React.Fragment key={stat.dateStr}>
                      <TableRow 
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setExpandedDay(expandedDay === stat.dateStr ? null : stat.dateStr)}
                      >
                        <td className="p-3 text-center text-muted-foreground group-hover:text-primary transition-colors">
                          {expandedDay === stat.dateStr ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                        </td>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatDateLabel(stat.dateStr)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className="bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-md text-sm">
                              {stat.realAppointmentsCount}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                              ({formatDuration(stat.baseWorkloadHours)})
                            </span>
                          </div>
                        </TableCell>
                        {!isCristinaPonce && (
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-center items-center gap-1.5 focus-within:ring-2 ring-primary/20 rounded px-1">
                              <Input 
                                type="number" 
                                step="0.5" 
                                className="w-16 sm:w-20 text-center h-8 bg-background focus-visible:ring-0 shadow-none border-muted-foreground/20" 
                                value={stat.y}
                                onChange={(e) => handleBaseHoursChange(stat.dateStr, e.target.value)}
                              />
                              <span className="text-xs font-medium text-muted-foreground">h</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-2 items-center">
                            <div className="flex flex-wrap justify-center gap-1.5">
                              {stat.extras.map((ex, i) => (
                                <div key={i} className="flex flex-col items-center bg-muted text-foreground border px-2 py-1 rounded-md shadow-sm min-w-[60px]">
                                  <div className="flex items-center justify-between w-full gap-1">
                                    <span className="font-bold text-[10px]">+{ex.duration}h</span>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-3 w-3 hover:bg-destructive/10 hover:text-destructive rounded-full p-0" 
                                      onClick={() => handleRemoveExtra(stat.dateStr, i, ex.id)}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                  {ex.servicio && (
                                    <span className="text-[9px] leading-tight text-muted-foreground mt-0.5 border-t w-full pt-1 text-center font-medium truncate max-w-[80px]">
                                      {ex.servicio}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <AddExtraPopover 
                              dateStr={stat.dateStr}
                              services={availableServices}
                              onAdd={(duration, service) => handleAddExtra(stat.dateStr, duration, service)}
                            />
                          </div>
                        </TableCell>
                        {!isCristinaPonce && (
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-semibold text-foreground bg-background px-2.5 py-1 rounded-md border shadow-sm text-sm">
                                {formatDuration(stat.totalOccupied)} / {stat.y}h
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stat.occupancyPercent >= 80 ? 'bg-green-100 text-green-700' : stat.occupancyPercent >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                {stat.occupancyPercent.toFixed(2)}%
                              </span>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      
                      {/* Expanded Real Appointments Detail */}
                      {expandedDay === stat.dateStr && (
                        <TableRow className="bg-muted/10">
                          <TableCell colSpan={isCristinaPonce ? 4 : 6} className="p-0 border-b-2">
                             <div className="px-4 sm:px-8 py-4 animate-in slide-in-from-top-2">
                               <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-foreground">
                                 <Clock className="w-4 h-4 text-primary" />
                                 Citas Reales del Día
                               </h4>
                               <div className="rounded-lg border bg-background overflow-hidden relative">
                                  <Table>
                                    <TableHeader className="bg-muted/30">
                                      <TableRow className="hover:bg-transparent border-none">
                                      <TableHead className="w-[150px] h-9 text-xs">Paciente</TableHead>
                                      <TableHead className="h-9 text-xs">Servicio</TableHead>
                                      <TableHead className="h-9 text-xs text-right">Duración Estimada</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {[
                                          ...stat.appointments.map((a: any) => ({ ...a, isExtra: false })),
                                          ...stat.extras.map((e: any) => ({ 
                                            paciente_nombre: "Cita Registrada Manualmente", 
                                            servicio: e.servicio || "Extra", 
                                            isExtra: true, 
                                            duration: e.duration 
                                          }))
                                       ].sort((a, b) => (a.paciente_nombre || "").localeCompare(b.paciente_nombre || "")).map((appt: any, i) => (
                                       <TableRow key={i} className={cn("border-none", appt.isExtra ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30")}>
                                         <TableCell className="font-medium text-xs flex items-center gap-2">
                                           {appt.paciente_nombre || 'Sin nombre'}
                                           {appt.isExtra && (
                                             <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">
                                               Extra
                                             </span>
                                           )}
                                         </TableCell>
                                         <TableCell className="text-muted-foreground text-xs">
                                           {appt.isExtra ? appt.servicio : extractServiceName(appt.servicio || appt.asunto || "-")}
                                         </TableCell>
                                          <TableCell className="text-right text-muted-foreground font-medium text-xs">
                                             {appt.isExtra ? `${appt.duration}h` : '1.0h'}
                                          </TableCell>Prefix: 
                                       </TableRow>
                                       ))}
                                     </TableBody>
                                  </Table>
                                     <div className="bg-muted/30 p-2 text-right text-xs text-muted-foreground border-t">
                                      Las citas provienen de <strong>"Listado de citas"</strong> y <strong>"Citas Extras"</strong> registradas manualmente.
                                    </div>
                               </div>
                             </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AddExtraPopoverProps {
  dateStr: string;
  services: string[];
  onAdd: (duration: number, service: string) => void;
}

function AddExtraPopover({ dateStr, services, onAdd }: AddExtraPopoverProps) {
  const [duration, setDuration] = useState(1);
  const [service, setService] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    if (duration > 0) {
      onAdd(duration, service === "none" ? "" : service);
      setIsOpen(false);
      setService("");
    }
  };

  // Grouping logic for the combobox
  const fisioServices = useMemo(() => services.filter(s => {
    const n = s.toLowerCase();
    const norm = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPrimera = norm.includes("primera sesi") || n.includes("1ª sesion") || norm.includes("1a sesion");
    const isPilates = n.includes("pilates");
    return (n.includes("fisioterapia") || n.includes("sucesivas") || n.includes("domicilio") || n.includes("neurologica")) && !isPrimera && !isPilates;
  }), [services]);

  const pilatesServices = useMemo(() => services.filter(s => s.toLowerCase().includes("pilates")), [services]);
  
  const primeraSesionServices = useMemo(() => services.filter(s => {
    const n = s.toLowerCase();
    const norm = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return norm.includes("primera sesi") || n.includes("1ª sesion") || norm.includes("1a sesion");
  }), [services]);

  const otrosServices = useMemo(() => services.filter(s => {
    const n = s.toLowerCase();
    const norm = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isPrimera = norm.includes("primera sesi") || n.includes("1ª sesion") || norm.includes("1a sesion");
    const isFisio = (n.includes("fisioterapia") || n.includes("sucesivas") || n.includes("domicilio") || n.includes("neurologica")) && !isPrimera;
    const isPilates = n.includes("pilates");
    return !isFisio && !isPilates && !isPrimera;
  }), [services]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs px-2.5 border-dashed bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-colors"
        >
          <Plus className="w-3 h-3 mr-1" /> Añadir Extra
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 shadow-xl border-primary/20" align="center" side="top">
        <div className="p-3 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">Nueva Cita Extra</h4>
            <p className="text-[10px] text-muted-foreground">Configura la duración y el servicio</p>
          </div>
          
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor={`duration-${dateStr}`} className="text-[10px] uppercase font-bold text-muted-foreground">Duración (h)</Label>
              <Input
                id={`duration-${dateStr}`}
                type="number"
                step="0.5"
                min="0.5"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="h-8 text-sm focus-visible:ring-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Servicio (Opcional)</Label>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isOpen}
                    className="w-full h-8 justify-between text-xs font-normal bg-background"
                  >
                    {service ? service : "Seleccionar servicio..."}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command className="border shadow-md">
                    <CommandInput placeholder="Buscar servicio..." className="h-8 text-xs" />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty className="py-2 text-xs text-center">No se encontraron servicios.</CommandEmpty>
                      
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => setService("none")}
                          className="text-xs"
                        >
                          <Check className={cn("mr-2 h-3 w-3", service === "none" ? "opacity-100" : "opacity-0")} />
                          Ninguno
                        </CommandItem>
                      </CommandGroup>

                      {/* Fisioterapia (Prioritized) */}
                      {fisioServices.length > 0 && (
                        <CommandGroup heading="Fisioterapia">
                          {fisioServices.map((s) => (
                            <CommandItem
                              key={s}
                              value={s}
                              onSelect={() => setService(s)}
                              className="text-xs"
                            >
                              <Check className={cn("mr-2 h-3 w-3", service === s ? "opacity-100" : "opacity-0")} />
                              {s}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {/* Pilates */}
                      {pilatesServices.length > 0 && (
                        <CommandGroup heading="Pilates">
                          {pilatesServices.map((s) => (
                            <CommandItem
                              key={s}
                              value={s}
                              onSelect={() => setService(s)}
                              className="text-xs"
                            >
                              <Check className={cn("mr-2 h-3 w-3", service === s ? "opacity-100" : "opacity-0")} />
                              {s}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {/* Primera Sesión */}
                      {primeraSesionServices.length > 0 && (
                        <CommandGroup heading="Primera Sesión">
                          {primeraSesionServices.map((s) => (
                            <CommandItem
                              key={s}
                              value={s}
                              onSelect={() => setService(s)}
                              className="text-xs"
                            >
                              <Check className={cn("mr-2 h-3 w-3", service === s ? "opacity-100" : "opacity-0")} />
                              {s}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {/* Otros */}
                      {otrosServices.length > 0 && (
                        <CommandGroup heading="Otros">
                          {otrosServices.map((s) => (
                            <CommandItem
                              key={s}
                              value={s}
                              onSelect={() => setService(s)}
                              className="text-xs"
                            >
                              <Check className={cn("mr-2 h-3 w-3", service === s ? "opacity-100" : "opacity-0")} />
                              {s}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              size="sm" 
              className="w-full h-8 mt-2"
              onClick={handleConfirm}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
