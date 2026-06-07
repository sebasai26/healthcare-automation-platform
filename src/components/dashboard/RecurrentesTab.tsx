import React, { useState, useMemo } from "react";
import { toTitleCase } from "@/lib/name-utils";
import { Repeat, ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type PeriodFilter = "1" | "2" | "3" | "4" | "5" | "6";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "1", label: "Último mes" },
  { value: "2", label: "Últimos 2 meses" },
  { value: "3", label: "Últimos 3 meses" },
  { value: "4", label: "Últimos 4 meses" },
  { value: "5", label: "Últimos 5 meses" },
  { value: "6", label: "Últimos 6 meses" },
];

interface FisioCount {
  fisio: string;
  count: number;
  detalles: { fecha: string; tipo: string; asunto: string }[];
}

interface PacienteRecurrente {
  nh: string;
  nombre: string;
  telefono: string;
  totalCitas: number;
  fisios: FisioCount[];
}

/** Use primary phone only, strip non-digits, remove leading "34" country code */
function normalizePhone(raw: string): string {
  if (!raw || !raw.trim()) return "";
  const primary = raw.split(/\s+-\s+/)[0] || raw;
  const digits = primary.replace(/\D/g, "");
  if (!digits || digits.length < 6) return "";
  return digits.startsWith("34") && digits.length >= 11 ? digits.slice(2) : digits;
}

