import React, { useState, useMemo } from "react";
import { useCampanaConsentimiento, ConsentimientoRow } from "@/hooks/useCampanaConsentimiento";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Users,
  Percent,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  AlertCircle,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
} from "recharts";

type ViewMode = "enviados" | "respondidos" | "interesados" | "no_interesados" | "otras_respuestas" | "todos";
type SortField = "num" | "nombre" | "telefono" | "planEnviada" | "respuesta" | "respuestaDiferente";
type SortDir = "asc" | "desc";

// WhatsApp SVG Icon
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

// KPI Metric Card
function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground leading-none">{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground mt-1.5">{subValue}</p>
          )}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-muted/60 transition-transform group-hover:scale-110`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      {/* Subtle gradient accent */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-40 bg-gradient-to-r from-transparent via-muted-foreground to-transparent`} />
    </div>
  );
}

function getResponsaBadge(respuesta: string | null, respDiferente: string | null) {
  const r = (respuesta || "").trim().toLowerCase();
  if (r === "si, me interesa" || r === "sí, me interesa") {
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-medium">Sí, me interesa</Badge>;
  }
  if (r === "no, gracias" || r === "no interesados") {
    return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border hover:bg-muted/80 font-medium">No interesados</Badge>;
  }
  const rd = (respDiferente || "").trim();
  if (rd.length > 0) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/15 font-medium max-w-[200px] truncate" title={rd}>
        {rd}
      </Badge>
    );
  }
  return <span className="text-muted-foreground text-sm">Sin respuesta</span>;
}

function getPlanBadge(planEnviada: string | null) {
  const p = (planEnviada || "").trim().toLowerCase();
  if (p === "si" || p === "sí") {
    return <Badge className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 font-medium">Enviado</Badge>;
  }
  return <span className="text-muted-foreground text-sm">Pendiente</span>;
}

