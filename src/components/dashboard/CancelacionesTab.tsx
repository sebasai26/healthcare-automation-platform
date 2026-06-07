import React, { useState, useMemo } from "react";
import { toTitleCase } from "@/lib/name-utils";
import { UserX } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { usePacientesCanceladores, useDeleteCancellation, useUpdateCancellation } from "@/hooks/usePacientesInactivos";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronDown, Edit2, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

type FilterType = "anual" | "mensual";
type TipoCitaFilter = "todos" | "Fisioterapia";
type SemaforoFilter = "todos" | "rojo" | "amarillo" | "verde";

function getSemaforoColor(cancelaciones: number): "rojo" | "amarillo" | "verde" {
  if (cancelaciones >= 3) return "rojo";
  if (cancelaciones === 2) return "amarillo";
  return "verde";
}

const semaforoStyles = {
  rojo: "bg-red-500",
  amarillo: "bg-yellow-400",
  verde: "bg-green-500",
} as const;

export function CancelacionesTab() {
  const currentYear = new Date().getFullYear();
  const currentMonth = months[new Date().getMonth()];

  const [filterType, setFilterType] = useState<FilterType>("mensual");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [tipoCitaFilter, setTipoCitaFilter] = useState<TipoCitaFilter>("todos");
  const [semaforoFilter, setSemaforoFilter] = useState<SemaforoFilter>("todos");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editedCancellations, setEditedCancellations] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [editDetailData, setEditDetailData] = useState({ fecha: "", asunto: "", nombre: "" });

  const deleteMutation = useDeleteCancellation();
  const updateMutation = useUpdateCancellation();

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditSave = (telefono: string) => {
    const val = parseInt(editValue);
    if (!isNaN(val) && val >= 0) {
      setEditedCancellations(prev => ({ ...prev, [telefono]: val }));
    }
    setEditingId(null);
  };

  const handleDeleteDetail = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta cancelación?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Cancelación eliminada" });
      } catch (error) {
        toast({ title: "Error al eliminar", variant: "destructive" });
      }
    }
  };

  const handleUpdateDetail = async (id: string) => {
    try {
      const date = new Date(editDetailData.fecha);
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const mes = monthNames[date.getMonth()];
      const anio = date.getFullYear();

      await updateMutation.mutateAsync({
        id,
        fecha_cita: editDetailData.fecha,
        asunto: editDetailData.asunto,
        paciente_nombre: editDetailData.nombre,
        anio,
        mes
      });
      setEditingDetailId(null);
      toast({ title: "Cancelación actualizada" });
    } catch (error) {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  };

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= 2025; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const mesFilter = filterType === "mensual" ? selectedMonth : undefined;

  const { data, isLoading, error } = usePacientesCanceladores(
    selectedYear,
    mesFilter,
    page,
    pageSize
  );

  // Query for cancellation breakdown by type (Pilates vs Fisioterapia)
  const { data: cancelBreakdown } = useQuery({
    queryKey: ["cancel_breakdown", selectedYear, mesFilter],
    staleTime: 120_000,
    queryFn: async () => {
      let query = supabase
        .from("listado_citas")
        .select("asunto, estado")
        .eq("anio", selectedYear)
        .not("asunto", "is", null);

      if (mesFilter) {
        query = query.eq("mes", mesFilter);
      }

      const { data: allRows, error } = await query;
      if (error || !allRows) return { pilates: 0, fisioterapia: 0 };

      let pilates = 0;
      let fisioterapia = 0;

      for (const row of allRows) {
        const estado = (row.estado || "").toLowerCase();
        const esCancelada = estado.includes("anulada") || estado.includes("cancelada");
        if (!esCancelada) continue;

        const asunto = (row.asunto || "").toUpperCase();
        if (!asunto.includes("PILATES")) {
          fisioterapia++;
        }
      }

      return { pilates: 0, fisioterapia };
    },
  });

  // Filter by tipo_cita and semaforo client-side
  const filteredPacientes = useMemo(() => {
    if (!data) return [];
    let result = data.pacientes;
    if (tipoCitaFilter !== "todos") {
      result = result.filter(p => p.tipo_cita === tipoCitaFilter || p.tipo_cita === "Ambos");
    }
    if (semaforoFilter !== "todos") {
      result = result.filter(p => {
        const count = editedCancellations[p.paciente_telefono || ""] ?? p.cancelaciones;
        return getSemaforoColor(count) === semaforoFilter;
      });
    }
    return result;
  }, [data, tipoCitaFilter, semaforoFilter, editedCancellations]);

  const totalFiltered = useMemo(() => {
    if (!data) return 0;
    if (tipoCitaFilter === "todos") return data.totalCount;
    // We need full count — but since we paginate server-side and filter client-side,
    // just show filtered count from current page data
    return filteredPacientes.length;
  }, [data, tipoCitaFilter, filteredPacientes]);

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0;

  // Reset page when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
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
          Error cargando datos de cancelaciones. Sube un archivo de listado de citas primero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <UserX className="w-5 h-5 text-destructive" />
          <h4 className="font-medium text-foreground">
            Pacientes con Múltiples Cancelaciones
          </h4>
          {data && (
            <span className="text-sm text-muted-foreground">
              ({data.totalCount} pacientes)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Type Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterType("anual");
                handleFilterChange();
              }}
              className={cn(
                "transition-all text-xs px-3",
                filterType === "anual" 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Anual
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterType("mensual");
                handleFilterChange();
              }}
              className={cn(
                "transition-all text-xs px-3",
                filterType === "mensual" 
                  ? "bg-card shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensual
            </Button>
          </div>

          {/* Year Selector */}
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => {
              setSelectedYear(parseInt(v));
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Selector */}
          {filterType === "mensual" && (
            <Select 
              value={selectedMonth} 
              onValueChange={(v) => {
                setSelectedMonth(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Tipo Cita Filter */}
          <Select
            value={tipoCitaFilter}
            onValueChange={(v) => {
              setTipoCitaFilter(v as TipoCitaFilter);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo cita" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
            </SelectContent>
          </Select>

          {/* Semáforo Filter */}
          <Select
            value={semaforoFilter}
            onValueChange={(v) => {
              setSemaforoFilter(v as SemaforoFilter);
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Semáforo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">
                <span className="flex items-center gap-2">Todos</span>
              </SelectItem>
              <SelectItem value="rojo">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Rojo (≥3)</span>
              </SelectItem>
              <SelectItem value="amarillo">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Amarillo (2)</span>
              </SelectItem>
              <SelectItem value="verde">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Verde (1)</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desglose Cancelaciones: Pilates vs Fisioterapia */}
      {cancelBreakdown && cancelBreakdown.fisioterapia > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <p className="text-sm font-medium text-muted-foreground">Cancelaciones – Fisioterapia</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{cancelBreakdown.fisioterapia}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {data && filteredPacientes.length > 0 ? (
        <div className="kpi-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nº Paciente</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Última Cancelación</TableHead>
                <TableHead className="text-center">Cancelaciones</TableHead>
                <TableHead className="text-center">Semáforo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPacientes.map((paciente, index) => {
                const isExpanded = expandedRows[paciente.paciente_telefono];
                const displayCount = editedCancellations[paciente.paciente_telefono] ?? paciente.cancelaciones;
                const isEditing = editingId === paciente.paciente_telefono;
                
                return (
                <React.Fragment key={`${paciente.paciente_telefono}-${index}`}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(paciente.paciente_telefono)}>
                    <TableCell>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {paciente.numero_paciente || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {toTitleCase(paciente.paciente_nombre)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {paciente.paciente_telefono || '-'}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        paciente.tipo_cita === "Pilates" && "bg-orange-500/10 text-orange-600",
                        paciente.tipo_cita === "Fisioterapia" && "bg-blue-500/10 text-blue-600",
                        paciente.tipo_cita === "Ambos" && "bg-purple-500/10 text-purple-600",
                      )}>
                        {paciente.tipo_cita}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(paciente.ultima_cancelacion).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => Object.keys(paciente.detalles || {}).length > 0 && e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              className="w-16 h-8 text-center" 
                              value={editValue} 
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditSave(paciente.paciente_telefono);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={(e) => { e.stopPropagation(); handleEditSave(paciente.paciente_telefono); }}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-1 bg-destructive/10 text-destructive rounded-full text-sm font-medium">
                              {displayCount}
                            </span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(paciente.paciente_telefono);
                              setEditValue(displayCount.toString());
                            }}>
                              <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "inline-block w-4 h-4 rounded-full",
                        semaforoStyles[getSemaforoColor(displayCount)]
                      )} title={getSemaforoColor(displayCount) === "rojo" ? "≥3 cancelaciones" : getSemaforoColor(displayCount) === "amarillo" ? "2 cancelaciones" : "1 cancelación"} />
                    </TableCell>
                  </TableRow>
                  {isExpanded && paciente.detalles && paciente.detalles.length > 0 && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={8} className="p-0 border-b">
                        <div className="px-12 py-4 shadow-inner">
                          <h5 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                            Detalle de Cancelaciones Anteriores
                          </h5>
                          <div className="bg-card rounded-md border text-sm max-h-48 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableHead className="py-2 text-xs font-medium">Fecha de Cita</TableHead>
                                  <TableHead className="py-2 text-xs font-medium">Paciente</TableHead>
                                  <TableHead className="py-2 text-xs font-medium">Tipo</TableHead>
                                  <TableHead className="py-2 text-xs font-medium">Asunto Original</TableHead>
                                  <TableHead className="py-2 text-xs font-medium text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paciente.detalles.map((det) => {
                                  const isEditingDetail = editingDetailId === det.id;
                                  return (
                                    <TableRow key={det.id}>
                                      <TableCell className="py-2 text-xs">
                                        {isEditingDetail ? (
                                          <Input 
                                            type="date" 
                                            className="h-7 text-[10px] w-28" 
                                            value={editDetailData.fecha}
                                            onChange={(e) => setEditDetailData(prev => ({ ...prev, fecha: e.target.value }))}
                                          />
                                        ) : (
                                          new Date(det.fecha).toLocaleDateString('es-ES')
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs">
                                        {isEditingDetail ? (
                                          <Input 
                                            className="h-7 text-[10px] w-32" 
                                            value={editDetailData.nombre}
                                            onChange={(e) => setEditDetailData(prev => ({ ...prev, nombre: e.target.value }))}
                                          />
                                        ) : (
                                          toTitleCase(paciente.paciente_nombre)
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2">
                                        {isEditingDetail ? (
                                          <Select 
                                            value={editDetailData.asunto.includes("PILATES") ? "Pilates" : "Fisioterapia"}
                                            onValueChange={(v) => setEditDetailData(prev => ({ 
                                              ...prev, 
                                              asunto: v === "Pilates" ? (det.asunto.toUpperCase().includes("PILATES") ? det.asunto : `PILATES - ${det.asunto}`) : det.asunto.replace(/PILATES\s*-\s*/i, "")
                                            }))}
                                          >
                                            <SelectTrigger className="h-7 text-[10px] w-24">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                                              <SelectItem value="Pilates">Pilates</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-medium inline-block",
                                            det.tipo === "Pilates" ? "bg-orange-500/10 text-orange-600" : "bg-blue-500/10 text-blue-600"
                                          )}>
                                            {det.tipo}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-[10px] text-muted-foreground truncate max-w-[150px]">
                                        {isEditingDetail ? (
                                          <Input 
                                            className="h-7 text-[10px]" 
                                            value={editDetailData.asunto}
                                            onChange={(e) => setEditDetailData(prev => ({ ...prev, asunto: e.target.value }))}
                                          />
                                        ) : (
                                          det.asunto || '-'
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {isEditingDetail ? (
                                            <>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => handleUpdateDetail(det.id)}>
                                                <Check className="w-4 h-4" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => setEditingDetailId(null)}>
                                                <X className="w-4 h-4" />
                                              </Button>
                                            </>
                                          ) : (
                                            <>
                                              <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-6 w-6" 
                                                onClick={() => {
                                                  setEditingDetailId(det.id);
                                                  setEditDetailData({ 
                                                    fecha: det.fecha, 
                                                    asunto: det.asunto, 
                                                    nombre: paciente.paciente_nombre 
                                                  });
                                                }}
                                              >
                                                <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/50 hover:text-destructive" onClick={() => handleDeleteDetail(det.id)}>
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, data.totalCount)} de {data.totalCount} pacientes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="kpi-card text-center py-8">
          <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No hay pacientes con múltiples cancelaciones en este periodo.
          </p>
        </div>
      )}
    </div>
  );
}
