import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Calendar as CalendarIcon, FilterX, Edit, Trash2, Bell, CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfWeek, addDays, format, isSameDay, parseISO, isAfter, setHours, setMinutes, subDays, startOfDay, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertTriangle, AlertCircle } from "lucide-react";
import { AddRecordatorioModal } from "./AddRecordatorioModal";
import { EditRecordatorioModal } from "./EditRecordatorioModal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RecordatoriosSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: totalEnviados, refetch: refetchCount } = useQuery({
    queryKey: ['recordatorios-cita-total'],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('recordatorios_cita')
        .select('*', { count: 'exact', head: true })
        .eq('estado_recordatorio', 'Enviado');

      if (error) {
        console.error("Error fetching total recordatorios count:", error);
        return 0;
      }
      return count || 0;
    }
  });

  const { data: recordatorios, isLoading, refetch } = useQuery({
    queryKey: ['recordatorios-cita'],
    queryFn: async () => {
      // Optimizamos: Cargamos solo los registros desde hace 45 días y todos los futuros
      // para evitar el límite de 1000 registros de Supabase (que de otro modo cargaría los más antiguos primero)
      const fortyFiveDaysAgo = new Date();
      fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
      const dateStr = fortyFiveDaysAgo.toISOString().split('T')[0];

      const { data, error } = await (supabase as any)
        .from('recordatorios_cita')
        .select('*')
        .gte('fecha_cita', dateStr)
        .order('fecha_cita', { ascending: true });

      if (error) {
        console.error("Error fetching recordatorios:", error);
        throw error;
      }
      
      return (data || []).sort((a: any, b: any) => {
        const dateCompare = (a.fecha_cita || '').localeCompare(b.fecha_cita || '');
        if (dateCompare !== 0) return dateCompare;
        
        const timeA = (a.hora_cita || '').padStart(5, '0');
        const timeB = (b.hora_cita || '').padStart(5, '0');
        return timeA.localeCompare(timeB);
      });
    }
  });

  const combinedRefetch = () => {
    refetch();
    refetchCount();
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('recordatorios_cita').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Recordatorio eliminado", description: "Se ha borrado el recordatorio de la lista." });
      combinedRefetch();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se ha podido eliminar", variant: "destructive" });
    }
  };

  const handleDeleteAllForDay = async () => {
    if (!selectedDate) return;
    const targetApptDate = getTargetApptDate(selectedDate);
    const dateStr = format(targetApptDate, "yyyy-MM-dd");
    
    try {
      const { error } = await (supabase as any)
        .from('recordatorios_cita')
        .delete()
        .eq('fecha_cita', dateStr);
        
      if (error) throw error;
      
      toast({ 
        title: "Día limpiado", 
        description: `Se han eliminado todos los recordatorios para el día ${format(targetApptDate, "d 'de' MMMM", { locale: es })}.` 
      });
      combinedRefetch();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se han podido eliminar los recordatorios", variant: "destructive" });
    }
  };

  // Helper: get the target appointment date for a planner day
  // Friday (day 5) → Monday (day+3), all other days → next day (day+1)
  const getTargetApptDate = (day: Date) => {
    return day.getDay() === 5 ? addDays(day, 3) : addDays(day, 1);
  };

  // Calculate the days of the current week (starting Monday)
  const weekDays = useMemo(() => {
    const today = new Date();
    // Use ISO week (Starts on Monday)
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    // Calcular el viernes anterior (3 días antes del lunes)
    const prevFriday = subDays(startOfCurrentWeek, 3);
    
    // Return 8 days (Monday to Monday of next week) and filter out Saturdays (6) and Sundays (0)
    const currentDays = Array.from({ length: 8 })
      .map((_, i) => addDays(startOfCurrentWeek, i))
      .filter(day => day.getDay() !== 6 && day.getDay() !== 0);

    // Unir el viernes anterior con los días de la semana actual
    return [prevFriday, ...currentDays];
  }, []);

  // Filter the table based on selectedDate
  // Friday shows Monday's appointments, all other days show next day's appointments
  const filteredRecordatorios = useMemo(() => {
    if (!recordatorios) return [];
    if (!selectedDate) return recordatorios;
    const targetApptDate = getTargetApptDate(selectedDate);
    return recordatorios.filter((r: any) => {
      if (!r.fecha_cita) return false;
      const recDate = parseISO(r.fecha_cita);
      return isSameDay(recDate, targetApptDate);
    });
  }, [recordatorios, selectedDate]);

  // Calculate week range text
  const weekRange = useMemo(() => {
    if (weekDays.length === 0) return "";
    const start = format(weekDays[0], "d 'de' MMM", { locale: es });
    const end = format(weekDays[weekDays.length - 1], "d 'de' MMM", { locale: es });
    return `${start} - ${end}`;
  }, [weekDays]);

  // Check if all filtered are sent
  const isAllSent = useMemo(() => {
    if (!filteredRecordatorios || filteredRecordatorios.length === 0) return false;
    return filteredRecordatorios.every((r: any) => r.estado_recordatorio === 'Enviado');
  }, [filteredRecordatorios]);

  // Calculate weekly metrics based on weekDays
  const weeklyMetrics = useMemo(() => {
    if (!recordatorios || weekDays.length === 0) return { sent: 0, pending: 0 };
    
    let sent = 0;
    let pending = 0;
    
    // For each day in the planner, get its target appointment date (day + 1)
    const targetDates = weekDays.map(day => getTargetApptDate(day));
    
    recordatorios.forEach((r: any) => {
      if (!r.fecha_cita) return;
      const recDate = parseISO(r.fecha_cita);
      const isInWeek = targetDates.some(targetDate => isSameDay(recDate, targetDate));
      
      if (isInWeek) {
        if (r.estado_recordatorio === 'Enviado') {
          sent++;
        } else {
          pending++;
        }
      }
    });
    
    return { sent, pending };
  }, [recordatorios, weekDays]);

  // Helper to get the automatic sending deadline for a given appointment date
  const getSendingDeadline = (apptDateStr: string) => {
    try {
      const apptDate = parseISO(apptDateStr);
      // If appointment is Monday (1), deadline was previous Friday (sub 3 days) at 09:00
      if (apptDate.getDay() === 1) {
        return setHours(setMinutes(subDays(apptDate, 3), 0), 9);
      } else {
        // Otherwise, deadline was previous day at 09:00
        return setHours(setMinutes(subDays(apptDate, 1), 0), 9);
      }
    } catch (e) {
      return new Date();
    }
  };

  // Helper to detect if a record was added after the automated send time (09:00 AM of planning day)
  const isAddedLate = (record: any) => {
    if (!record.created_at || !record.fecha_cita) return false;
    const deadline = getSendingDeadline(record.fecha_cita);
    const createdAt = parseISO(record.created_at);
    return isAfter(createdAt, deadline);
  };

  // Group pending reminders by appointment day to show "Send Day" info
  const lateGroups = useMemo(() => {
    if (!recordatorios) return [];
    
    const today = startOfDay(new Date());
    const lateReminders = recordatorios.filter((r: any) => {
      if (r.estado_recordatorio !== 'Por enviar') return false;
      if (!isAddedLate(r)) return false;
      
      const apptDate = startOfDay(parseISO(r.fecha_cita));
      return !isBefore(apptDate, today);
    });
    
    if (lateReminders.length === 0) return [];

    const groups = new Map<string, number>();
    lateReminders.forEach((r: any) => {
      const key = r.fecha_cita;
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    
    return Array.from(groups.entries()).map(([fecha, count]) => {
      const date = parseISO(fecha);
      const isMonday = date.getDay() === 1;
      const apptDayName = format(date, 'EEEE', { locale: es });
      const sendDayName = isMonday ? "viernes" : format(subDays(date, 1), 'EEEE', { locale: es });
      return { 
        apptDayName: apptDayName.charAt(0).toUpperCase() + apptDayName.slice(1), 
        sendDayName: sendDayName.charAt(0).toUpperCase() + sendDayName.slice(1), 
        count 
      };
    });
  }, [recordatorios]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-card p-6 rounded-xl border border-border shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Gestor de Recordatorios
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Recordatorios enviados automáticamente</p>
          <div className="mt-2 text-xs bg-muted/60 text-muted-foreground px-3 py-2 rounded-lg border border-border flex items-start gap-2 max-w-lg">
            <CalendarIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
            <p>Los recordatorios se envían el día anterior a las 9:00 (excepto los del lunes, que se envían el viernes). Se recomienda verificar los datos tras la importación; puedes editarlos individualmente desde la tabla inferior.</p>
          </div>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Añadir Recordatorio
        </Button>
      </div>

      {lateGroups.length > 0 && (
        <Alert className="bg-muted/40 border-border text-foreground animate-in fade-in slide-in-from-top-4">
          <Info className="h-5 w-5 text-muted-foreground" />
          <AlertTitle className="text-foreground font-bold">Recordatorios por enviar manualmente</AlertTitle>
          <AlertDescription className="text-muted-foreground space-y-1 mt-1">
            <p>Hay citas añadidas después del envío automatizado (09:00 AM):</p>
            <ul className="list-disc pl-5 mt-1">
              {lateGroups.map((g, i) => (
                <li key={i}>
                  Recordatorios del <strong>{g.apptDayName}</strong> (enviados el {g.sendDayName}): <strong>{g.count}</strong> pendientes.
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Impacto Acumulado */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between gap-6 relative overflow-hidden group">
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center border border-border transition-colors group-hover:bg-muted">
            <BarChart3 className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Recordatorios enviados (total)</p>
            <h4 className="text-3xl font-black text-foreground tracking-tighter">
              {totalEnviados !== undefined ? totalEnviados : '-'}
            </h4>
          </div>
        </div>
      </div>

      {/* Bloque de Métricas Rápidas */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resumen Semanal</h4>
          <span className="text-xs text-primary font-semibold">({weekRange})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Bell className="w-16 h-16" />
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Bell className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">Recordatorios Enviados</p>
                <Badge variant="outline" className="text-[10px] h-4 px-1">Semana actual</Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {weeklyMetrics.sent}
              </p>
            </div>
          </div>
          
          <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <CalendarIcon className="w-16 h-16" />
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pendientes de Envío</p>
              <p className="text-2xl font-bold text-foreground">
                {weeklyMetrics.pending}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas Semanales Visuales */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-medium text-foreground">Planificador Diario</h4>
            <div className="h-4 w-[1px] bg-border" />
            <p className="text-xs text-muted-foreground font-medium">{weekRange}</p>
          </div>
          {selectedDate && (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)} 
                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Eliminar todos
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} className="h-8 text-xs text-muted-foreground">
                <FilterX className="w-3 h-3 mr-1" /> Quitar selección
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {weekDays.map(day => {
            const isSelected = selectedDate && isSameDay(selectedDate, day);
            const isToday = isSameDay(day, new Date());
            
            // Contar cuantos recordatorios hay en este día
            // Viernes → citas del Lunes (day+3), otros días → citas del día siguiente (day+1)
            const targetApptDate = getTargetApptDate(day);
            const apptDateStr = format(targetApptDate, "yyyy-MM-dd");
            const dayReminders = (recordatorios || []).filter((r: any) => r.fecha_cita && isSameDay(parseISO(r.fecha_cita), targetApptDate));
            const totalCount = dayReminders.length;
            const sentCount = dayReminders.filter((r: any) => r.estado_recordatorio === 'Enviado').length;
            const pendingCount = totalCount - sentCount;
            
            // Un día está completo si todos los recordatorios se han enviado,
            // O si el envío automático ya pasó y todos los recordatorios "estándar" se enviaron.
            // PERO: Si hay algún recordatorio con error ("No se ha podido enviar"), no se marca como completado.
            const now = new Date();
            const sendingDeadline = getSendingDeadline(apptDateStr);
            const sendingPassed = isAfter(now, sendingDeadline);
            const apptDatePassed = isBefore(targetApptDate, startOfDay(now));
            
            const standardReminders = dayReminders.filter(r => !isAddedLate(r));
            const allStandardSent = standardReminders.length > 0 && standardReminders.every(r => r.estado_recordatorio === 'Enviado');
            const anyError = dayReminders.some(r => String(r.estado_recordatorio).includes("No se ha podido enviar"));

            const isDayComplete = totalCount > 0 && !anyError && (
              pendingCount === 0 || 
              (sendingPassed && allStandardSent) ||
              apptDatePassed
            );

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={cn(
                  "snap-start flex-shrink-0 flex flex-col items-center justify-center p-3 w-32 h-36 rounded-xl border transition-all duration-200 relative",
                  isSelected 
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]" 
                    : isDayComplete
                      ? "bg-green-50 border-green-200 hover:border-green-300 text-green-900"
                      : "bg-background border-border hover:border-primary/50 hover:bg-muted text-foreground",
                  isToday && !isSelected && "ring-2 ring-primary/30"
                )}
              >
                {isDayComplete && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-[8px] px-1.5 py-0 h-4 uppercase font-black tracking-tighter">
                      Completados
                    </Badge>
                  </div>
                )}
                <span className={cn("text-xs font-semibold uppercase mb-1", 
                  isSelected ? "text-primary-foreground/80" : isDayComplete ? "text-green-600" : "text-muted-foreground"
                )}>
                  {format(day, 'EEE', { locale: es })}
                </span>
                <span className="text-3xl font-bold tracking-tighter mb-1">
                  {format(day, 'd')}
                </span>
                
                {totalCount > 0 ? (
                  <div className="mt-auto w-full space-y-1.5">
                    <div className={cn(
                      "text-[10px] font-bold px-1 py-0.5 rounded-md text-center",
                      isSelected ? "bg-white/20" : isDayComplete ? "bg-green-100 text-green-700" : "bg-primary/5 text-primary"
                    )}>
                      {totalCount} {totalCount === 1 ? 'recordatorio' : 'recordatorios'}
                    </div>
                    {pendingCount > 0 && (
                      <div className="flex flex-col gap-0.5 px-1 text-[10px] items-start font-bold leading-none">
                        <span className={cn("flex items-center gap-1 italic", isSelected ? "text-white/70" : "text-muted-foreground")}>
                          <div className="w-1 h-1 rounded-full bg-current" /> {sentCount} Enviados
                        </span>
                        <span className={cn("flex items-center gap-1", isSelected ? "text-white" : isDayComplete ? "text-green-600" : "text-amber-600")}>
                          <div className={cn("w-1 h-1 rounded-full", isDayComplete ? "bg-green-500" : "bg-amber-500")} /> 
                          {isDayComplete ? (
                            <span className="text-[8px] leading-tight">
                              {pendingCount} Añadidos después del envío
                            </span>
                          ) : (
                            `${pendingCount} Pendientes`
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="mt-auto text-[10px] opacity-40 italic">Sin recordatorios</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="space-y-4">
          {isAllSent && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-800 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">¡Día completado!</span> Todos los recordatorios para las citas del {format(getTargetApptDate(selectedDate), "d 'de' MMMM", { locale: es })} han sido enviados satisfactoriamente.
              </div>
            </div>
          )}
          
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Cargando recordatorios...</span>
            </div>
          ) : filteredRecordatorios && filteredRecordatorios.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Fisio</TableHead>
                    <TableHead>Tipo Cita</TableHead>
                    <TableHead>Envío WhatsApp</TableHead>
                    <TableHead className="w-[80px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecordatorios.map((recordatorio: any) => (
                    <TableRow key={recordatorio.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap">
                        {recordatorio.fecha_cita ? format(parseISO(recordatorio.fecha_cita), "d MMM, yy", { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="font-semibold">{recordatorio.hora_cita || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{recordatorio.nombre}</span>
                          <span className="text-xs text-muted-foreground">{recordatorio.telefono}</span>
                        </div>
                      </TableCell>
                      <TableCell>{recordatorio.agenda || '-'}</TableCell>
                      <TableCell>
                        {recordatorio.tipo_cita ? (
                          <Badge variant="outline" className="text-xs bg-muted/50">
                            {recordatorio.tipo_cita}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {recordatorio.estado_recordatorio === 'Enviado' ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white border-transparent">
                            Enviado
                          </Badge>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-transparent">
                              {recordatorio.estado_recordatorio || 'Por enviar'}
                            </Badge>
                            {isAddedLate(recordatorio) && (
                              <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 leading-none bg-amber-50 px-1 py-0.5 rounded border border-amber-100">
                                <AlertCircle className="w-2.5 h-2.5" /> Añadidos después del envío automático.
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => setEditRecord(recordatorio)}
                          >
                            <Edit className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteRecordId(recordatorio.id)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="mb-4 text-lg font-medium text-foreground">Ningún recordatorio a la vista</p>
              <p className="mb-6 max-w-md">
                {`No hay envíos programados para el ${format(selectedDate, "d 'de' MMMM", { locale: es })} (citas del ${format(getTargetApptDate(selectedDate), "d 'de' MMMM", { locale: es })}).`}
              </p>
              <Button variant="outline" onClick={() => setSelectedDate(null)}>
                Quitar Selección
              </Button>
            </div>
          )}
        </div>
      </div>
    )}

      <AddRecordatorioModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => combinedRefetch()} 
      />
      
      {editRecord && (
        <EditRecordatorioModal
          isOpen={!!editRecord}
          onClose={() => setEditRecord(null)}
          onSuccess={() => {
            setEditRecord(null);
            combinedRefetch();
          }}
          editRecord={editRecord}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              ¿Eliminar todos los recordatorios?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground py-2 text-base">
              ¿Estás seguro de que deseas eliminar TODOS los recordatorios para el día {selectedDate && format(getTargetApptDate(selectedDate), "d 'de' MMMM", { locale: es })}? 
              <br /><br />
              Esta acción eliminará tanto los enviados como los pendientes de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel className="border-none bg-muted hover:bg-muted/80 text-foreground rounded-xl h-11 px-6">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none rounded-xl h-11 px-6"
              onClick={() => {
                handleDeleteAllForDay();
                setIsDeleteDialogOpen(false);
              }}
            >
              Sí, eliminar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteRecordId} onOpenChange={(open) => !open && setDeleteRecordId(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              ¿Eliminar recordatorio?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground py-2 text-base">
              ¿Estás seguro de que deseas eliminar este recordatorio? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel className="border-none bg-muted hover:bg-muted/80 text-foreground rounded-xl h-11 px-6">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none rounded-xl h-11 px-6"
              onClick={() => {
                if (deleteRecordId) {
                  handleDelete(deleteRecordId);
                  setDeleteRecordId(null);
                }
              }}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
