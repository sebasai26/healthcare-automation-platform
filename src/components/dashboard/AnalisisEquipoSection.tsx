import React, { useState, useMemo, Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lightbulb,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Target,
  Users,
  AlertCircle,
  TrendingUp,
  Calendar,
  Activity,
  Euro,
  Filter,
  Clock,
  UserCheck,
  FileText
} from "lucide-react";
import { useProductividadEquipo } from "@/hooks/useDashboardData";
import { useVacaciones } from "@/hooks/useVacaciones";
import { useContabilidadResumen, PROF_SECTIONS, getProfDisplayName } from "@/hooks/useContabilidad";
import { useBeneficioReal } from "@/hooks/useBeneficioReal";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DeleteDataButton } from "./DeleteDataButton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DailyOccupancyCalculator } from "./DailyOccupancyCalculator";
import { PhysioActivityModal } from "./PhysioActivityModal";

const MONTHS = [
  { value: "-1", label: "Todo el año" },
  { value: "0", label: "Enero" },
  { value: "1", label: "Febrero" },
  { value: "2", label: "Marzo" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Mayo" },
  { value: "5", label: "Junio" },
  { value: "6", label: "Julio" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Septiembre" },
  { value: "9", label: "Octubre" },
  { value: "10", label: "Noviembre" },
  { value: "11", label: "Diciembre" },
];

const MONTH_KEYS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;


export function AnalisisEquipoSection() {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState("productividad");

  const YEARS = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = currentYear; y >= 2025; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, [currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());

  const yearNum = parseInt(selectedYear);
  const monthNum = parseInt(selectedMonth);

  return (
    <section className="animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Análisis de Equipo</h2>
          <p className="text-muted-foreground">Productividad, rentabilidad y retención por profesional</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="productividad" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Productividad</span>
          </TabsTrigger>
          <TabsTrigger value="pacientes" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Métricas del Equipo</span>
          </TabsTrigger>
          <TabsTrigger value="vacaciones" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Vacaciones y Doc.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productividad">
          <ProductividadTab yearNum={yearNum} monthNum={monthNum} selectedYear={selectedYear} selectedMonth={selectedMonth} />
        </TabsContent>
        <TabsContent value="pacientes">
          <PacientesMetricasTab yearNum={yearNum} monthNum={monthNum} />
        </TabsContent>
        <TabsContent value="vacaciones">
          <VacacionesDocumentacionTab yearNum={yearNum} monthNum={monthNum} selectedMonth={selectedMonth} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

// =================== PRODUCTIVIDAD TAB ===================
function ProductividadTab({ yearNum, monthNum, selectedYear, selectedMonth }: { yearNum: number; monthNum: number; selectedYear: string; selectedMonth: string }) {
  const isAllYear = monthNum === -1;
  const { data: prodData, isLoading: loadingProd } = useProductividadEquipo(yearNum, monthNum);
  const { data: contabResumen } = useContabilidadResumen(yearNum);
  const [expandedPhysio, setExpandedPhysio] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const periodLabel = selectedMonth === "-1"
    ? `Total ${selectedYear}`
    : `${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

  const getBeneficioReal = useBeneficioReal(contabResumen, isAllYear, isAllYear ? 0 : monthNum);

  const getOccupancyColor = (occupancy: number) => {
    if (occupancy >= 80) return "text-green-500";
    if (occupancy >= 60) return "text-primary";
    return "text-amber-500";
  };

  if (loadingProd) {
    return <div className="kpi-card"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!prodData || prodData.length === 0) {
    return (
      <div className="kpi-card">
        <p className="text-muted-foreground text-center py-8">
          Sin datos de productividad para {periodLabel}.
        </p>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <div className="mb-3 text-sm text-muted-foreground">
        Mostrando: <span className="font-medium text-foreground">{periodLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="w-[40px]"></th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Profesional</span>
              </th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center justify-center gap-2"><Calendar className="w-4 h-4" /> Citas</span>
              </th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center justify-center gap-2"><Activity className="w-4 h-4" /> Ocupación</span>
              </th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center justify-center gap-2"><Clock className="w-4 h-4" /> Horas</span>
              </th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center justify-end gap-2"><Euro className="w-4 h-4" /> Facturación</span>
              </th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center justify-end gap-2"><TrendingUp className="w-4 h-4" /> Beneficio Neto</span>
              </th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                <span className="flex items-center justify-end gap-2"><Euro className="w-4 h-4" /> €/hora Neto</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {prodData.map(physio => {
              const beneficio = getBeneficioReal(physio.name);
              const displayBeneficio = beneficio;
              
              return (
                <Fragment key={physio.name}>
                  <tr 
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setExpandedPhysio(physio.name);
                      setIsModalOpen(true);
                    }}
                  >
                    <td className="py-4 px-2 text-center text-muted-foreground">
                       <ChevronDown className="w-4 h-4 inline" />
                    </td>
                    <td className="py-4 px-4 font-medium text-foreground">{physio.name}</td>
                    <td className="py-4 px-4 text-center font-semibold text-foreground">{physio.appointments}</td>
                    <td className="py-4 px-4 text-center">
                      {physio.name.toLowerCase().includes('cristina ponce') ? (
                        <span className="font-semibold min-w-[3rem] text-muted-foreground">
                          N/A
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <div className="relative w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${physio.occupancy >= 80 ? 'bg-green-500' : physio.occupancy >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(Math.round(physio.occupancy), 100)}%` }}
                            />
                          </div>
                          <span className={`font-semibold min-w-[3rem] ${getOccupancyColor(physio.occupancy)}`}>
                            {Math.round(physio.occupancy)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-foreground">
                      {physio.hours > 0 ? physio.hours.toFixed(1) : '-'}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-foreground">
                      {physio.revenue.toLocaleString('es-ES')}€
                    </td>
                    <td className={`py-4 px-4 text-right font-semibold ${displayBeneficio !== null && displayBeneficio !== 0 ? (displayBeneficio > 0 ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                      {displayBeneficio !== null && displayBeneficio !== 0 ? `${displayBeneficio.toLocaleString('es-ES')}€` : '-'}
                    </td>
                    <td className={`py-4 px-4 text-right font-semibold ${displayBeneficio && displayBeneficio !== 0 ? (displayBeneficio > 0 ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                      {physio.hours > 0 && displayBeneficio !== null && displayBeneficio !== undefined
                        ? `${(displayBeneficio / physio.hours).toFixed(2)}€` 
                        : "-"}
                    </td>
                  </tr>
                  {/* Removed inline DailyOccupancyCalculator logic */}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 font-semibold">
              <td colSpan={2} className="py-4 px-4 text-foreground">Total / Media</td>
              <td className="py-4 px-4 text-center text-foreground">{prodData.reduce((s, p) => s + p.appointments, 0)}</td>
              <td className="py-4 px-4 text-center">
                <span className={getOccupancyColor((() => {
                  const filtered = prodData.filter(p => !p.name.toLowerCase().includes('cristina ponce'));
                  return filtered.length > 0 ? filtered.reduce((s, p) => s + p.occupancy, 0) / filtered.length : 0;
                })())}>
                  {Math.round((() => {
                    const filtered = prodData.filter(p => !p.name.toLowerCase().includes('cristina ponce'));
                    return filtered.length > 0 ? filtered.reduce((s, p) => s + p.occupancy, 0) / filtered.length : 0;
                  })())}%
                </span>
              </td>
              <td className="py-4 px-4 text-center text-foreground">{prodData.reduce((s, p) => s + p.hours, 0).toFixed(1)}</td>
              <td className="py-4 px-4 text-right text-foreground">
                {prodData.reduce((s, p) => s + p.revenue, 0).toLocaleString('es-ES')}€
              </td>
              <td className="py-4 px-4 text-right text-primary">
                {(() => {
                  const totalBen = (prodData || []).reduce((s, p) => s + (getBeneficioReal(p.name) || 0), 0);
                  return `${totalBen.toLocaleString('es-ES')}€`;
                })()}
              </td>
                <td className="py-4 px-4 text-right text-muted-foreground">
                  -
                </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {expandedPhysio && (
        <PhysioActivityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setExpandedPhysio(null);
          }}
          physioName={expandedPhysio}
          year={yearNum}
          month={monthNum !== -1 ? monthNum : undefined}
        />
      )}
    </div>
  );
}

// =================== METRICAS DE PACIENTES TAB ===================
interface AppointmentDetail {
  fecha: string;
  paciente: string;
  tipo: 'Primera Visita' | 'Volvieron';
}

interface PhysioPatientMetrics {
  name: string;
  avgVisitsPerPatient: number;
  totalPatients: number;
  totalVisits: number;
  returnRate: number; // % of patients who come back after first visit
  firstVisitPatients: number;
  returnedPatients: number;
  details: AppointmentDetail[];
}

function usePacientesMetricasPorFisio(anio: number, mes: number) {
  const isAllYear = mes === -1;
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return useQuery({
    queryKey: ["pacientes_metricas_fisio", anio, mes],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PhysioPatientMetrics[]> => {
      // Fetch all appointments for the year (paginated)
      const PAGE_SIZE = 1000;
      const all: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        let q = supabase
          .from("listado_citas")
          .select("agenda,paciente_nombre,paciente_telefono,estado,asunto,servicio,tipo,fecha_cita")
          .eq("anio", anio);
        if (!isAllYear) {
          q = q.eq("mes", monthNames[mes]);
        }
        q = q.range(offset, offset + PAGE_SIZE - 1);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
      }

      // Filter out placeholders and test records
      const filtered = all.filter(c => {
        const asunto = (c.asunto || "").toLowerCase();
        const servicio = (c.servicio || "").toLowerCase();
        const telefono = (c.paciente_telefono || "").trim();
        const esPlaceholder =
          asunto.includes("1918") || asunto.includes("bloqueado") || asunto.includes("no citar") || servicio === "sin agenda";
        const esTest = telefono === "666666666";
        return !esPlaceholder && !esTest;
      });

      // Only realized appointments
      const realizadas = filtered.filter(c => (c.estado || "").toLowerCase().startsWith("realizada"));

      // Group by agenda (physio)
      const byPhysio = new Map<string, any[]>();
      realizadas.forEach(c => {
        const agenda = (c.agenda || "").trim();
        if (!agenda) return;
        if (!byPhysio.has(agenda)) byPhysio.set(agenda, []);
        byPhysio.get(agenda)!.push(c);
      });

      // Calculate metrics per physio
      const results: PhysioPatientMetrics[] = [];
      for (const [name, citas] of byPhysio.entries()) {
        // Use phone as patient identifier (more reliable than name)
        const patientVisits = new Map<string, number>();
        const patientFirstVisit = new Set<string>();

        citas.forEach(c => {
          const key = (c.paciente_telefono || c.paciente_nombre || "").trim();
          if (!key) return;
          patientVisits.set(key, (patientVisits.get(key) || 0) + 1);

          // Check if this is a "primera sesión" type
          const tipo = (c.tipo || "").toLowerCase();
          const asunto = (c.asunto || "").toLowerCase();
          if (tipo.includes("primera") || asunto.includes("primera sesion") || asunto.includes("primera sesión") || asunto.includes("1ª sesion") || asunto.includes("1ª sesión") || asunto.includes("1ª")) {
            patientFirstVisit.add(key);
          }
        });

        const totalPatients = patientVisits.size;
        const totalVisits = citas.length;
        const avgVisitsPerPatient = totalPatients > 0 ? totalVisits / totalPatients : 0;

        // Return rate: of patients who had a first visit, how many came back (>1 total visit)
        let firstVisitCount = patientFirstVisit.size;
        let returnedCount = 0;
        patientFirstVisit.forEach(key => {
          if ((patientVisits.get(key) || 0) > 1) returnedCount++;
        });
        const returnRate = firstVisitCount > 0 ? (returnedCount / firstVisitCount) * 100 : 0;

        // Capture details for "Primeras Visitas" and "Volvieron"
        const details: AppointmentDetail[] = [];
        
        // Sort appointments of this physio chronologically for correct labeling
        const sortedCitas = [...citas].sort((a, b) => {
          const dateA = new Date(a.fecha_cita || 0).getTime();
          const dateB = new Date(b.fecha_cita || 0).getTime();
          return dateA - dateB;
        });

        const markedFirstVisit = new Set<string>();

        sortedCitas.forEach(c => {
          const key = (c.paciente_telefono || c.paciente_nombre || "").trim();
          if (!key || !patientFirstVisit.has(key)) return;

          const tipo = (c.tipo || "").toLowerCase();
          const asunto = (c.asunto || "").toLowerCase();
          const hasIndicator = tipo.includes("primera") || 
                              asunto.includes("primera sesion") || 
                              asunto.includes("primera sesión") ||
                              asunto.includes("1ª sesion") || 
                              asunto.includes("1ª sesión") || 
                              asunto.includes("1ª");

          let label: 'Primera Visita' | 'Volvieron' = 'Volvieron';

          // A patient gets "Primera Visita" ONLY for their first session WITH the indicator in this period
          if (hasIndicator && !markedFirstVisit.has(key)) {
            label = 'Primera Visita';
            markedFirstVisit.add(key);
          }

          details.push({
            fecha: c.fecha_cita || "",
            paciente: c.paciente_nombre || "Paciente",
            tipo: label
          });
        });

        results.push({
          name,
          avgVisitsPerPatient,
          totalPatients,
          totalVisits,
          returnRate,
          firstVisitPatients: firstVisitCount,
          returnedPatients: returnedCount,
          details: details.sort((a,b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        });
      }

      // Exclude non-physio agendas
      const EXCLUDED = ["recepcion"];
      return results
        .filter(p => !EXCLUDED.includes(p.name.trim().toLowerCase()))
        .sort((a, b) => b.totalVisits - a.totalVisits);
    },
  });
}

function PacientesMetricasTab({ yearNum, monthNum }: { yearNum: number; monthNum: number }) {
  const { data, isLoading, error } = usePacientesMetricasPorFisio(yearNum, monthNum);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (name: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    setExpandedRows(newSet);
  };

  if (isLoading) {
    return <div className="kpi-card"><Skeleton className="h-64 w-full" /></div>;
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="kpi-card">
        <p className="text-muted-foreground text-center py-8">
          {error ? "Error cargando datos" : "Sin datos de pacientes para este periodo."}
        </p>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <p className="kpi-label mb-4 uppercase">Métricas del Equipo por Profesional</p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="w-8"></th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Profesional</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Pacientes</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Citas Totales</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Media Citas/Paciente</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Primeras Visitas</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Volvieron</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Tasa Retorno</th>
            </tr>
          </thead>
          <tbody>
            {data.map(physio => {
              const isExpanded = expandedRows.has(physio.name);
              return (
                <Fragment key={physio.name}>
                  <tr 
                    onClick={() => toggleRow(physio.name)}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 pl-4 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="py-4 px-4 font-medium text-foreground">{physio.name}</td>
                    <td className="py-4 px-4 text-center font-semibold text-foreground">{physio.totalPatients}</td>
                    <td className="py-4 px-4 text-center font-semibold text-foreground">{physio.totalVisits}</td>
                    <td className="py-4 px-4 text-center font-semibold text-primary">{physio.avgVisitsPerPatient.toFixed(1)}</td>
                    <td className="py-4 px-4 text-center text-foreground">{physio.firstVisitPatients}</td>
                    <td className="py-4 px-4 text-center text-foreground">{physio.returnedPatients}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="font-semibold text-primary">
                        {physio.returnRate.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                  {isExpanded && physio.details.length > 0 && (
                    <tr className="bg-muted/5">
                      <td colSpan={8} className="py-4 px-8 border-b border-border/50">
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Desglose de Primeras Visitas y Retornos:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {physio.details.map((det, idx) => (
                              <div key={idx} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {new Date(det.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                  <span className="text-sm font-medium text-foreground">{det.paciente}</span>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                  det.tipo === 'Primera Visita' 
                                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                                    : 'bg-green-500/10 text-green-500 border border-green-500/20'
                                }`}>
                                  {det.tipo}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 font-semibold">
              <td colSpan={2} className="py-4 px-4 text-foreground text-center">Total / Media</td>
              <td className="py-4 px-4 text-center text-foreground">{data.reduce((s, p) => s + p.totalPatients, 0)}</td>
              <td className="py-4 px-4 text-center text-foreground">{data.reduce((s, p) => s + p.totalVisits, 0)}</td>
              <td className="py-4 px-4 text-center text-primary">
                {(data.reduce((s, p) => s + p.avgVisitsPerPatient, 0) / data.length).toFixed(1)}
              </td>
              <td className="py-4 px-4 text-center text-foreground">{data.reduce((s, p) => s + p.firstVisitPatients, 0)}</td>
              <td className="py-4 px-4 text-center text-foreground">{data.reduce((s, p) => s + p.returnedPatients, 0)}</td>
              <td className="py-4 px-4 text-center text-primary">
                {(() => {
                  const totalFirst = data.reduce((s, p) => s + p.firstVisitPatients, 0);
                  const totalReturned = data.reduce((s, p) => s + p.returnedPatients, 0);
                  return totalFirst > 0 ? `${Math.round((totalReturned / totalFirst) * 100)}%` : '-';
                })()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ==== VACACIONES Y DOCUMENTACIÓN TAB ====
function VacacionesDocumentacionTab({ yearNum, monthNum, selectedMonth }: { yearNum: number; monthNum: number; selectedMonth: string }) {
  const { data: vacaciones, isLoading } = useVacaciones(yearNum);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (isLoading) {
    return <div className="kpi-card"><Skeleton className="h-64 w-full" /></div>;
  }

  // Filter by month if monthNum !== -1
  const filtered = (vacaciones || []).filter(v => {
    if (monthNum === -1) return true;
    const date = new Date(v.fecha);
    return date.getMonth() === monthNum;
  });

  type StatDetails = { V: number; E: number; C: number; LD: number; M: number; total: number; dates: Record<string, string[]> };
  const stats = new Map<string, StatDetails>();

  filtered.forEach(v => {
    if (!stats.has(v.usuario)) {
      stats.set(v.usuario, { V: 0, E: 0, C: 0, LD: 0, M: 0, total: 0, dates: { V: [], E: [], C: [], LD: [], M: [] } });
    }
    const userStats = stats.get(v.usuario)!;
    if (userStats[v.tipo as keyof Omit<StatDetails, 'total' | 'dates'>] !== undefined) {
      // @ts-ignore
      userStats[v.tipo]++;
      userStats.total++;

      // format date as DD/MM
      const d = new Date(v.fecha);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      if (userStats.dates[v.tipo]) {
        userStats.dates[v.tipo].push(`${day}/${month}`);
      }
    }
  });

  const physios = Array.from(stats.entries()).map(([name, counts]) => ({
    name,
    V: counts.V || 0,
    E: counts.E || 0,
    LD: counts.LD || 0,
    C: counts.C || 0,
    M: counts.M || 0,
    total: counts.total || 0,
    dates: counts.dates
  }));

  const toggleRow = (name: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    setExpandedRows(newSet);
  };

  const TYPE_LABELS: Record<string, string> = {
    V: "Vacaciones",
    E: "Enfermedad",
    LD: "Libre Disposición",
    C: "Capacitación",
    M: "Maternidad"
  };

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <p className="kpi-label mb-4">Registro de Vacaciones y Ausencias</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="w-8"></th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Profesional</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Vacaciones (V)</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Enfermedad (E)</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Libre Disp. (LD)</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Capacitación (C)</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Maternidad (M)</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground text-primary">Total Ausencias</th>
              </tr>
            </thead>
            <tbody>
              {physios.length > 0 ? physios.map(p => {
                const isExpanded = expandedRows.has(p.name);
                return (
                  <Fragment key={p.name}>
                    <tr
                      onClick={() => toggleRow(p.name)}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="py-4 pl-4 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="py-4 px-4 font-medium text-foreground">{p.name}</td>
                      <td className="py-4 px-4 text-center text-foreground">{p.V}</td>
                      <td className="py-4 px-4 text-center text-foreground">{p.E}</td>
                      <td className="py-4 px-4 text-center text-foreground">{p.LD}</td>
                      <td className="py-4 px-4 text-center text-foreground">{p.C}</td>
                      <td className="py-4 px-4 text-center text-foreground">{p.M}</td>
                      <td className="py-4 px-4 text-center font-bold text-primary">{p.total}</td>
                    </tr>
                    {isExpanded && p.total > 0 && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="py-4 px-8 border-b border-border/50">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {Object.entries(p.dates).map(([type, datesArray]) => {
                              if (datesArray.length === 0) return null;
                              // Sort dates string (DD/MM) by taking them as strings is not perfect, but usually close enough for a single year layout
                              // Best is to just show them as they are parsed (they arrive sorted from query assuming ascending)
                              return (
                                <div key={type} className="bg-background rounded-md p-3 border border-border shadow-sm">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                                    {TYPE_LABELS[type]}
                                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{datesArray.length}</span>
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {datesArray.map((dateStr, idx) => (
                                      <span key={idx} className="text-xs bg-muted px-2 py-1 rounded-sm text-foreground">
                                        {dateStr}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">No hay registros de ausencias para este periodo. Importa el archivo para generarlos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kpi-card border border-dashed border-border flex flex-col items-center justify-center py-12 text-center bg-muted/20">
        <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Gestor Documental Centralizado</h3>
        <p className="text-muted-foreground max-w-md">
          (Próximamente) Módulo en desarrollo para subir anexos, contratos, protección de datos y documentación de prevención de riesgos laborales.
        </p>
        <Button variant="outline" className="mt-6" disabled>En Desarrollo</Button>
      </div>
    </div>
  );
}
