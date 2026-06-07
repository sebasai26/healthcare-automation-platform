import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  User, 
  Clock, 
  Euro, 
  FileText, 
  History, 
  Loader2,
  CheckCircle2,
  Save,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Edit2, Trash2 } from "lucide-react";

// Matches the real Supabase table structure
interface AlquilerRecord {
  id: string;
  created_at: string;
  num_factura: string;
  nombre_cliente: string;
  nif_cliente: string;
  direccion_cliente: string;
  base: number;
  iva: number;
  retencion: number;
  total: number;
  fecha_alquilerdia: string;
  fecha_envio?: string | null;
  anio: number;
  mes: string;
  factura_enviada: string | boolean;
}

const HOURLY_RATE_TOTAL = 16.5; // Precio por hora final (Total factura)
const IVA_RATE = 0.21;
const RETENCION_RATE = 0.19;

// Known clients from the database
const KNOWN_CLIENTS = [
  { nombre: "Navarro Yebra David", nif: "50615144X", direccion: "avd joan margarit n72atico b" },
  { nombre: "Isabel María Cintrano Benítez", nif: "78968565C", direccion: "Calle Javier Arraiza once cuartos a 29603 Marbella" },
];

const STORAGE_KEY = "alquiler_custom_clients";

interface CustomClient {
  nombre: string;
  nif: string;
  direccion: string;
}

