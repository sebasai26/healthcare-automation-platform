import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EditRecordatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editRecord: any | null;
}

export function EditRecordatorioModal({ isOpen, onClose, onSuccess, editRecord }: EditRecordatorioModalProps) {
  const [saving, setSaving] = useState(false);
  const [fisios, setFisios] = useState<string[]>([]);
  const [servicios, setServicios] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  const [formData, setFormData] = useState<{
    nombre: string;
    telefono: string;
    fechaCita: Date | undefined;
    horaCita: string;
    agenda: string;
    tipoCita: string;
    asunto: string;
  }>({
    nombre: "",
    telefono: "",
    fechaCita: undefined,
    horaCita: "",
    agenda: "none",
    tipoCita: "none",
    asunto: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && fisios.length === 0) {
      fetchData();
    }
  }, [isOpen]);

  // Load record data when modal opens
  useEffect(() => {
    if (isOpen && editRecord) {
      let parsedDate: Date | undefined = undefined;
      
      if (editRecord.fecha_cita) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(editRecord.fecha_cita)) {
          parsedDate = parseISO(editRecord.fecha_cita);
        } else if (editRecord.fecha_cita.includes('/')) {
          const parts = editRecord.fecha_cita.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            parsedDate = new Date(year, month, day);
          }
        } else {
          parsedDate = new Date(editRecord.fecha_cita);
        }
      }

      if (parsedDate && isNaN(parsedDate.getTime())) {
        parsedDate = undefined;
      }

      // Extract start time if it's a range (e.g., "13:30 - 14:20" -> "13:30")
      let horaCitaValue = "";
      if (editRecord.hora_cita) {
        const parts = editRecord.hora_cita.split(/\s*-\s*/);
        const startTime = parts[0].trim();
        // Ensure format is HH:mm
        if (startTime.match(/^\d{1,2}:\d{2}$/)) {
          const [h, m] = startTime.split(':');
          horaCitaValue = `${h.padStart(2, '0')}:${m}`;
        } else {
          horaCitaValue = startTime;
        }
      }

      setFormData({
        nombre: editRecord.nombre || "",
        telefono: editRecord.telefono || "",
        fechaCita: parsedDate,
        horaCita: horaCitaValue,
        agenda: (!editRecord.agenda || editRecord.agenda === "Sin asignar") ? "none" : editRecord.agenda,
        tipoCita: (!editRecord.tipo_cita || editRecord.tipo_cita === "") ? "none" : editRecord.tipo_cita,
        asunto: editRecord.asunto || "",
      });
    }
  }, [isOpen, editRecord]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const year = new Date().getFullYear();
      
      const [fisiosRes, servRes] = await Promise.all([
        (supabase as any).from('citas_profesional').select('usuario').eq('anio', year),
        (supabase as any).from('listado_citas').select('servicio').eq('anio', year).limit(2000)
      ]);
      
      if (fisiosRes.error) throw fisiosRes.error;
      if (servRes.error) throw servRes.error;
      
      const uniqueFisios = Array.from(new Set(fisiosRes.data?.map((d: any) => d.usuario?.trim()).filter(Boolean) as string[]));
      
      // Ensure the current record's agenda is in the list
      if (editRecord?.agenda && editRecord.agenda !== "Sin asignar" && !uniqueFisios.includes(editRecord.agenda)) {
        uniqueFisios.push(editRecord.agenda);
      }

      uniqueFisios.sort();
      setFisios(uniqueFisios);

      const uniqueServicios = Array.from(new Set(servRes.data?.map((d: any) => d.servicio?.trim()).filter(Boolean) as string[]));
      
      // Ensure current record's service is in the list if applicable
      if (editRecord?.tipo_cita && !uniqueServicios.includes(editRecord.tipo_cita)) {
        uniqueServicios.push(editRecord.tipo_cita);
      }

      uniqueServicios.sort();
      setServicios(uniqueServicios);
    } catch (e) {
      console.error("Error al cargar datos", e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.telefono || !formData.fechaCita || !formData.horaCita || !editRecord) {
      toast({
        title: "Campos obligatorios",
        description: "El teléfono, la fecha y la hora son obligatorios.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const dbDate = format(formData.fechaCita, 'yyyy-MM-dd'); // YYYY-MM-DD

      const updateData = {
        nombre: formData.nombre || "Sin especificar",
        telefono: formData.telefono,
        fecha_cita: dbDate,
        hora_cita: formData.horaCita,
        agenda: formData.agenda === "none" ? "Sin asignar" : formData.agenda,
        tipo_cita: formData.tipoCita === "none" ? "" : formData.tipoCita,
        asunto: formData.asunto,
      };

      const { error } = await (supabase as any)
        .from('recordatorios_cita')
        .update(updateData)
        .eq('id', editRecord.id);

      if (error) throw error;

      toast({
        title: "Recordatorio actualizado",
        description: "Los cambios se han guardado correctamente."
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating recordatorio:", error);
      toast({
        title: "Error al guardar",
        description: error.message || "Por favor, inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Generar opciones de hora de 8:30 a 20:00 (cada 30 min)
  const timeOptions = useMemo(() => {
    const times = [];
    const startHour = 8;
    const startMinute = 30;
    const endHour = 20;
    const endMinute = 0;

    let currHour = startHour;
    let currMin = startMinute;

    while (currHour < endHour || (currHour === endHour && currMin <= endMinute)) {
      const h = currHour.toString().padStart(2, '0');
      const m = currMin.toString().padStart(2, '0');
      times.push({ value: `${h}:${m}`, label: `${h}:${m} h` });

      currMin += 30;
      if (currMin >= 60) {
        currHour++;
        currMin = 0;
      }
    }
    return times;
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Recordatorio</DialogTitle>
          <DialogDescription>
            Modifica los detalles de este recordatorio programado.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-nombre" className="text-right text-sm">
              Nombre <span className="block text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Input 
              id="edit-nombre" 
              className="col-span-3"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-telefono" className="text-right text-sm font-semibold">
              Teléfono <span className="text-destructive">*</span>
            </Label>
            <Input 
              id="edit-telefono" 
              className="col-span-3"
              value={formData.telefono}
              onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-fecha" className="text-right text-sm font-semibold">
              Fecha <span className="text-destructive">*</span>
            </Label>
            <div className="col-span-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.fechaCita && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.fechaCita ? format(formData.fechaCita, "PPP", { locale: es }) : <span>Seleccionar día</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.fechaCita}
                    onSelect={(d) => setFormData(p => ({ ...p, fechaCita: d }))}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-hora" className="text-right text-sm font-semibold">
              Hora <span className="text-destructive">*</span>
            </Label>
            <div className="col-span-3">
              <Select value={formData.horaCita} onValueChange={(v) => setFormData(p => ({ ...p, horaCita: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-tipoCita" className="text-right text-sm">
              Tipo <span className="block text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <div className="col-span-3">
              <Select value={formData.tipoCita} onValueChange={(v) => setFormData(p => ({ ...p, tipoCita: v }))}>
                <SelectTrigger disabled={loadingData}>
                  <SelectValue placeholder={loadingData ? "Cargando..." : "Ninguno"} />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {servicios.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-asunto" className="text-right text-sm">
              Asunto <span className="block text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Input 
              id="edit-asunto" 
              className="col-span-3"
              value={formData.asunto}
              onChange={(e) => setFormData(prev => ({ ...prev, asunto: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-agenda" className="text-right text-sm">
              Fisio <span className="block text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <div className="col-span-3">
              <Select value={formData.agenda} onValueChange={(v) => setFormData(p => ({ ...p, agenda: v }))}>
                <SelectTrigger disabled={loadingData}>
                  <SelectValue placeholder={loadingData ? "Cargando..." : "Ninguno asignado"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {fisios.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleEdit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Guardar Cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
