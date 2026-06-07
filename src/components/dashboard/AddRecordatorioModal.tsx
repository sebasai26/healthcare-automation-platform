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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AddRecordatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRecordatorioModal({ isOpen, onClose, onSuccess }: AddRecordatorioModalProps) {
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
      uniqueFisios.sort();
      setFisios(uniqueFisios);

      const uniqueServicios = Array.from(new Set(servRes.data?.map((d: any) => d.servicio?.trim()).filter(Boolean) as string[]));
      uniqueServicios.sort();
      setServicios(uniqueServicios);
    } catch (e) {
      console.error("Error al cargar datos", e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.telefono || !formData.fechaCita || !formData.horaCita) {
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

      const insertData = {
        nombre: formData.nombre || "Sin especificar",
        telefono: formData.telefono,
        fecha_cita: dbDate,
        hora_cita: formData.horaCita,
        agenda: formData.agenda === "none" ? "Sin asignar" : formData.agenda,
        tipo_cita: formData.tipoCita === "none" ? "" : formData.tipoCita,
        asunto: formData.asunto,
        estado: 'Pendiente',
        estado_recordatorio: 'Por enviar',
        clinic_id: 'marbellafisio'
      };

      const { error } = await (supabase as any).from('recordatorios_cita').insert([insertData]);

      if (error) throw error;

      toast({
        title: "Recordatorio añadido",
        description: "La cita se ha guardado correctamente para los recordatorios."
      });

      setFormData({
        nombre: "",
        telefono: "",
        fechaCita: undefined,
        horaCita: "",
        agenda: "none",
        tipoCita: "none",
        asunto: "",
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating recordatorio:", error);
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
          <DialogTitle>Añadir Recordatorio Manual</DialogTitle>
          <DialogDescription>
            Configura una cita pendiente para que se le envíe un mensaje recordatorio por WhatsApp.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nombre" className="text-right text-sm">
              Nombre <span className="block text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Input 
              id="nombre" 
              className="col-span-3"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="telefono" className="text-right text-sm font-semibold">
              Teléfono <span className="text-destructive">*</span>
            </Label>
            <Input 
              id="telefono" 
              className="col-span-3"
              value={formData.telefono}
              onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fecha" className="text-right text-sm font-semibold">
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
            <Label htmlFor="hora" className="text-right text-sm font-semibold">
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
            <Label htmlFor="tipoCita" className="text-right text-sm">
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
            <Label htmlFor="asunto" className="text-right text-sm">
              Asunto <span className="block text-[10px] text-muted-foreground font-normal">(Opcional)</span>
            </Label>
            <Input 
              id="asunto" 
              className="col-span-3"
              value={formData.asunto}
              onChange={(e) => setFormData(prev => ({ ...prev, asunto: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="agenda" className="text-right text-sm">
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
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Guardar Recordatorio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