export function CampanaConsentimientoSection() {
  const { data, isLoading, error } = useCampanaConsentimiento();
  const [viewMode, setViewMode] = useState<ViewMode>("enviados");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("planEnviada");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showTable, setShowTable] = useState(false);
  const [showOtras, setShowOtras] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline-block" />
      : <ChevronDown className="w-3.5 h-3.5 ml-1 inline-block" />;
  };

  // Filter and sort rows
  const displayRows = useMemo(() => {
    if (!data?.rows) return [];

    let rows = [...data.rows];

    // Filter by view mode
    if (viewMode === "enviados") {
      rows = rows.filter(r => {
        const p = (r["Plan.Enviada"] || "").trim().toLowerCase();
        return p === "si" || p === "sí";
      });
    } else if (viewMode === "respondidos") {
      rows = rows.filter(r => {
        const resp = (r["Respuesta"] || "").trim().toLowerCase();
        const respDif = (r["Respuesta diferente"] || "").trim();
        return resp.length > 0 || respDif.length > 0;
      });
    } else if (viewMode === "interesados") {
      rows = rows.filter(r => {
        const resp = (r["Respuesta"] || "").trim().toLowerCase();
        return resp === "si, me interesa" || resp === "sí, me interesa";
      });
    } else if (viewMode === "no_interesados") {
      rows = rows.filter(r => {
        const resp = (r["Respuesta"] || "").trim().toLowerCase();
        return resp === "no, gracias" || resp === "no interesados";
      });
    } else if (viewMode === "otras_respuestas") {
      rows = rows.filter(r => {
        const respDif = (r["Respuesta diferente"] || "").trim();
        return respDif.length > 0;
      });
    }

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      rows = rows.filter(r => {
        const nombre = (r["Apellidos, nombre"] || r["Apellidos, Nombre"] || r["Nombre"] || "").toLowerCase();
        const num = (r["Núm."] || r["id_cliente"] || r["NºPaciente"] || r["Num"] || r["Numero Paciente"] || "").toLowerCase();
        const tel = (r["Teléfono"] || "").toLowerCase();
        const resp = (r["Respuesta"] || "").toLowerCase();
        const respDif = (r["Respuesta diferente"] || "").toLowerCase();
        return nombre.includes(term) || num.includes(term) || tel.includes(term) || resp.includes(term) || respDif.includes(term);
      });
    }

    // Sort
    rows.sort((a, b) => {
      let valA: string, valB: string;
      switch (sortField) {
        case "num": valA = a["Núm."] || a["id_cliente"] || a["NºPaciente"] || a["Num"] || a["Numero Paciente"] || ""; valB = b["Núm."] || b["id_cliente"] || b["NºPaciente"] || b["Num"] || b["Numero Paciente"] || ""; break;
        case "nombre": valA = a["Apellidos, nombre"] || a["Apellidos, Nombre"] || a["Nombre"] || ""; valB = b["Apellidos, nombre"] || b["Apellidos, Nombre"] || b["Nombre"] || ""; break;
        case "telefono": valA = a["Teléfono"] || ""; valB = b["Teléfono"] || ""; break;
        case "planEnviada": valA = a["Plan.Enviada"] || ""; valB = b["Plan.Enviada"] || ""; break;
        case "respuesta": valA = a["Respuesta"] || ""; valB = b["Respuesta"] || ""; break;
        case "respuestaDiferente": valA = a["Respuesta diferente"] || ""; valB = b["Respuesta diferente"] || ""; break;
        default: valA = ""; valB = "";
      }
      const cmp = valA.localeCompare(valB, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [data?.rows, viewMode, searchTerm, sortField, sortDir]);

  // Chart data
  const pieData = useMemo(() => {
    if (!data?.metrics) return [];
    const { interesados, noInteresados, respuestasDiferentes, sinRespuesta } = data.metrics;
    const items = [];
    if (interesados > 0) items.push({ name: "Sí, me interesa", value: interesados, color: "#10b981" }); // emerald
    if (noInteresados > 0) items.push({ name: "No interesados", value: noInteresados, color: "#94a3b8" }); // neutral
    if (respuestasDiferentes > 0) items.push({ name: "Resp. diferente", value: respuestasDiferentes, color: "#8b5cf6" }); // engaging violet
    if (sinRespuesta > 0) items.push({ name: "Sin respuesta", value: sinRespuesta, color: "#cbd5e1" }); // lighter neutral
    return items;
  }, [data?.metrics]);

  // Otras respuestas
  const otrasRespuestas = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter(r => (r["Respuesta diferente"] || "").trim().length > 0);
  }, [data?.rows]);

  if (isLoading) {
    return (
      <Card className="shadow-sm border-border mt-6">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm border-border mt-6">
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <p>Error al cargar los datos de consentimiento: {(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = data?.metrics;
  if (!metrics) return null;

  return (
    <Card className="shadow-sm border-border mt-6 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#25D366]/10">
            <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
          </div>
          <div>
            <CardTitle className="text-lg">Campaña de Consentimiento</CardTitle>
            <CardDescription>Seguimiento de envíos y respuestas del plan de consentimiento informado</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            icon={Send}
            label="Mensajes Enviados"
            value={metrics.mensajesEnviados}
            subValue={`De ${metrics.totalRegistros} registros totales`}
            iconColor="text-blue-500"
          />
          <MetricCard
            icon={Percent}
            label="% Respuestas"
            value={`${metrics.porcentajeRespuesta}%`}
            subValue={`${metrics.respuestasTotales} respuestas de ${metrics.mensajesEnviados} envíos`}
            iconColor="text-violet-500"
          />
          <MetricCard
            icon={MessageCircle}
            label="Respuestas Totales"
            value={metrics.respuestasTotales}
            subValue={`${metrics.interesados} interesados · ${metrics.noInteresados} no interesados · ${metrics.respuestasDiferentes} otras`}
            iconColor="text-amber-500"
          />
          <MetricCard
            icon={ThumbsUp}
            label="Interesados"
            value={metrics.interesados}
            subValue={metrics.respuestasTotales > 0
              ? `${Math.round((metrics.interesados / metrics.respuestasTotales) * 1000) / 10}% de las respuestas`
              : "Sin respuestas aún"
            }
            iconColor="text-emerald-500"
          />
        </div>

        {/* Pie chart and breakdown */}
        {metrics.mensajesEnviados > 0 && pieData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Distribución de Respuestas
              </h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [value, name]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                        fontSize: "13px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown Summary */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-center">
              <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Resumen Detallado
              </h4>
              <div className="space-y-3">
                {[
                  { label: "Sí, me interesa", value: metrics.interesados, icon: ThumbsUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
                  { label: "No interesados", value: metrics.noInteresados, icon: ThumbsDown, color: "text-muted-foreground", bg: "bg-muted" },
                  { label: "Respuesta diferente", value: metrics.respuestasDiferentes, icon: MessageCircle, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", isExpandable: true },
                  { label: "Sin respuesta", value: metrics.sinRespuesta, icon: EyeOff, color: "text-muted-foreground", bg: "bg-muted" },
                  { label: "Pendientes de envío", value: metrics.sinEnviar, icon: Send, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10" },
                ].map(item => (
                  <div key={item.label} className="flex flex-col">
                    <div 
                      className={`flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors ${item.isExpandable && item.value > 0 ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (item.isExpandable && item.value > 0) {
                          setShowOtras(!showOtras);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${item.bg}`}>
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                        </div>
                        <span className="text-sm text-foreground flex items-center gap-2">
                          {item.label}
                          {item.isExpandable && item.value > 0 && (
                            showOtras ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                      <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                    </div>
                    {item.isExpandable && showOtras && (
                      <div className="mt-2 ml-4 pl-3 border-l-2 border-muted space-y-2 py-1 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                        {otrasRespuestas.map((r, i) => (
                          <div key={i} className="text-xs bg-muted/30 p-2 rounded-md">
                            <span className="font-semibold text-foreground/80 block mb-0.5">
                              {r["Apellidos, nombre"] || r["Apellidos, Nombre"] || r["Nombre"] || r["Teléfono"] || "Anónimo"}
                            </span>
                            <span className="text-muted-foreground italic break-words">
                              "{r["Respuesta diferente"]}"
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Button
                variant={showTable ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTable(!showTable)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                {showTable ? "Ocultar listado" : "Mostrar listado de pacientes de la campaña"}
              </Button>
            </div>
            {showTable && (
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <div className="w-[200px]">
                  <Select value={viewMode} onValueChange={(val: ViewMode) => setViewMode(val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5" />
                        <SelectValue placeholder="Filtro de pacientes" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enviados">Solo enviados ({metrics.mensajesEnviados})</SelectItem>
                      <SelectItem value="respondidos">Han respondido ({metrics.respuestasTotales})</SelectItem>
                      <SelectItem value="interesados">Interesados ({metrics.interesados})</SelectItem>
                      <SelectItem value="no_interesados">No interesados ({metrics.noInteresados})</SelectItem>
                      <SelectItem value="otras_respuestas">Otras respuestas ({metrics.respuestasDiferentes})</SelectItem>
                      <SelectItem value="todos">Todos los registros ({metrics.totalRegistros})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, teléfono..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {showTable && (
            <div className="overflow-x-auto">
              {displayRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No se encontraron registros{searchTerm ? " para la búsqueda actual" : ""}.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[80px] cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("num")}>
                        Num. <SortIcon field="num" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("nombre")}>
                        Nombre del paciente <SortIcon field="nombre" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("telefono")}>
                        Teléfono <SortIcon field="telefono" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-foreground transition-colors text-center" onClick={() => toggleSort("planEnviada")}>
                        Enviado <SortIcon field="planEnviada" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("respuesta")}>
                        Respuesta <SortIcon field="respuesta" />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort("respuestaDiferente")}>
                        Respuesta diferente <SortIcon field="respuestaDiferente" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map((row, idx) => (
                      <TableRow key={row.id || idx} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-sm text-muted-foreground font-medium">
                          {row["Núm."] || row["id_cliente"] || row["NºPaciente"] || row["Num"] || row["Numero Paciente"] || <span className="opacity-50">—</span>}
                        </TableCell>
                        <TableCell className="font-medium text-sm text-foreground">
                          {row["Apellidos, nombre"] || row["Apellidos, Nombre"] || row["Nombre"] || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row["Teléfono"] || <span>—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {getPlanBadge(row["Plan.Enviada"])}
                        </TableCell>
                        <TableCell>
                          {getResponsaBadge(row["Respuesta"], row["Respuesta diferente"])}
                        </TableCell>
                        <TableCell className="text-sm max-w-[220px]">
                          {(row["Respuesta diferente"] || "").trim() ? (
                            <span className="text-foreground/80" title={row["Respuesta diferente"] || ""}>
                              {row["Respuesta diferente"]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {displayRows.length > 0 && (
                <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Mostrando {displayRows.length} de {data?.rows?.length || 0} registros
                  </span>
                  <span className="text-muted-foreground/60">
                    Filtro: {viewMode === "enviados" ? "Solo mensajes enviados" : 
                             viewMode === "respondidos" ? "Han respondido" :
                             viewMode === "interesados" ? "Interesados" :
                             viewMode === "no_interesados" ? "No interesados" :
                             viewMode === "otras_respuestas" ? "Otras respuestas" :
                             "Todos los registros"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
