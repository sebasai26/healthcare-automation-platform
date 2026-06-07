import { useState, useMemo } from "react";
import { toTitleCase } from "@/lib/name-utils";
import { Copy, Phone, Minus, Plus, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePacientesInactivos, type PacienteInactivo, type FiltroTiempo, type FiltroContacto } from "@/hooks/usePacientesInactivos";
import { useToast } from "@/hooks/use-toast";

const tiempoOptions: { value: FiltroTiempo; label: string }[] = [
  { value: "1mes", label: "Menos de 1 mes" },
  { value: "2meses", label: "Menos de 2 meses" },
  { value: "3meses", label: "Menos de 3 meses" },
  { value: "4meses", label: "Menos de 4 meses" },
  { value: "5meses", label: "Menos de 5 meses" },
  { value: "6meses", label: "Menos de 6 meses" },
  { value: "9meses", label: "Menos de 9 meses" },
  { value: "12meses", label: "Menos de 1 año" },
  { value: "24meses", label: "Menos de 2 años" },
];

const contactoOptions: { value: FiltroContacto; label: string }[] = [
  { value: "todos", label: "Todos los pacientes" },
  { value: "contactados", label: "Contactados" },
  { value: "sin_contactar", label: "Sin contactar" },
];

const mostrarMasOptions = [
  { value: 20, label: "Mostrar 20 más" },
  { value: 100, label: "Mostrar 100 más" },
  { value: 200, label: "Mostrar 200 más" },
  { value: 300, label: "Mostrar 300 más" },
  { value: 400, label: "Mostrar 400 más" },
  { value: -1, label: "Mostrar todos" },
];