function getCustomClients(): CustomClient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomClient(client: CustomClient) {
  const current = getCustomClients();
  const exists = current.some(c => c.nombre.toLowerCase() === client.nombre.toLowerCase());
  if (!exists) {
    current.push(client);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

export function AlquilerSalaSection({ selectedYear }: { selectedYear: number }) {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [editingRecord, setEditingRecord] = useState<AlquilerRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState<CustomClient>({ nombre: "", nif: "", direccion: "" });
  const [customClients, setCustomClients] = useState<CustomClient[]>(getCustomClients());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing invoices
  const { data: rentals, isLoading, error: fetchError } = useQuery({
    queryKey: ['alquiler_sala', selectedYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('alquiler_sala')
        .select('*')
        .eq('anio', selectedYear)
        .order('fecha_alquilerdia', { ascending: false });

      if (error) {
        console.error("Error fetching alquiler_sala:", error);
        throw new Error(error.message || "Error desconocido al cargar alquiler_sala");
      }
      return data as AlquilerRecord[];
    },
    retry: 1,
  });

  // Get unique client names from DB data + known clients + custom clients
  const allKnownClients = useMemo(() => {
    return [...KNOWN_CLIENTS, ...customClients];
  }, [customClients]);

  const clients = useMemo(() => {
    const names = new Set(allKnownClients.map(c => c.nombre));
    rentals?.forEach(r => r.nombre_cliente && names.add(r.nombre_cliente));
    return Array.from(names);
  }, [rentals, allKnownClients]);

  const getClientInfo = (name: string) => {
    // 1. Check hardcoded + localStorage clients
    const known = allKnownClients.find(c => c.nombre === name);
    if (known) return known;
    // 2. Fallback: look up from existing Supabase rental records (works on any device)
    const fromRentals = rentals?.find(r => r.nombre_cliente === name);
    if (fromRentals) {
      return {
        nombre: fromRentals.nombre_cliente,
        nif: fromRentals.nif_cliente || "",
        direccion: fromRentals.direccion_cliente || "",
      };
    }
    return null;
  };

  const handleAddNewClient = () => {
    if (!newClientForm.nombre.trim()) {
      toast({ title: "Nombre obligatorio", description: "Introduce el nombre del cliente.", variant: "destructive" });
      return;
    }
    if (!newClientForm.nif.trim()) {
      toast({ title: "NIF obligatorio", description: "Introduce el NIF/CIF del cliente.", variant: "destructive" });
      return;
    }
    saveCustomClient(newClientForm);
    setCustomClients(getCustomClients());
    setSelectedClient(newClientForm.nombre);
    setNewClientForm({ nombre: "", nif: "", direccion: "" });
    setShowNewClientDialog(false);
    toast({ title: "Cliente añadido", description: `"${newClientForm.nombre}" guardado correctamente.` });
  };

  // Helper to check if an invoice is sent or pending
  // We handle both boolean and string values for compatibility
  const isInvoiceSent = (r: AlquilerRecord) => {
    if (!r.factura_enviada) return false;
    const val = String(r.factura_enviada).trim().toLowerCase();
    return val === "true" || val.startsWith("envia");
  };

  const isInvoicePending = (r: AlquilerRecord) => {
    if (!r.factura_enviada) return true;
    const val = String(r.factura_enviada).trim().toLowerCase();
    return val === "false" || val === "pendiente" || val === "" || (!val.startsWith("envia") && val !== "true");
  };

  // Calculate next invoice number
  const nextInvoiceNumber = useMemo(() => {
    if (!rentals) return "";
    
    // If a client is selected, check if they already have an invoice this month
    if (selectedClient && date) {
      const targetDate = parseISO(date);
      const existing = rentals.find(r => 
        r.nombre_cliente === selectedClient && 
        isSameMonth(parseISO(r.fecha_alquilerdia), targetDate) &&
        isInvoicePending(r)
      );
      if (existing) return existing.num_factura;
    }

    // Otherwise, generate the next global number in sequence
    if (rentals.length === 0) return `S${String(selectedYear).slice(2)}_01`;
    
    // Count unique invoice numbers used in the whole year
    const uniqueNums = new Set(rentals.map(r => r.num_factura));
    const nums = Array.from(uniqueNums)
      .map(n => {
        const match = n?.match(/_(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    return `S${String(selectedYear).slice(2)}_${String(maxNum + 1).padStart(2, '0')}`;
  }, [rentals, selectedYear, selectedClient, date]);

  // Next global invoice number (for display/reference)
  const nextGlobalInvoiceNumber = useMemo(() => {
    if (!rentals || rentals.length === 0) return `S${String(selectedYear).slice(2)}_01`;
    const uniqueNums = new Set(rentals.map(r => r.num_factura));
    const nums = Array.from(uniqueNums)
      .map(n => {
        const match = n?.match(/_(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    return `S${String(selectedYear).slice(2)}_${String(maxNum + 1).padStart(2, '0')}`;
  }, [rentals, selectedYear]);

  // Add new rental record
  const addRentalMutation = useMutation({
    mutationFn: async (newRecord: Partial<AlquilerRecord>) => {
      const { data, error } = await (supabase as any)
        .from('alquiler_sala')
        .insert([newRecord]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alquiler_sala'] });
      toast({ title: "Registro guardado", description: "La factura de alquiler se ha guardado correctamente." });
      setHours("");
      setTotalInput("");
    },
    onError: (error) => {
      toast({ title: "Error", description: "No se pudo guardar: " + error.message, variant: "destructive" });
    }
  });

  const handleAdd = () => {
    if (!selectedClient || (!hours && !totalInput) || !date) {
      toast({ title: "Datos incompletos", description: "Por favor, selecciona cliente y horas/total.", variant: "destructive" });
      return;
    }

    const base = calculatedBase;
    const iva = calculatedIva;
    const retencion = calculatedRetencion;
    const total = calculatedTotal;
    
    if (total <= 0) {
      toast({ title: "Error", description: "El importe debe ser mayor que cero.", variant: "destructive" });
      return;
    }
    const parsedDate = new Date(date);
    const mes = MONTH_NAMES[parsedDate.getMonth()];
    const clientInfo = getClientInfo(selectedClient);

    const newRecord: any = {
      num_factura: nextInvoiceNumber,
      nombre_cliente: selectedClient,
      nif_cliente: clientInfo?.nif || "",
      direccion_cliente: clientInfo?.direccion || "",
      base: Math.round(calculatedBase * 100) / 100,
      iva: Math.round(calculatedIva * 100) / 100,
      retencion: Math.round(calculatedRetencion * 100) / 100,
      total: Math.round(calculatedTotal * 100) / 100,
      fecha_alquilerdia: date,
      fecha_envio: null,
      anio: parsedDate.getFullYear(),
      mes: mes,
      factura_enviada: false,
    };

    addRentalMutation.mutate(newRecord);
  };

  // Delete rental record
  const deleteRentalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('alquiler_sala')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alquiler_sala'] });
      toast({ title: "Registro eliminado", description: "El registro de alquiler ha sido borrado." });
      setDeletingRecordId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "No se pudo eliminar: " + error.message, variant: "destructive" });
    }
  });

  // Update rental record
  const updateRentalMutation = useMutation({
    mutationFn: async (updated: AlquilerRecord) => {
      const { id, created_at, ...updateData } = updated;
      const { error } = await (supabase as any)
        .from('alquiler_sala')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alquiler_sala'] });
      toast({ title: "Registro actualizado", description: "Los cambios se han guardado correctamente." });
      setEditingRecord(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "No se pudo actualizar: " + error.message, variant: "destructive" });
    }
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    // Recalculate based on hours if they changed
    const parsedDate = new Date(editingRecord.fecha_alquilerdia);
    const mes = MONTH_NAMES[parsedDate.getMonth()];
    
    updateRentalMutation.mutate({
      ...editingRecord,
      mes: mes,
      anio: parsedDate.getFullYear(),
    });
  };

  const [totalInput, setTotalInput] = useState<string>("");

  // Calculated preview
  const { calculatedBase, calculatedIva, calculatedRetencion, calculatedTotal } = useMemo(() => {
    let base = 0;
    const h = parseFloat(hours);
    const t = parseFloat(totalInput);

    if (!isNaN(h) && h > 0) {
        // h represent hours, target is HOURLY_RATE_TOTAL per hour (Total factura)
        base = (h * HOURLY_RATE_TOTAL) / (1 + IVA_RATE - RETENCION_RATE);
    } else if (!isNaN(t) && t > 0) {
        // total = base * (1 + 0.21 - 0.19)
        base = t / (1 + IVA_RATE - RETENCION_RATE);
    }

    const iva = base * IVA_RATE;
    const ret = base * RETENCION_RATE;
    const total = base + iva - ret;

    return {
        calculatedBase: base,
        calculatedIva: iva,
        calculatedRetencion: ret,
        calculatedTotal: total
    };
  }, [hours, totalInput]);

  // Invoices currently being accumulated (not sent)
  const currentMonthRentals = useMemo(() => {
    if (!rentals) return [];
    return rentals.filter(r => isInvoicePending(r));
  }, [rentals]);

  // Filter for history (only sent invoices) grouped by invoice number
  const historyRentals = useMemo(() => {
    if (!rentals) return [];
    
    const sent = rentals.filter(r => isInvoiceSent(r));
    const groups: Record<string, AlquilerRecord & { count: number }> = {};
    
    sent.forEach(r => {
      const key = r.num_factura;
      if (!groups[key]) {
        groups[key] = { ...r, count: 1 };
      } else {
        groups[key].base += r.base;
        groups[key].iva += r.iva;
        groups[key].retencion += r.retencion;
        groups[key].total += r.total;
        if (r.fecha_envio && (!groups[key].fecha_envio || new Date(r.fecha_envio) > new Date(groups[key].fecha_envio!))) {
          groups[key].fecha_envio = r.fecha_envio;
        }
        // También mantenemos la fecha de alquiler más reciente para referencia si fuera necesario
        if (new Date(r.fecha_alquilerdia) > new Date(groups[key].fecha_alquilerdia)) {
          groups[key].fecha_alquilerdia = r.fecha_alquilerdia;
        }
      }
    });

    // Aseguramos que los valores sumados se redondeen correctamente
    return Object.values(groups).map(g => ({
      ...g,
      base: Math.round(g.base * 100) / 100,
      iva: Math.round(g.iva * 100) / 100,
      retencion: Math.round(g.retencion * 100) / 100,
      total: Math.round(g.total * 100) / 100
    })).sort((a, b) => b.num_factura.localeCompare(a.num_factura));
  }, [rentals]);

  // Invoice preview grouped by invoice number instead of just client, to handle potential splits
  const invoicePreview = useMemo(() => {
    const groups: Record<string, { client: string; base: number; iva: number; retencion: number; total: number; count: number; records: AlquilerRecord[] }> = {};
    currentMonthRentals.forEach(r => {
      const key = r.num_factura; // Use num_factura as key to group everything sharing the ID
      if (!groups[key]) groups[key] = { client: r.nombre_cliente, base: 0, iva: 0, retencion: 0, total: 0, count: 0, records: [] };
      groups[key].base += r.base;
      groups[key].iva += r.iva;
      groups[key].retencion += r.retencion;
      groups[key].total += r.total;
      groups[key].count += 1;
      groups[key].records.push(r);
    });
    return groups;
  }, [currentMonthRentals]);

  return (
    <div className="space-y-8 animate-fade-in">
      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm">
          <p className="font-bold mb-1">Error al cargar datos de alquiler</p>
          <p className="text-xs opacity-80">{fetchError.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario de registro */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Registrar Alquiler</h3>
              <p className="text-xs text-muted-foreground">Añade un registro de alquiler de sala · Factura: <span className="font-bold text-primary">{nextInvoiceNumber}</span></p>
              <p className="text-[10px] text-muted-foreground italic">Próximo número en secuencia: {nextGlobalInvoiceNumber}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Cliente
              </label>
              <Select value={selectedClient} onValueChange={(v) => {
                if (v === '__new_client__') {
                  setShowNewClientDialog(true);
                } else {
                  setSelectedClient(v);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__new_client__" className="text-primary font-semibold border-t border-border mt-1 pt-1">
                    + Nuevo cliente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  Fecha alquiler
                </label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Horas
                </label>
                <Input 
                  type="number" 
                  placeholder="0.0" 
                  value={hours} 
                  onChange={(e) => {
                      const h = e.target.value;
                      setHours(h);
                      if (h) setTotalInput(""); // Clear the other one to avoid confusion
                  }}
                  step="any"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Euro className="w-4 h-4 text-muted-foreground" />
                  Total que paga
                </label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={totalInput} 
                  onChange={(e) => {
                      const t = e.target.value;
                      setTotalInput(t);
                      if (t) setHours(""); // Clear the other one
                  }}
                  step="any"
                />
              </div>
              <p className="col-span-2 text-[10px] text-muted-foreground text-center italic">Calcula automáticamente por Horas O por Total (no hace falta rellenar ambos)</p>
            </div>

            <div className="bg-muted/50 p-4 rounded-xl border border-border space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Desglose (16,50€/hora total)</p>
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">Base imponible:</span>
                <span className="text-right font-medium">{calculatedBase.toFixed(2)}€</span>
                <span className="text-muted-foreground">IVA (21%):</span>
                <span className="text-right font-medium">+{calculatedIva.toFixed(2)}€</span>
                <span className="text-muted-foreground">Retención (19%):</span>
                <span className="text-right font-medium">-{calculatedRetencion.toFixed(2)}€</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="text-sm font-bold">Total factura:</span>
                <span className="text-2xl font-black text-foreground">{calculatedTotal.toFixed(2)}€</span>
              </div>
            </div>

            <Button 
              className="w-full gap-2 h-11 text-base font-semibold shadow-md"
              onClick={handleAdd}
              disabled={addRentalMutation.isPending}
            >
              {addRentalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Registro
            </Button>
          </div>
        </div>

        {/* Vista previa de factura del mes */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Resumen del Mes</h3>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">{format(new Date(), "MMMM yyyy", { locale: es })}</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
              {Object.keys(invoicePreview).length} pendiente(s)
            </Badge>
          </div>

          <div className="flex-1 space-y-4">
            {Object.keys(invoicePreview).length > 0 ? (
              Object.entries(invoicePreview).map(([invoiceNum, data]) => (
                <div key={invoiceNum} className="space-y-3 p-4 rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div>
                      <h4 className="font-bold text-foreground text-lg">{data.client}</h4>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-[10px] text-primary font-bold bg-primary/5 px-2 py-0.5 rounded">Factura: {invoiceNum}</span>
                         <span className="text-xs text-muted-foreground">{data.count} registros acumulados</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-foreground">{data.total.toFixed(2)}€</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Acumulado</p>
                    </div>
                  </div>

                  {/* Individual records list */}
                  <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                    {data.records.map((record) => (
                      <div key={record.id} className="flex items-center justify-between text-xs p-2 bg-background rounded-lg border border-border/50">
                        <div className="flex items-center gap-3">
                           <span className="font-medium text-muted-foreground">{format(parseISO(record.fecha_alquilerdia), "dd MMM", { locale: es })}</span>
                           <span className="font-bold">{record.total.toFixed(2)}€</span>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => setEditingRecord(record)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingRecordId(record.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center py-2 px-4 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="text-[11px] font-medium text-primary flex items-center gap-2 italic">
                      <Clock className="w-3.5 h-3.5" /> La factura se enviará por WhatsApp automáticamente el día 29 de cada mes.
                    </p>
                  </div>                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl opacity-60 h-full">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay facturas pendientes este mes.</p>
                <p className="text-[10px]">Añade registros para ver el resumen.</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
             <div className="text-xs text-muted-foreground flex items-center gap-1">
               <History className="w-3 h-3" /> Datos actualizados a hoy
             </div>
             <p className="text-sm font-bold text-foreground">
               Total mes: {Object.values(invoicePreview).reduce((s, v) => s + v.total, 0).toFixed(2)}€
             </p>
          </div>
        </div>
      </div>

      {/* Historial de facturas */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/10">
          <div className="flex items-center gap-3">
             <Receipt className="w-5 h-5 text-muted-foreground" />
             <h3 className="font-bold text-foreground underline decoration-primary/30 decoration-2 underline-offset-4">Historial de Facturas</h3>
          </div>
          <Badge variant="outline" className="text-xs">{selectedYear}</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Nº Factura</TableHead>
                <TableHead>Fecha de envío</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Retención</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Cargando historial...
                  </TableCell>
                </TableRow>
              ) : !historyRentals || historyRentals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No hay facturas finalizadas en el historial para {selectedYear}. Las citas de este mes aparecen en el resumen superior.
                  </TableCell>
                </TableRow>
              ) : (
                historyRentals.map((r: any) => (
                  <TableRow key={r.num_factura} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold text-primary">
                      {r.num_factura}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.fecha_envio ? format(parseISO(r.fecha_envio), "d MMM, yyyy", { locale: es }) : "No enviado"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-primary/70 bg-primary/5">{r.nombre_cliente}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.base.toFixed(2)}€</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.iva.toFixed(2)}€</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.retencion.toFixed(2)}€</TableCell>
                    <TableCell className="text-right font-black text-foreground">{r.total.toFixed(2)}€</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setEditingRecord(r)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingRecordId(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro de Alquiler</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente</label>
                <Select 
                  value={editingRecord.nombre_cliente} 
                  onValueChange={(v) => {
                    const c = KNOWN_CLIENTS.find(ki => ki.nombre === v);
                    setEditingRecord({
                      ...editingRecord, 
                      nombre_cliente: v,
                      nif_cliente: c?.nif || "",
                      direccion_cliente: c?.direccion || ""
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha</label>
                  <Input 
                    type="date" 
                    value={editingRecord.fecha_alquilerdia} 
                    onChange={(e) => setEditingRecord({...editingRecord, fecha_alquilerdia: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Envío</label>
                  <Input 
                    type="date" 
                    value={editingRecord.fecha_envio || ""} 
                    onChange={(e) => setEditingRecord({...editingRecord, fecha_envio: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Horas</label>
                  <Input 
                    type="number" 
                    step="any"
                    value={Math.round((editingRecord.total / HOURLY_RATE_TOTAL) * 100) / 100} 
                    onChange={(e) => {
                      const h = parseFloat(e.target.value) || 0;
                      if (h < 0) return;
                      const base = (h * HOURLY_RATE_TOTAL) / (1 + IVA_RATE - RETENCION_RATE);
                      const iva = base * IVA_RATE;
                      const ret = base * RETENCION_RATE;
                      setEditingRecord({
                        ...editingRecord, 
                        base: Math.round(base * 100) / 100, 
                        iva: Math.round(iva * 100) / 100, 
                        retencion: Math.round(ret * 100) / 100,
                        total: Math.round((base + iva - ret) * 100) / 100
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total que paga (€)</label>
                  <Input 
                    type="number" 
                    step="any"
                    value={editingRecord.total || ""} 
                    onChange={(e) => {
                      const t = parseFloat(e.target.value) || 0;
                      if (t < 0) return;
                      // Total = Base * (1 + IVA - RET) -> Base = Total / (1 + IVA - RET)
                      const base = t / (1 + IVA_RATE - RETENCION_RATE);
                      const iva = base * IVA_RATE;
                      const ret = base * RETENCION_RATE;
                      setEditingRecord({
                        ...editingRecord, 
                        base: Math.round(base * 100) / 100, 
                        iva: Math.round(iva * 100) / 100, 
                        retencion: Math.round(ret * 100) / 100,
                        total: t
                      });
                    }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground flex justify-center italic">Calcula por Horas O por Total (ambos se mantienen sincronizados)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nº Factura</label>
                  <Input 
                    value={editingRecord.num_factura} 
                    onChange={(e) => setEditingRecord({...editingRecord, num_factura: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Imponible (€)</label>
                  <Input 
                    type="number"
                    step="any"
                    value={editingRecord.base} 
                    onChange={(e) => {
                      const base = parseFloat(e.target.value) || 0;
                      const iva = base * IVA_RATE;
                      const ret = base * RETENCION_RATE;
                      setEditingRecord({
                        ...editingRecord, 
                        base, 
                        iva: Math.round(iva * 100) / 100, 
                        retencion: Math.round(ret * 100) / 100,
                        total: Math.round((base + iva - ret) * 100) / 100
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total Final (€)</label>
                  <Input value={editingRecord.total} disabled className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <div className="flex items-center gap-2 pt-1 text-sm">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4"
                      checked={isInvoiceSent(editingRecord)} 
                      onChange={(e) => {
                        const isSent = e.target.checked;
                        setEditingRecord({
                          ...editingRecord, 
                          factura_enviada: isSent ? "Enviada" : "false",
                          fecha_envio: isSent ? format(new Date(), "yyyy-MM-dd") : null
                        });
                      }}
                    />
                    <span>Factura enviada / Finalizada</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setEditingRecord(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateRentalMutation.isPending}>
                  {updateRentalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRecordId} onOpenChange={(open) => !open && setDeletingRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se borrará permanentemente el registro de alquiler seleccionado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingRecordId && deleteRentalMutation.mutate(deletingRecordId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Client Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={(open) => !open && setShowNewClientDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre completo *</label>
              <Input
                placeholder="Ej: García López Juan"
                value={newClientForm.nombre}
                onChange={(e) => setNewClientForm({ ...newClientForm, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">NIF / CIF *</label>
              <Input
                placeholder="Ej: 12345678A"
                value={newClientForm.nif}
                onChange={(e) => setNewClientForm({ ...newClientForm, nif: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dirección</label>
              <Input
                placeholder="Ej: Calle Mayor 1, 29601 Marbella"
                value={newClientForm.direccion}
                onChange={(e) => setNewClientForm({ ...newClientForm, direccion: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" onClick={() => setShowNewClientDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddNewClient}>Guardar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