async function fetchAllPaginated<T>(
  queryBuilder: () => any,
): Promise<T[]> {
  const allRows: T[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder()
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (data) {
      allRows.push(...data);
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
    page++;
  }
  return allRows;
}

async function fetchRecurrentesData(desde: string) {
  const citas = await fetchAllPaginated<{
    paciente_nombre: string | null;
    paciente_telefono: string | null;
    asunto: string | null;
    estado: string;
    agenda: string | null;
    fecha_cita: string;
  }>(() =>
    supabase
      .from("listado_citas")
      .select("paciente_nombre, paciente_telefono, asunto, estado, agenda, fecha_cita")
      .gte("fecha_cita", desde)
      .ilike("estado", "realizada%")
  );

  function extractNH(asunto: string | null): string | null {
    if (!asunto) return null;
    const match = asunto.match(/^(\d+)\./);
    return match ? match[1] : null;
  }

  const filtered = citas.filter(c => {
    const tel = c.paciente_telefono || "";
    const asunto = (c.asunto || "").toLowerCase();
    const agenda = (c.agenda || "").trim().toLowerCase();
    return tel !== "666666666" &&
      agenda !== "recepcion" &&
      !asunto.includes("bloqueado") &&
      !asunto.includes("no citar") &&
      !asunto.includes("1918");
  });

  // Count appointments per NH, tracking fisio counts and details
  const nhCounts = new Map<string, { 
    nombre: string; 
    telefono: string; 
    count: number; 
    fisioMap: Map<string, { count: number; detalles: { fecha: string; tipo: string; asunto: string }[] }> 
  }>();

  for (const cita of filtered) {
    const nh = extractNH(cita.asunto);
    if (!nh) continue;

    const fisio = cita.agenda || "Sin asignar";
    const asuntoStr = (cita.asunto || "").toUpperCase();
    const isPilates = asuntoStr.includes("PILA"); // "PILATES"
    const tipo = isPilates ? "Pilates" : "Fisioterapia";

    const detail = {
      fecha: cita.fecha_cita,
      tipo,
      asunto: cita.asunto || ""
    };

    const existing = nhCounts.get(nh);
    if (existing) {
      existing.count++;
      const currentFisio = existing.fisioMap.get(fisio);
      if (currentFisio) {
        currentFisio.count++;
        currentFisio.detalles.push(detail);
      } else {
        existing.fisioMap.set(fisio, { count: 1, detalles: [detail] });
      }
    } else {
      const fisioMap = new Map();
      fisioMap.set(fisio, { count: 1, detalles: [detail] });
      nhCounts.set(nh, {
        nombre: cita.paciente_nombre || "Desconocido",
        telefono: cita.paciente_telefono || "-",
        count: 1,
        fisioMap,
      });
    }
  }

  return Array.from(nhCounts.entries()).map(([nh, data]) => ({
    nh,
    nombre: data.nombre,
    telefono: data.telefono,
    totalCitas: data.count,
    fisios: Array.from(data.fisioMap.entries())
      .map(([fisio, info]) => ({ 
        fisio, 
        count: info.count,
        detalles: info.detalles.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      }))
      .sort((a, b) => b.count - a.count),
  }));
}

export function RecurrentesTab() {
  const [period, setPeriod] = useState<PeriodFilter>("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filtroFisio, setFiltroFisio] = useState<string>("todos");
  const [expandedNh, setExpandedNh] = useState<string | null>(null);
  const pageSize = 10;

  const desde = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(period));
    return d.toISOString().split("T")[0];
  }, [period]);

  const { data: pacientesRaw, isLoading, error } = useQuery({
    queryKey: ["recurrentes-citas", desde],
    queryFn: () => fetchRecurrentesData(desde),
    staleTime: 1000 * 60 * 5, // 5 min cache, auto-refreshes
  });

  const physios = useMemo(() => {
    if (!pacientesRaw) return [];
    const set = new Set<string>();
    pacientesRaw.forEach(p => p.fisios.forEach(f => set.add(toTitleCase(f.fisio))));
    return Array.from(set).sort();
  }, [pacientesRaw]);

  const pacientes = useMemo(() => {
    if (!pacientesRaw) return [];
    let result = [...pacientesRaw];

    if (filtroFisio !== "todos") {
      result = result.filter(p => p.fisios.some(f => toTitleCase(f.fisio) === filtroFisio));
      // Replace totalCitas with the specific fisio count for sorting
      result = result.map(p => ({
        ...p,
        totalCitas: p.fisios.find(f => toTitleCase(f.fisio) === filtroFisio)?.count || 0,
      }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.nh.includes(q) ||
          p.telefono.includes(q)
      );
    }

    result.sort((a, b) => b.totalCitas - a.totalCitas);
    return result;
  }, [pacientesRaw, searchQuery, filtroFisio]);

  const totalPages = Math.ceil(pacientes.length / pageSize);
  const paginated = pacientes.slice((page - 1) * pageSize, page * pageSize);

  const toggleExpand = (nh: string) => {
    setExpandedNh(expandedNh === nh ? null : nh);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
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
      <div className="kpi-card text-center py-8">
        <p className="text-muted-foreground">
          Error cargando datos. Sube un archivo de listado de citas primero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-primary" />
          <h4 className="font-medium text-foreground">Pacientes Recurrentes</h4>
          <span className="text-sm text-muted-foreground">
            ({pacientes.length} pacientes)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 w-44"
            />
          </div>
          <Select
            value={filtroFisio}
            onValueChange={(v) => {
              setFiltroFisio(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los fisios</SelectItem>
              {physios.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as PeriodFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {paginated.length > 0 ? (
        <div className="kpi-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Nº Paciente</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Fisio</TableHead>
                <TableHead className="text-center">Citas Realizadas {filtroFisio !== "todos" && `con ${filtroFisio}`}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p, i) => (
                <React.Fragment key={`${p.nh}-${i}`}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(p.nh)}>
                    <TableCell>
                      {expandedNh === p.nh ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {p.nh}
                    </TableCell>
                    <TableCell className="font-medium">
                      {toTitleCase(p.nombre)}
                    </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.telefono}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.fisios.map((f, idx) => (
                      <span key={idx}>
                        {idx > 0 && <span className="mx-1 text-muted-foreground">·</span>}
                        <span className="font-medium">{toTitleCase(f.fisio)}</span>
                        <span className="text-muted-foreground ml-1">({f.count})</span>
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {p.totalCitas}
                    </span>
                  </TableCell>
                  </TableRow>
                  {expandedNh === p.nh && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6} className="p-0 border-b-0">
                        <div className="py-4 px-8 border-l-2 border-primary ml-4">
                          <h5 className="font-medium text-sm mb-3">
                            {filtroFisio !== "todos" ? `Desglose de citas con ${filtroFisio}` : "Desglose de citas"}
                          </h5>
                          <div className="space-y-4">
                            {(filtroFisio !== "todos" ? p.fisios.filter(f => toTitleCase(f.fisio) === filtroFisio) : p.fisios).map((fisioInfo, idx) => (
                              <div key={`${fisioInfo.fisio}-${idx}`} className="space-y-2">
                                {filtroFisio === "todos" && (
                                  <p className="text-sm font-medium text-muted-foreground">{toTitleCase(fisioInfo.fisio)} ({fisioInfo.count} citas)</p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {fisioInfo.detalles.map((detalle, dIdx) => {
                                    const dateObj = new Date(detalle.fecha);
                                    let dateStr = dateObj.toLocaleDateString('es-ES', {
                                      day: '2-digit', month: '2-digit', year: 'numeric'
                                    });
                                    if (dateStr === "Invalid Date") dateStr = detalle.fecha;
                                    
                                    return (
                                      <div key={dIdx} className="flex flex-col p-2 bg-background rounded-md border text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium">{dateStr}</span>
                                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${detalle.tipo === 'Pilates' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {detalle.tipo}
                                          </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground truncate" title={detalle.asunto}>
                                          {detalle.asunto || "Sin asunto"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, pacientes.length)} de {pacientes.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="kpi-card text-center py-8">
          <Repeat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No se encontraron pacientes con citas realizadas en este periodo.
          </p>
        </div>
      )}
    </div>
  );
}

