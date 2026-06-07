import React, { useState, useMemo } from "react";
import { Users, Calendar, Activity, Euro, Filter, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useProductividadEquipo } from "@/hooks/useDashboardData";
import { useContabilidadResumen } from "@/hooks/useContabilidad";
import { useBeneficioReal } from "@/hooks/useBeneficioReal";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteDataButton } from "./DeleteDataButton";
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

export function ProductivitySection() {
  const currentYear = new Date().getFullYear();
  
  // Generate years from current year back to 2025
  const YEARS = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = currentYear; y >= 2025; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, [currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState("-1"); // -1 = all year
  const [expandedPhysio, setExpandedPhysio] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { data, isLoading, error } = useProductividadEquipo(
    parseInt(selectedYear),
    parseInt(selectedMonth)
  );

  const { data: contabResumen, isLoading: isLoadingContab } = useContabilidadResumen(
    parseInt(selectedYear), 
    parseInt(selectedMonth) === -1 ? undefined : parseInt(selectedMonth)
  );

  const isAllYear = parseInt(selectedMonth) === -1;
  const monthIdx = isAllYear ? 0 : parseInt(selectedMonth);
  const getBeneficioReal = useBeneficioReal(contabResumen, isAllYear, monthIdx);

  const getOccupancyColor = (occupancy: number) => {
    if (occupancy >= 80) return "text-success";
    if (occupancy >= 60) return "text-primary";
    return "text-warning";
  };

  const periodLabel = selectedMonth === "-1" 
    ? `Total ${selectedYear}` 
    : `${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <Users className="w-5 h-5 text-primary" />
            Productividad del Equipo
          </h3>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="kpi-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Profesional</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Citas</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Ocupación</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Horas</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Facturación</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">€ neto/hora</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-4 px-4 text-center"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="py-4 px-4 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="py-4 px-4 text-center"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="py-4 px-4 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="py-4 px-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <Users className="w-5 h-5 text-primary" />
            Productividad del Equipo
          </h3>
          <DailyOccupancyCalculator />
          <DeleteDataButton 
            dataType="productividad" 
            year={parseInt(selectedYear)} 
            month={selectedMonth} 
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(year => (
                <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error || !data || data.length === 0 ? (
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            {error ? "Error cargando datos" : `Sin datos de productividad para ${periodLabel}. Sube los CSVs para comenzar.`}
          </p>
        </div>
      ) : (
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
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Profesional
                    </span>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Citas
                    </span>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <Activity className="w-4 h-4" />
                      Ocupación
                    </span>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      Horas
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                    <span className="flex items-center justify-end gap-2">
                      <Euro className="w-4 h-4" />
                      Facturación
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                    <span className="flex items-center justify-end gap-2">
                      <Euro className="w-4 h-4" />
                      € neto/hora
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((physio) => {
                  const isCristinaPonce = physio.name.toLowerCase() === 'cristina ponce';
                  const beneficio = getBeneficioReal(physio.name);
                  const displayRevenue = isCristinaPonce ? physio.profitFallback : physio.revenue;
                  const displayBeneficio = isCristinaPonce ? beneficio : (beneficio !== null ? beneficio : physio.profitFallback);
                  
                  return (
                  <React.Fragment key={physio.name}>
                    <tr 
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        setExpandedPhysio(physio.name);
                        setIsModalOpen(true);
                      }}
                    >
                      <td className="py-4 px-2 text-center text-muted-foreground">
                        {expandedPhysio === physio.name ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-foreground">{physio.name}</span>
                      </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-foreground font-semibold">{physio.appointments}</span>
                    </td>
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
                            {physio.occupancy.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-foreground font-semibold">
                        {physio.hours > 0 ? physio.hours.toFixed(1) : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-foreground">
                        {displayRevenue.toLocaleString('es-ES')}€
                      </span>
                    </td>
                    <td className={`py-4 px-4 text-right font-semibold ${displayBeneficio !== null && displayBeneficio !== 0 ? (displayBeneficio > 0 ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                      {physio.hours > 0 && displayBeneficio !== null && displayBeneficio !== 0 ? `${(displayBeneficio / physio.hours).toFixed(2)}€` : '-'}
                    </td>
                    </tr>
                  </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td colSpan={2} className="py-4 px-4 text-foreground">Total / Media</td>
                  <td className="py-4 px-4 text-center text-foreground">
                    {data.reduce((sum, p) => sum + p.appointments, 0)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={getOccupancyColor(
                      (() => {
                        const filtered = data.filter(p => !p.name.toLowerCase().includes('cristina ponce'));
                        return filtered.length > 0 ? filtered.reduce((sum, p) => sum + p.occupancy, 0) / filtered.length : 0;
                      })()
                    )}>
                      {(() => {
                        const filtered = data.filter(p => !p.name.toLowerCase().includes('cristina ponce'));
                        return filtered.length > 0 ? Math.round(filtered.reduce((sum, p) => sum + p.occupancy, 0) / filtered.length) : 0;
                      })()}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-foreground">
                    {data.reduce((sum, p) => sum + p.hours, 0).toFixed(1)}
                  </td>
                  <td className="py-4 px-4 text-right text-foreground">
                    {(() => {
                      let total = 0;
                      data.forEach(p => {
                        const isCP = p.name.toLowerCase() === 'cristina ponce';
                        total += isCP ? p.profitFallback : p.revenue;
                      });
                      return total.toLocaleString('es-ES');
                    })()}€
                  </td>
                  <td className="py-4 px-4 text-right text-primary">
                    {(() => {
                      const totalHours = data.reduce((sum, p) => sum + p.hours, 0);
                      let totalProfit = 0;
                      data.forEach(p => {
                         const b = getBeneficioReal(p.name);
                         const db = p.name.toLowerCase() === 'cristina ponce' ? b : (b !== null ? b : p.profitFallback);
                         totalProfit += (db || 0);
                      });
                      
                      return totalHours > 0 && totalProfit > 0 ? `${(totalProfit / totalHours).toFixed(2)}€` : '-';
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      
      {expandedPhysio && (
        <PhysioActivityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setExpandedPhysio(null);
          }}
          physioName={expandedPhysio}
          year={parseInt(selectedYear)}
          month={selectedMonth !== "-1" ? parseInt(selectedMonth) : undefined}
        />
      )}

    </section>
  );
}
