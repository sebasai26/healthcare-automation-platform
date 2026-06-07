import { useState, useMemo, useCallback, useEffect, Fragment } from "react";
import { Star, Calendar, TrendingUp, DollarSign, ChevronDown, ChevronUp, Pencil, Save, X, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KPICard } from "./KPICard";
import { useServicios, useServiciosPeriodos } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getWeek, startOfWeek, endOfWeek, setWeek, setYear } from "date-fns";
import { es } from "date-fns/locale";
import { DeleteDataButton } from "./DeleteDataButton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
interface ServiceData {
  name: string;
  revenue: number;
  sessions: number;
  margin: number;
}

interface ServicesSectionProps {
  data?: ServiceData[];
  topService?: { name: string; revenue: number; sessions: number };
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type FilterType = "year" | "month";



export function ServicesSection({ data, topService }: ServicesSectionProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filterType, setFilterType] = useState<FilterType>("month");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [pendingAdjustments, setPendingAdjustments] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: periodosData } = useServiciosPeriodos(selectedYear);
  const periodos = periodosData || [];

  // Get available months from periods
  const availableMonths = useMemo(() => {
    const monthSet = new Set<number>();
    periodos.forEach(p => {
      if (p.fecha_fin) {
        try {
          const month = parseISO(p.fecha_fin).getMonth();
          monthSet.add(month);
        } catch { }
      }
    });
    return Array.from(monthSet).sort((a, b) => a - b);
  }, [periodos]);

  // Build date range for query based on filter type
  const dateRange = useMemo(() => {
    if (filterType === "year") {
      return { fechaInicio: undefined, fechaFin: undefined };
    }



    if (filterType === "month") {
      // Filter periods by selected month
      const monthPeriodos = periodos.filter(p => {
        try {
          return parseISO(p.fecha_fin).getMonth() === selectedMonth;
        } catch {
          return false;
        }
      });

      if (monthPeriodos.length > 0) {
        const sortedPeriodos = [...monthPeriodos].sort((a, b) =>
          new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
        );
        return {
          fechaInicio: sortedPeriodos[0].fecha_inicio,
          fechaFin: sortedPeriodos[sortedPeriodos.length - 1].fecha_fin,
          isMonthlyAggregation: true
        };
      }
    }

    return { fechaInicio: undefined, fechaFin: undefined };
  }, [filterType, selectedMonth, periodos]);

  const { data: dbData, isLoading, error } = useServicios(
    selectedYear,
    dateRange.fechaInicio,
    dateRange.fechaFin,
    filterType !== "year" // Aggregate for month/week filters
  );

  const dbServices = dbData?.services || [];
  
  // Compute draft data including pending adjustments
  const displayData = useMemo(() => {
    const baseData = data || dbServices;
    if (Object.keys(pendingAdjustments).length === 0) return baseData;
    
    return baseData.map(service => {
      const delta = pendingAdjustments[service.name];
      if (!delta) return service;
      
      const pricePerSession = service.sessions > 0 ? (service.revenue / service.sessions) : 0;
      const revenueDelta = pricePerSession * delta;
      
      return {
        ...service,
        sessions: Math.max(0, service.sessions + delta),
        revenue: Math.max(0, service.revenue + revenueDelta)
      };
    });
  }, [data, dbServices, pendingAdjustments]);

  const displayTopService = useMemo(() => {
    if (topService) return topService;
    if (displayData.length === 0) return { name: "Sin datos", revenue: 0, sessions: 0 };
    return [...displayData].sort((a, b) => b.revenue - a.revenue)[0];
  }, [topService, displayData]);

  const handleAdjust = (serviceName: string, delta: number) => {
    setPendingAdjustments(prev => {
      const currentDelta = prev[serviceName] || 0;
      const newDelta = currentDelta + delta;
      
      // Don't allow negative sessions in the draft
      const baseService = (data || dbServices).find(s => s.name === serviceName);
      if (baseService && baseService.sessions + newDelta < 0) return prev;
      
      if (newDelta === 0) {
        const { [serviceName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [serviceName]: newDelta };
    });
  };

  const onCancel = () => {
    setPendingAdjustments({});
  };

  const onSave = async () => {
    if (Object.keys(pendingAdjustments).length === 0) return;
    
    setIsSaving(true);
    try {
      const updates = Object.entries(pendingAdjustments);
      
      for (const [serviceName, delta] of updates) {
        const baseService = (data || dbServices).find(s => s.name === serviceName);
        if (!baseService) continue;
        
        const pricePerSession = baseService.sessions > 0 ? (baseService.revenue / baseService.sessions) : 0;
        const revenueDelta = pricePerSession * delta;

        let query = supabase
          .from("analisis_servicios")
          .select("id, num_citas, importe_total")
          .eq("anio", selectedYear)
          .eq("servicio", serviceName);

        if (dateRange.fechaInicio && dateRange.fechaFin) {
          query = query.eq("fecha_inicio", dateRange.fechaInicio).eq("fecha_fin", dateRange.fechaFin);
        } else if (filterType === "month") {
          query = query.eq("mes", selectedMonth + 1);
        }

        const { data: rows, error: fetchError } = await query;
        
        if (fetchError || !rows || rows.length === 0) {
          throw new Error(`No se encontraron registros para ${serviceName}`);
        }

        const targetRow = rows[0];
        const newNumCitas = Math.max(0, (targetRow.num_citas || 0) + delta);
        const newImporteTotal = Math.max(0, (targetRow.importe_total || 0) + revenueDelta);
        
        const { error: updateError } = await supabase
          .from("analisis_servicios")
          .update({
            num_citas: newNumCitas,
            importe_total: newImporteTotal
          })
          .eq("id", targetRow.id);

        if (updateError) throw updateError;
      }

      await queryClient.invalidateQueries({ queryKey: ["servicios"] });
      setPendingAdjustments({});
      toast({
        title: "Cambios guardados",
        description: "Se han actualizado los servicios correctamente.",
      });
    } catch (err: any) {
      console.error("Error saving updates:", err);
      toast({
        title: "Error al guardar cambios",
        description: err.message || "Ocurrió un error inesperado.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Generate years from current year back to 2025
  const years = useMemo(() => {
    const result: number[] = [];
    for (let y = currentYear; y >= 2025; y--) {
      result.push(y);
    }
    return result;
  }, [currentYear]);

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          Servicios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="kpi-card">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="kpi-card">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        <div className="kpi-card">
          <Skeleton className="h-48 w-full" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          Servicios
        </h3>
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            Error cargando datos de servicios
          </p>
        </div>
      </section>
    );
  }

  // Get period label for delete button and subtitle
  const getPeriodLabel = (): string => {
    if (filterType === "year") return "Este año";
    if (filterType === "month") return MONTH_NAMES[selectedMonth];
    return "Este año";
  };

  const getMonthForDelete = (): string | undefined => {
    if (filterType === "month") return MONTH_NAMES[selectedMonth];
    return undefined;
  };

  return (
    <section className="animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <Star className="w-5 h-5 text-primary" />
            Servicios
          </h3>
          <DeleteDataButton
            dataType="servicios"
            year={selectedYear}
            month={getMonthForDelete()}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedYear.toString()} onValueChange={(v) => {
              setSelectedYear(parseInt(v));
              setFilterType("year");
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter type selector */}
          <Select value={filterType} onValueChange={(v: FilterType) => setFilterType(v)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Anual</SelectItem>
              <SelectItem value="month">Mensual</SelectItem>
            </SelectContent>
          </Select>

          {/* Month selector (shown when filterType is month) */}
          {filterType === "month" && (
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.length > 0 ? (
                  availableMonths.map(monthIdx => (
                    <SelectItem key={monthIdx} value={monthIdx.toString()}>
                      {MONTH_NAMES[monthIdx]}
                    </SelectItem>
                  ))
                ) : (
                  MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>{name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="kpi-card bg-gradient-to-br from-accent to-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="kpi-label">Servicio con Más Facturación</p>
              <p className="text-xl font-semibold text-foreground mt-2 uppercase">
                {displayTopService.name}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="mt-4 flex gap-6 items-end">
            <div>
              <p className="text-sm text-muted-foreground">Ingresos</p>
              <p className="font-semibold text-foreground">
                {displayTopService.revenue.toLocaleString()}€
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sesiones</p>
              <p className="font-semibold text-foreground">{displayTopService.sessions}</p>
            </div>
          </div>
        </div>

        <KPICard
          label="Total Servicios Activos"
          value={displayData.length}
          subtitle={getPeriodLabel()}
        />
      </div>

      {/* Rentabilidad SUPERINDUCTIVA */}
      <SuperinductivaROI
        services={displayData}
        filterType={filterType}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
      />

      {displayData.length > 0 && (
        <>
          <ServiceTable 
            services={displayData} 
            year={selectedYear} 
            month={filterType === "month" ? selectedMonth : undefined}
            startDate={dateRange.fechaInicio}
            endDate={dateRange.fechaFin}
            pendingAdjustments={pendingAdjustments}
            onAdjust={handleAdjust}
          />

          {Object.keys(pendingAdjustments).length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-md border border-primary/20 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-foreground">Cambios pendientes</p>
                <p className="text-xs text-muted-foreground">{Object.keys(pendingAdjustments).length} servicio(s) modificado(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onCancel}
                  disabled={isSaving}
                  className="rounded-xl border-border hover:bg-muted"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={onSave}
                  disabled={isSaving}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Guardando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {displayData.length === 0 && (
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            No hay datos de servicios para el periodo seleccionado
          </p>
        </div>
      )}
    </section>
  );
}

const DEFAULT_VISIBLE = 5;

function ServiceTable({ 
  services, 
  year, 
  month, 
  startDate, 
  endDate,
  pendingAdjustments,
  onAdjust
}: { 
  services: ServiceData[], 
  year: number, 
  month?: number, 
  startDate?: string, 
  endDate?: string,
  pendingAdjustments: Record<string, number>,
  onAdjust: (name: string, delta: number) => void
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Pre-filter services based on search query
  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const q = normalize(searchQuery);
    
    return services.filter(s => normalize(s.name).includes(q));
  }, [services, searchQuery]);

  // Grouping configuration
  const groupsConfig = [
    { 
      name: "Fisioterapia", 
      match: (s: string) => {
        const norm = s.toLowerCase();
        const isPilates = norm.includes("pilates");
        return (norm.includes("sucesivas") || norm.includes("fisioterapia sucesivas promo") || norm.includes("domicilio fisioterapia") || norm.includes("fisioterapia neurologica")) && !isPilates;
      }
    },
    { 
      name: "Pilates", 
      match: (s: string) => s.toLowerCase().includes("pilates") 
    },
    { 
      name: "Primera sesión", 
      match: (s: string) => {
        const norm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return norm.includes("primera sesi") || norm.includes("1a sesion") || s.includes("1ª SESION");
      }
    }
  ];

  // Process data for grouping
  const groupedData = useMemo(() => {
    const result: { type: 'item' | 'group', data: ServiceData, items?: ServiceData[], isExpanded?: boolean }[] = [];
    const usedServices = new Set<string>();

    groupsConfig.forEach(config => {
      const groupItems = filteredServices.filter(s => !usedServices.has(s.name) && config.match(s.name));
      if (groupItems.length > 0) {
        groupItems.forEach(s => usedServices.add(s.name));
        
        const groupStats: ServiceData = {
          name: config.name,
          revenue: groupItems.reduce((sum, s) => sum + s.revenue, 0),
          sessions: groupItems.reduce((sum, s) => sum + s.sessions, 0),
          margin: groupItems.length > 0 ? Math.round(groupItems.reduce((sum, s) => sum + s.margin, 0) / groupItems.length) : 0
        };

        result.push({ 
          type: 'group', 
          data: groupStats, 
          items: groupItems,
          isExpanded: !!expandedGroups[config.name]
        });
      }
    });

    // Add remaining individual services
    filteredServices.forEach(s => {
      if (!usedServices.has(s.name)) {
        result.push({ type: 'item', data: s });
      }
    });

    return result;
  }, [filteredServices, expandedGroups]);

  const visible = showAll ? groupedData : groupedData.slice(0, DEFAULT_VISIBLE);
  const hasMore = groupedData.length > DEFAULT_VISIBLE;
  const { toast } = useToast();
  
  const renderRow = (service: ServiceData, isPending: boolean, isGroupMember: boolean = false) => (
    <tr key={service.name} className={`border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${isPending ? 'bg-primary/5' : ''} ${isGroupMember ? 'bg-muted/20' : ''}`}>
      <td className={`py-3 px-4 font-medium text-foreground ${isGroupMember ? 'pl-10' : ''}`}>
        <div className="flex items-center gap-2">
          <span className={isGroupMember ? 'text-sm text-muted-foreground' : ''}>{service.name}</span>
          {isPending && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
        </div>
      </td>
      <td className={`py-3 px-4 text-right text-foreground ${isGroupMember ? 'text-sm' : ''}`}>{service.revenue.toLocaleString()}€</td>
      <td className="py-3 px-4 text-right text-muted-foreground">
        <div className="flex items-center justify-end gap-2">
          <span className={`font-semibold ${isPending ? 'text-primary' : (isGroupMember ? 'text-sm' : 'text-foreground')}`}>
            {service.sessions}
          </span>
          {!isGroupMember || isPending || true ? ( // Keeping controls for members too
            <div className="flex items-center gap-1 bg-background rounded-md border border-border p-0.5 ml-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-5 h-5 rounded-sm text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onAdjust(service.name, -1); }}
                disabled={service.sessions <= 0}
              >
                <span className="text-lg leading-none mb-0.5">-</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-5 h-5 rounded-sm text-muted-foreground hover:text-success"
                onClick={(e) => { e.stopPropagation(); onAdjust(service.name, 1); }}
              >
                <span className="text-lg leading-none mb-0.5">+</span>
              </Button>
            </div>
          ) : null}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="px-2 py-1 bg-success-muted text-success rounded-md text-sm font-medium">{service.margin}%</span>
      </td>
    </tr>
  );
  return (
    <div className="kpi-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar servicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-background border-border rounded-xl focus-visible:ring-primary shadow-sm"
          />
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Servicio</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ingresos</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground w-40">Sesiones</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Margen Est.</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry) => {
            if (entry.type === 'item') {
              return renderRow(entry.data, !!pendingAdjustments[entry.data.name]);
            } else {
              const groupPending = entry.items?.some(item => !!pendingAdjustments[item.name]);
              return (
                <Fragment key={entry.data.name}>
                  <tr 
                    className={`border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group/row`}
                    onClick={() => toggleGroup(entry.data.name)}
                  >
                    <td className="py-3 px-4 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        {entry.isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        {entry.data.name}
                        {groupPending && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-foreground font-bold">{entry.data.revenue.toLocaleString()}€</td>
                    <td className="py-3 px-4 text-right text-foreground font-bold">
                      <div className="flex items-center justify-end gap-2 pr-12">
                        {entry.data.sessions}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">Grupo ({entry.items?.length})</span>
                    </td>
                  </tr>
                  {entry.isExpanded && entry.items?.map(item => renderRow(item, !!pendingAdjustments[item.name], true))}
                </Fragment>
              );
            }
          })}
        </tbody>
      </table>
      {hasMore && (
        <div className="flex justify-center py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="gap-1">
            {showAll ? (<>Mostrar menos <ChevronUp className="w-4 h-4" /></>) : (<>Mostrar todos ({filteredServices.length}) <ChevronDown className="w-4 h-4" /></>)}
          </Button>
        </div>
      )}
    </div>
  );
}

interface SuperinductivaConfig {
  coste_mensual: number;
  dia_pago: number;
  costes_especiales: { mes: string; anio: number; coste: number }[];
}

const DEFAULT_CONFIG: SuperinductivaConfig = {
  coste_mensual: 200,
  dia_pago: 1,
  costes_especiales: [{ mes: "Enero", anio: 2026, coste: 1000 }],
};

function useSuperinductivaConfig() {
  return useQuery({
    queryKey: ["superinductiva_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_config")
        .select("value")
        .eq("key", "superinductiva_config")
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        try { return JSON.parse(data.value) as SuperinductivaConfig; } catch { return DEFAULT_CONFIG; }
      }
      return DEFAULT_CONFIG;
    },
  });
}

function SuperinductivaROI({
  services,
  filterType,
  selectedYear,
  selectedMonth,
  availableMonths
}: {
  services: ServiceData[];
  filterType: FilterType;
  selectedYear: number;
  selectedMonth: number;
  availableMonths: number[];
}) {
  const { data: config } = useSuperinductivaConfig();
  const cfg = config || DEFAULT_CONFIG;

  const { totalCost, costLabel } = useMemo(() => {
    const getCostForMonth = (monthIdx: number): number => {
      const monthName = MONTH_NAMES[monthIdx];
      const special = cfg.costes_especiales.find(
        (c) => c.mes === monthName && c.anio === selectedYear
      );
      return special ? special.coste : cfg.coste_mensual;
    };


    if (filterType === "month") {
      const cost = getCostForMonth(selectedMonth);
      return { totalCost: cost, costLabel: `${cost.toFixed(0)}€ (${MONTH_NAMES[selectedMonth]})` };
    }
    const months = availableMonths.length > 0 ? availableMonths : [0];
    const total = months.reduce((sum, m) => sum + getCostForMonth(m), 0);
    const detail = months.map(m => `${MONTH_NAMES[m].slice(0, 3)}: ${getCostForMonth(m)}€`).join(', ');
    return { totalCost: total, costLabel: `${total.toFixed(0)}€ (${detail})` };
  }, [filterType, selectedMonth, selectedYear, availableMonths, cfg]);

  const superinductiva = services.find(s => s.name.toUpperCase().includes("SUPERINDUCTIVA"));

  if (!superinductiva) return null;

  const revenue = superinductiva.revenue;
  const balance = revenue - totalCost;
  const roi = totalCost > 0 ? revenue / totalCost : 0;
  const isPositive = balance >= 0;

  return (
    <div className="mt-6 kpi-card border-l-4 border-l-primary">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Rentabilidad SUPERINDUCTIVA</h4>
        <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
          Coste: {costLabel}
        </span>
        <EditCostDialog config={cfg} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Ingresos</p>
          <p className="text-lg font-semibold text-foreground">{revenue.toLocaleString()}€</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Coste</p>
          <p className="text-lg font-semibold text-foreground">{totalCost.toFixed(0)}€</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className="text-lg font-semibold text-foreground">
            {isPositive ? '+' : ''}{balance.toFixed(0)}€
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">ROI</p>
          <p className="text-lg font-semibold text-foreground">
            {roi.toFixed(2).replace('.', ',')}
          </p>
        </div>
      </div>
    </div>
  );
}

function EditCostDialog({ config }: { config: SuperinductivaConfig }) {
  const [open, setOpen] = useState(false);
  const [costeMensual, setCosteMensual] = useState(config.coste_mensual);
  const [diaPago, setDiaPago] = useState(config.dia_pago);
  const [especiales, setEspeciales] = useState(config.costes_especiales);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setCosteMensual(config.coste_mensual);
    setDiaPago(config.dia_pago);
    setEspeciales(config.costes_especiales);
  }, [config]);

  const handleSave = async () => {
    const newConfig: SuperinductivaConfig = {
      coste_mensual: costeMensual,
      dia_pago: diaPago,
      costes_especiales: especiales,
    };
    const { error } = await supabase
      .from("clinic_config")
      .upsert({ 
        key: "superinductiva_config",
        value: JSON.stringify(newConfig), 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });

    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["superinductiva_config"] });
    toast({ title: "Configuración guardada" });
    setOpen(false);
  };

  const addEspecial = () => {
    setEspeciales([...especiales, { mes: "Enero", anio: new Date().getFullYear(), coste: 0 }]);
  };

  const removeEspecial = (idx: number) => {
    setEspeciales(especiales.filter((_, i) => i !== idx));
  };

  const updateEspecial = (idx: number, field: string, value: any) => {
    setEspeciales(especiales.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar coste SUPERINDUCTIVA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Coste mensual (€)</label>
              <Input type="number" value={costeMensual} onChange={(e) => setCosteMensual(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Se aplica a meses sin coste especial</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Día de pago</label>
              <Input type="number" min={1} max={31} value={diaPago} onChange={(e) => setDiaPago(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Costes especiales por mes</label>
              <Button variant="ghost" size="sm" onClick={addEspecial} className="h-7 gap-1">
                <Plus className="w-3.5 h-3.5" /> Añadir
              </Button>
            </div>
            {especiales.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay costes especiales.</p>
            )}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {especiales.map((e, idx) => (
                <div key={idx} className="flex flex-col gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 relative group">
                  <div className="flex items-center gap-2">
                    <Select value={e.mes} onValueChange={(v) => updateEspecial(idx, "mes", v)}>
                      <SelectTrigger className="w-full h-9 text-sm rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={e.anio.toString()} onValueChange={(v) => updateEspecial(idx, "anio", parseInt(v))}>
                      <SelectTrigger className="w-24 h-9 text-sm rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2025, 2026, 2027].map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input 
                        type="number" 
                        value={e.coste} 
                        onChange={(ev) => updateEspecial(idx, "coste", Number(ev.target.value))} 
                        className="pl-8 h-9 text-sm rounded-lg" 
                        placeholder="Coste especial" 
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" 
                      onClick={() => removeEspecial(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" /> Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}