export function RecaptacionTab() {
  const { toast } = useToast();
  const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>("1mes");
  const [filtroContacto, setFiltroContacto] = useState<FiltroContacto>("todos");
  const [visibleCount, setVisibleCount] = useState(5);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filtroFisio, setFiltroFisio] = useState<string>("todos");

  // Fetch all data at once (no pagination)
  const { data, isLoading, error } = usePacientesInactivos(
    filtroTiempo,
    filtroContacto,
    1,
    999999 // Get all results
  );

  const totalCount = data?.totalCount || 0;
  const allPacientes = data?.pacientes || [];

  const physios = useMemo(() => {
    if (!allPacientes.length) return [];
    const set = new Set(allPacientes.map(p => toTitleCase(p.fisio_ultima_cita || "Sin asignar")));
    return Array.from(set).sort();
  }, [allPacientes]);

  // Apply search and fisio filters
  const searchFiltered = allPacientes.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    const name = (p.paciente_nombre || "").toLowerCase();
    const tel = (p.paciente_telefono || "").replace(/\D/g, "");
    const num = (p.numero_paciente || "").toLowerCase();
    
    const fisioName = toTitleCase(p.fisio_ultima_cita || "Sin asignar");
    const matchesFisio = filtroFisio === "todos" || fisioName === filtroFisio;
    
    if (q) {
      return matchesFisio && (name.includes(q) || tel.includes(q) || num.includes(q));
    }
    return matchesFisio;
  });

  const visiblePacientes = visibleCount === -1 
    ? searchFiltered 
    : searchFiltered.slice(0, visibleCount);
  const hasMore = visibleCount !== -1 && visibleCount < searchFiltered.length;

  const handleMostrarMas = (cantidad: number) => {
    if (cantidad === -1) {
      setVisibleCount(-1); // Show all
    } else {
      setVisibleCount(prev => prev === -1 ? cantidad : prev + cantidad);
    }
  };

  const handleDecrementContact = (telefono: string) => {
    setContactCounts(prev => ({
      ...prev,
      [telefono]: Math.max(0, (prev[telefono] || 0) - 1)
    }));
  };

  const handleIncrementContact = (telefono: string) => {
    setContactCounts(prev => ({
      ...prev,
      [telefono]: (prev[telefono] || 0) + 1
    }));
  };

  const buildWhatsAppUrl = (rawPhone: string | null | undefined) => {
    // Solo dígitos (quita espacios, guiones, paréntesis, +, etc.)
    let telefono = (rawPhone || "").replace(/\D/g, "");
    if (!telefono) return null;

    // Si parece un móvil español sin prefijo (9 dígitos), añadir 34.
    if (telefono.length === 9) {
      telefono = `34${telefono}`;
    }

    // WhatsApp suele redirigir internamente, pero este formato es el recomendado.
    return `https://wa.me/${telefono}`;
  };

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    ta.remove();
  };

  const handleContactar = (paciente: PacienteInactivo) => {
    const url = buildWhatsAppUrl(paciente.paciente_telefono);
    if (!url) return;

    // En lugar de abrir una pestaña nueva (que a menudo se bloquea), mostramos siempre el diálogo
    // para copiar el enlace y abrirlo manualmente.
    setFallbackUrl(url);

    handleIncrementContact(paciente.paciente_telefono);
  };

  const handleCopiarEnlace = async (paciente: PacienteInactivo) => {
    const url = buildWhatsAppUrl(paciente.paciente_telefono);
    if (!url) return;
    try {
      await copyToClipboard(url);
      toast({
        title: "Enlace copiado",
        description: "Pégalo en una pestaña nueva del navegador para abrir el chat.",
      });
    } catch {
      setFallbackUrl(url);
    }
  };

  const getContactCount = (telefono: string): number => {
    return contactCounts[telefono] || 0;
  };

  // Reset visible count when filters change
  const handleFiltroTiempoChange = (v: FiltroTiempo) => {
    setFiltroTiempo(v);
    setVisibleCount(5);
  };

  const handleFiltroContactoChange = (v: FiltroContacto) => {
    setFiltroContacto(v);
    setVisibleCount(5);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="kpi-card">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpi-card">
        <p className="text-muted-foreground text-center py-8">
          Error cargando datos de pacientes. Sube un archivo de listado de citas primero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dialog open={!!fallbackUrl} onOpenChange={(open) => setFallbackUrl(open ? fallbackUrl : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No se pudo abrir WhatsApp</DialogTitle>
            <DialogDescription>
              En algunos entornos el navegador bloquea WhatsApp. Usa este enlace (puedes copiarlo con un clic):
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input readOnly value={fallbackUrl ?? ""} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!fallbackUrl) return;
                try {
                  await copyToClipboard(fallbackUrl);
                  toast({ title: "Enlace copiado" });
                } catch {
                  toast({
                    variant: "destructive",
                    title: "No se pudo copiar automáticamente",
                    description: "Selecciona el enlace y cópialo manualmente.",
                  });
                }
              }}
            >
              <Copy className="w-4 h-4" />
              Copiar enlace
            </Button>
            <Button type="button" onClick={() => setFallbackUrl(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          <h4 className="font-medium text-foreground">
            Pacientes Inactivos - Recaptación
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Tiempo sin venir</span>
            <Select 
              value={filtroTiempo} 
              onValueChange={(v) => handleFiltroTiempoChange(v as FiltroTiempo)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiempoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Filtro por contactos</span>
            <Select 
              value={filtroContacto} 
              onValueChange={(v) => handleFiltroContactoChange(v as FiltroContacto)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contactoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fisio Filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Filtro por fisio</span>
            <Select 
              value={filtroFisio} 
              onValueChange={(v) => { setFiltroFisio(v); setVisibleCount(5); }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los fisios</SelectItem>
                {physios.map((fisio) => (
                  <SelectItem key={fisio} value={fisio}>
                    {fisio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o Nº paciente..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(5); }}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          Mostrando {visiblePacientes.length} de {searchFiltered.length} pacientes
          {searchQuery.trim() && searchFiltered.length !== totalCount && ` (${totalCount} total)`}
        </p>
      )}

      {/* Table */}
      {visiblePacientes.length > 0 ? (
        <div className="kpi-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Paciente</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Fisio</TableHead>
                <TableHead>Tiempo inactivo</TableHead>
                <TableHead className="text-center">Contactos</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePacientes.map((paciente, index) => (
                <TableRow key={`${paciente.paciente_telefono}-${index}`}>
                  <TableCell className="font-medium text-primary">
                    {paciente.numero_paciente || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {toTitleCase(paciente.paciente_nombre)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {paciente.paciente_telefono || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {toTitleCase(paciente.fisio_ultima_cita || "Sin asignar")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {paciente.tiempo_inactivo_texto}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDecrementContact(paciente.paciente_telefono)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="min-w-[20px] text-center font-medium">
                        {getContactCount(paciente.paciente_telefono)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleIncrementContact(paciente.paciente_telefono)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleContactar(paciente)}
                      >
                        <Phone className="w-3 h-3" />
                        Contactar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleCopiarEnlace(paciente)}
                      >
                        <Copy className="w-3 h-3" />
                        Copiar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Load More Options */}
          {hasMore && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-4 border-t">
              {mostrarMasOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={option.value === -1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMostrarMas(option.value)}
                  disabled={option.value !== -1 && visibleCount + option.value > totalCount && option.value !== -1}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="kpi-card text-center py-8">
          <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No hay pacientes inactivos con los filtros seleccionados.
          </p>
        </div>
      )}
    </div>
  );
}
