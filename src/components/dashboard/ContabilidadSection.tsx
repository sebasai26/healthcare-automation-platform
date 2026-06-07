import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Wallet, Users, Calendar, Filter, Edit2, Save, X, Trash2, Plus, AlertTriangle, Info, Home } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KPICard } from "./KPICard";
import { useContabilidadResumen, useContabilidadData, useUpdateContabilidadItem, useDeleteContabilidadItem, useInvalidateContabilidad, EXPENSE_SECTIONS, PROF_SECTIONS, getProfDisplayName, MONTH_KEYS as HOOK_MONTH_KEYS, MONTH_NAMES as HOOK_MONTH_NAMES, type ContabilidadItem } from "@/hooks/useContabilidad";
import { useIngresos, useIngresosHistorial } from "@/hooks/useDashboardData";
import { useToast } from "@/hooks/use-toast";
import { AlquilerSalaSection } from "./AlquilerSalaSection";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, Line, ComposedChart,
} from "recharts";

const MONTH_KEYS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const SECTION_LABELS: Record<string, string> = {
  EMPLEADOS: "Empleados",
  ALQUILER: "Alquiler de Sala",
};

export function ContabilidadSection() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [activeTab, setActiveTab] = useState("resumen");

  const yearNum = parseInt(selectedYear);
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-based
  const hastaMes = selectedMonth === "actual" ? currentMonth : (selectedMonth === "anual" ? 11 : parseInt(selectedMonth));

  // For useIngresos, "anual" means undefined month. "actual" means currentMonth. Otherwise parse it.
  const ingresosMonthNum = selectedMonth === "anual" ? undefined : (selectedMonth === "actual" ? currentMonth : parseInt(selectedMonth));

  const { data: resumen, items, isLoading, error } = useContabilidadResumen(yearNum, hastaMes);
  const { data: ingresosData } = useIngresos(yearNum, ingresosMonthNum);
  const { data: historialData } = useIngresosHistorial(yearNum);

  console.log("ContabilidadSection -> selectedMonth:", selectedMonth, "ingresosMonthNum:", ingresosMonthNum, "ingresosData:", ingresosData);

  const MONTHS_OPTIONS = useMemo(() => [
    { value: "anual", label: "Anual" },
    ...(parseInt(selectedYear) === currentYear ? [{ value: "actual", label: "Hasta hoy" }] : []),
    ...HOOK_MONTH_NAMES.map((name, i) => ({ value: i.toString(), label: name })),
  ], [selectedYear, currentYear]);

  const YEARS = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = currentYear; y >= 2025; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, [currentYear]);

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <h2 className="text-2xl font-bold text-foreground mb-2">Contabilidad y Beneficios</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="kpi-card"><Skeleton className="h-20 w-full" /></div>
          ))}
        </div>
      </section>
    );
  }

  const noData = !resumen || !items || items.length === 0;

  return (
    <section className="animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Contabilidad y Beneficios</h2>
          <p className="text-muted-foreground">Ingresos, gastos y rentabilidad de la clínica</p>
          {(selectedMonth === "actual" || (parseInt(selectedMonth) === new Date().getMonth() && parseInt(selectedYear) === new Date().getFullYear())) && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-500/10 px-2.5 py-1.5 rounded-md w-fit border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Los datos del mes actual pueden ser inexactos si no has subido el último archivo de contabilidad.</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {noData ? (
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            Sin datos de contabilidad para {selectedYear}. Sube un archivo de "Contabilidad Clínica" desde Importar Datos.
          </p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="resumen" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="gastos" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Gastos</span>
            </TabsTrigger>
            <TabsTrigger value="profesionales" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Profesionales</span>
            </TabsTrigger>
            <TabsTrigger value="alquiler" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Alquiler</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <ResumenTab resumen={resumen!} ingresosData={ingresosData} historialData={historialData} year={selectedYear} items={items!} selectedMonth={selectedMonth} />
          </TabsContent>
          <TabsContent value="gastos">
            <GastosTab items={items!} year={yearNum} />
          </TabsContent>
          <TabsContent value="profesionales">
            <ProfesionalesTab resumen={resumen!} items={items!} />
          </TabsContent>
          <TabsContent value="alquiler">
            <AlquilerSalaSection selectedYear={yearNum} />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

// =================== RESUMEN TAB ===================
function ResumenTab({ resumen, ingresosData, historialData, year, items, selectedMonth }: { resumen: any; ingresosData: any; historialData: any; year: string; items: ContabilidadItem[]; selectedMonth: string }) {
  // Determine which month key to use for the KPI blocks based on filter
  const isAnualOrActual = selectedMonth === "anual" || selectedMonth === "actual";
  const getMonthKey = (): string | null => {
    if (isAnualOrActual) return null;
    const idx = parseInt(selectedMonth);
    if (idx >= 0 && idx < 12) return MONTH_KEYS[idx];
    return null;
  };
  const monthKey = getMonthKey();
  const monthLabel = monthKey ? MONTH_LABELS[MONTH_KEYS.indexOf(monthKey as typeof MONTH_KEYS[number])] : (selectedMonth === "actual" ? "Hasta hoy" : null);

  // Helper: get value for the active period (specific month or accumulated total)
  const valFor = (obj: Record<string, number> | undefined) => {
    if (!obj) return 0;
    return monthKey ? (obj[monthKey] || 0) : (obj.total || 0);
  };

  // Ingresos Totales = prioritized from Análisis de Caja (ingresosData.weeklyRevenue), 
  // fallback to sum of professional incomes if no balance data exists
  const totalIngresosFromBalance = ingresosData?.weeklyRevenue || 0;
  const totalIngresos = totalIngresosFromBalance > 0
    ? totalIngresosFromBalance
    : (resumen.profBeneficios
      ? resumen.profBeneficios.reduce((s: number, p: any) => s + valFor(p.ingreso), 0)
      : valFor(resumen.ingresos));

  // Sync Gastos Totales = Gastos Fijos + Gastos Variables + Empleados Sin IRPF (from EMPLEADOS section)
  const gastosFijosDisplay = valFor(resumen.gastosFijos);
  const gastosVariablesDisplay = valFor(resumen.gastosVariables);
  const empleadosCostDisplay = valFor(resumen.gastosEmpleados);
  const totalGastos = gastosFijosDisplay + gastosVariablesDisplay + empleadosCostDisplay;
  const beneficioNeto = totalIngresos - totalGastos;


  const [editingProf, setEditingProf] = useState(false);
  const [profEditValues, setProfEditValues] = useState<Record<string, { ingreso: number; coste: number }>>({});
  const [newProfName, setNewProfName] = useState("");
  const [showAddProf, setShowAddProf] = useState(false);
  const updateItem = useUpdateContabilidadItem();
  const invalidateContabilidad = useInvalidateContabilidad();
  const { toast } = useToast();

  const handleStartProfEdit = () => {
    const values: Record<string, { ingreso: number; coste: number }> = {};
    resumen.profBeneficios.forEach((p: any) => {
      if (monthKey) {
        values[p.seccion] = {
          ingreso: p.ingreso?.[monthKey] || 0,
          coste: p.gasto?.[monthKey] || 0,
        };
      } else {
        values[p.seccion] = {
          ingreso: p.ingreso?.total || 0,
          coste: p.gasto?.total || 0,
        };
      }
    });
    setProfEditValues(values);
    setEditingProf(true);
    setShowAddProf(false);
    setNewProfName("");
  };

  const handleAddProf = () => {
    const name = newProfName.trim();
    if (!name) return;
    // Add to edit values with 0/0
    setProfEditValues(prev => ({
      ...prev,
      [`__NEW__${name}`]: { ingreso: 0, coste: 0 },
    }));
    setNewProfName("");
    setShowAddProf(false);
  };

  const handleSaveProf = async () => {
    try {
      const promises: Promise<void>[] = [];
      const inserts: any[] = [];
      const yearNum = parseInt(year);

      // Handle existing professionals
      for (const p of resumen.profBeneficios) {
        const editVal = profEditValues[p.seccion];
        if (!editVal) continue;

        const profItems = items.filter(i => i.seccion === p.seccion);

        // === INGRESO ===
        const allIngresoRows = profItems.filter(i => i.concepto.toUpperCase().includes('INGRESO'));
        const nonClinicCloud = allIngresoRows.filter(i => !i.concepto.toUpperCase().includes('CLINIC CLOUD'));
        const ingresoRows = nonClinicCloud.length > 0 ? nonClinicCloud : allIngresoRows;

        const oldIngreso = monthKey ? (p.ingreso?.[monthKey] || 0) : (p.ingreso?.total || 0);
        const newIngreso = editVal.ingreso;

        if (oldIngreso !== newIngreso) {
          if (monthKey) {
            if (ingresoRows.length > 0) {
              promises.push(updateItem(ingresoRows[0].id, monthKey, newIngreso));
            } else {
              const insertData: Record<string, any> = { seccion: p.seccion, concepto: 'INGRESO', anio: yearNum };
              MONTH_KEYS.forEach(mk => insertData[mk] = 0);
              insertData[monthKey] = newIngreso;
              insertData.total = newIngreso;
              inserts.push(insertData);
            }
          }
        }

        // === COSTE (GASTO CON IRPF) ===
        const gastoRows = profItems.filter(i => i.concepto.toUpperCase().trim() === 'GASTO CON IRPF');
        const isAutonomous = ['Cristina autonoma', 'Paula autonoma'].includes(p.seccion);
        const empRows = isAutonomous
          ? items.filter(i => i.seccion === 'EMPLEADOS' && i.concepto.trim() === p.seccion)
          : [];
        const costRows = gastoRows.length > 0 ? gastoRows : empRows;

        const oldCoste = monthKey ? (p.gasto?.[monthKey] || 0) : (p.gasto?.total || 0);
        const newCoste = editVal.coste;

        if (oldCoste !== newCoste) {
          if (monthKey) {
            if (costRows.length > 0) {
              promises.push(updateItem(costRows[0].id, monthKey, newCoste));
            } else {
              const insertData: Record<string, any> = { seccion: p.seccion, concepto: 'GASTO CON IRPF', anio: yearNum };
              MONTH_KEYS.forEach(mk => insertData[mk] = 0);
              insertData[monthKey] = newCoste;
              insertData.total = newCoste;
              inserts.push(insertData);
            }
          }
        }
      }

      // Handle new professionals (keys starting with __NEW__)
      for (const [key, editVal] of Object.entries(profEditValues)) {
        if (!key.startsWith('__NEW__')) continue;
        const profName = key.replace('__NEW__', '');
        if (!profName) continue;

        if (monthKey) {
          // Create INGRESO row
          if (editVal.ingreso !== 0) {
            const ingresoData: Record<string, any> = { seccion: profName, concepto: 'INGRESO', anio: yearNum };
            MONTH_KEYS.forEach(mk => ingresoData[mk] = 0);
            ingresoData[monthKey] = editVal.ingreso;
            ingresoData.total = editVal.ingreso;
            inserts.push(ingresoData);
          }
          // Create GASTO CON IRPF row
          if (editVal.coste !== 0) {
            const gastoData: Record<string, any> = { seccion: profName, concepto: 'GASTO CON IRPF', anio: yearNum };
            MONTH_KEYS.forEach(mk => gastoData[mk] = 0);
            gastoData[monthKey] = editVal.coste;
            gastoData.total = editVal.coste;
            inserts.push(gastoData);
          }
          // Create placeholder rows even if values are 0, so the professional section exists
          if (editVal.ingreso === 0 && editVal.coste === 0) {
            const placeholder: Record<string, any> = { seccion: profName, concepto: 'INGRESO', anio: yearNum };
            MONTH_KEYS.forEach(mk => placeholder[mk] = 0);
            placeholder.total = 0;
            inserts.push(placeholder);
          }
        }
      }

      // Insert new rows if needed
      if (inserts.length > 0) {
        const { error } = await (supabase as any).from("contabilidad_clinica").insert(inserts);
        if (error) throw error;
      }

      if (promises.length === 0 && inserts.length === 0) {
        toast({ title: "Sin cambios", description: "No se detectaron cambios para guardar." });
        setEditingProf(false);
        return;
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
      await invalidateContabilidad();
      setEditingProf(false);
      toast({ title: "Cambios guardados", description: `Se actualizaron ${promises.length + inserts.length} valores correctamente.` });
    } catch (e: any) {
      console.error("[ContabilidadSection] Save error:", e);
      toast({ title: "Error al guardar", description: e?.message || "No se pudieron guardar los cambios.", variant: "destructive" });
    }
  };

  // Combine existing professionals with new ones for display
  const displayProfs = [
    ...resumen.profBeneficios,
    ...Object.keys(profEditValues)
      .filter(k => k.startsWith('__NEW__'))
      .map(k => ({
        seccion: k,
        nombre: k.replace('__NEW__', ''),
        ingreso: undefined,
        gasto: undefined,
        beneficio: undefined,
      })),
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          label={`Ingresos Totales${monthLabel ? ` (${monthLabel})` : ''}`}
          value={`${totalIngresos.toLocaleString('es-ES')}€`}
        />
        <KPICard
          label="Gastos Totales"
          value={`${totalGastos.toLocaleString('es-ES')}€`}
        />
        <div className="kpi-card">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="kpi-label mb-0">Beneficio Neto</p>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger type="button" className="cursor-help">
                  <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calculado como: <strong>Ingresos Totales - Gastos Totales</strong></p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className={`text-2xl font-bold ${beneficioNeto >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {beneficioNeto.toLocaleString('es-ES')}€
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Margen: {totalIngresos > 0 ? Math.round((beneficioNeto / totalIngresos) * 100) : 0}%
          </p>
        </div>

        {ingresosData && (
          <>
            <KPICard
              label="Ticket Medio"
              value={`${ingresosData.averageTicket || 0}€`}
              trend={ingresosData.ticketTrend}
              trendLabel={isAnualOrActual ? "vs. año anterior" : "vs. mes anterior"}
              tooltip="Ingresos totales ÷ número de citas realizadas"
            />
            <KPICard
              label="LTV Estimado"
              value={`${(ingresosData.ltv || 0).toLocaleString()}€`}
              trend={ingresosData.ltvTrend}
              trendLabel={isAnualOrActual ? "vs. año anterior" : "vs. mes anterior"}
              tooltip="Ticket medio × 6 meses (valor estimado del paciente)"
            />
          </>
        )}
      </div>

      {/* Desglose gastos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card">
          <p className="kpi-label">Gastos Fijos</p>
          <p className="text-xl font-bold text-foreground">{gastosFijosDisplay.toLocaleString('es-ES')}€</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Gastos Variables</p>
          <p className="text-xl font-bold text-foreground">{gastosVariablesDisplay.toLocaleString('es-ES')}€</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Empleados Sin IRPF</p>
          <p className="text-xl font-bold text-foreground">
            {empleadosCostDisplay.toLocaleString('es-ES')}€
          </p>
        </div>
      </div>

      {/* Per-Professional Profit */}
      {(resumen.profBeneficios && resumen.profBeneficios.length > 0 || editingProf) && (
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-4">
            <p className="kpi-label">Beneficio por Profesional {monthLabel ? `— ${monthLabel}` : '— Acumulado'}</p>
            <div className="flex gap-2">
              {editingProf ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setShowAddProf(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir Profesional
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingProf(false); setShowAddProf(false); }}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveProf}>
                    <Save className="w-4 h-4 mr-1" /> Guardar
                  </Button>
                </>
              ) : (
                !isAnualOrActual && (
                  <Button size="sm" variant="ghost" onClick={handleStartProfEdit}>
                    <Edit2 className="w-4 h-4 mr-1" /> Editar
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Add Professional inline form */}
          {editingProf && showAddProf && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg">
              <Input
                placeholder="Nombre del profesional"
                className="h-8 text-sm w-48"
                value={newProfName}
                onChange={(e) => setNewProfName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddProf()}
              />
              <Button size="sm" onClick={handleAddProf} disabled={!newProfName.trim()}>
                <Plus className="w-4 h-4 mr-1" /> Añadir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddProf(false); setNewProfName(""); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Profesional</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Ingresos</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Coste con IRPF</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Beneficio Real</th>
                  {editingProf && <th className="py-3 px-4 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {displayProfs.map((p: any) => {
                  const isNew = p.seccion.startsWith('__NEW__');
                  const editKey = p.seccion;
                  const ingreso = editingProf ? (profEditValues[editKey]?.ingreso ?? 0) : (monthKey ? (p.ingreso?.[monthKey] || 0) : (p.ingreso?.total || 0));
                  const gasto = editingProf ? (profEditValues[editKey]?.coste ?? 0) : (monthKey ? (p.gasto?.[monthKey] || 0) : (p.gasto?.total || 0));
                  const beneficio = ingreso - gasto;
                  return (
                    <tr key={p.seccion} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isNew ? 'bg-primary/5' : ''}`}>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {p.nombre}
                        {isNew && <span className="ml-2 text-xs text-primary">(nuevo)</span>}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {editingProf ? (
                          <Input
                            type="number"
                            className="h-8 text-sm text-right w-28 ml-auto"
                            value={profEditValues[editKey]?.ingreso ?? 0}
                            onChange={(e) => setProfEditValues(prev => ({
                              ...prev,
                              [editKey]: { ...prev[editKey], ingreso: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                        ) : (
                          <span className="text-foreground">{(monthKey ? (p.ingreso?.[monthKey] || 0) : (p.ingreso?.total || 0)).toLocaleString('es-ES')}€</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {editingProf ? (
                          <Input
                            type="number"
                            className="h-8 text-sm text-right w-28 ml-auto"
                            value={profEditValues[editKey]?.coste ?? 0}
                            onChange={(e) => setProfEditValues(prev => ({
                              ...prev,
                              [editKey]: { ...prev[editKey], coste: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                        ) : (
                          <span className="text-foreground">{(monthKey ? (p.gasto?.[monthKey] || 0) : (p.gasto?.total || 0)).toLocaleString('es-ES')}€</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${beneficio >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {beneficio.toLocaleString('es-ES')}€
                      </td>
                      {editingProf && (
                        <td className="py-2 px-2">
                          {isNew && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                              setProfEditValues(prev => {
                                const next = { ...prev };
                                delete next[editKey];
                                return next;
                              });
                            }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="py-3 px-4 text-foreground">Total</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    {displayProfs.reduce((s: number, p: any) => {
                      const editKey = p.seccion;
                      return s + (editingProf ? (profEditValues[editKey]?.ingreso ?? 0) : (monthKey ? (p.ingreso?.[monthKey] || 0) : (p.ingreso?.total || 0)));
                    }, 0).toLocaleString('es-ES')}€
                  </td>
                  <td className="py-3 px-4 text-right text-foreground">
                    {displayProfs.reduce((s: number, p: any) => {
                      const editKey = p.seccion;
                      return s + (editingProf ? (profEditValues[editKey]?.coste ?? 0) : (monthKey ? (p.gasto?.[monthKey] || 0) : (p.gasto?.total || 0)));
                    }, 0).toLocaleString('es-ES')}€
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-primary" colSpan={editingProf ? 2 : 1}>
                    {displayProfs.reduce((s: number, p: any) => {
                      const editKey = p.seccion;
                      const i = editingProf ? (profEditValues[editKey]?.ingreso ?? 0) : (monthKey ? (p.ingreso?.[monthKey] || 0) : (p.ingreso?.total || 0));
                      const g = editingProf ? (profEditValues[editKey]?.coste ?? 0) : (monthKey ? (p.gasto?.[monthKey] || 0) : (p.gasto?.total || 0));
                      return s + (i - g);
                    }, 0).toLocaleString('es-ES')}€
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Chart: Ingresos vs Gastos */}
      {resumen.chartData && resumen.chartData.length > 0 && (
        <div className="kpi-card">
          <p className="kpi-label mb-4">Evolución Ingresos vs Gastos {year}</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={resumen.chartData.map((d: any, i: number) => {
                  // Prioritize incomes from historialData (Análisis de Caja) matching the KPIs
                  const hist = historialData?.find((h: any) => h.mesIndex === i);
                  const finalIng = hist && hist.total > 0 ? hist.total : d.ingresos;
                  return {
                    ...d,
                    ingresos: finalIng,
                    beneficio: finalIng - d.gastos
                  };
                })} 
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${v}€`} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-foreground mb-2">{label}</p>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span>{entry.name}: {Number(entry.value).toLocaleString('es-ES')}€</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" />
                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" />
                <Bar dataKey="beneficio" name="Beneficio" fill="#3b82f6" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== GASTOS TAB ===================
function GastosTab({ items, year }: { items: ContabilidadItem[]; year: number }) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Record<string, number>>>({});
  const updateItem = useUpdateContabilidadItem();
  const deleteItem = useDeleteContabilidadItem();
  const { toast } = useToast();

  // Dynamic professional sections from data
  const dynamicProfSections = [...new Set(items.map(i => i.seccion))].filter(s => !['FIJOS', 'VARIABLES', 'EMPLEADOS', 'RESUMEN', 'INGRESOS', 'BENEFICIO', 'TOTAL_BENEFICIO'].includes(s));
  const allSections = [...EXPENSE_SECTIONS, ...dynamicProfSections];

  const handleStartEdit = (section: string) => {
    const sectionItems = items.filter(i => i.seccion === section);
    const values: Record<string, Record<string, number>> = {};
    sectionItems.forEach(item => {
      values[item.id] = {};
      MONTH_KEYS.forEach(mk => {
        values[item.id][mk] = Number(item[mk]) || 0;
      });
    });
    setEditValues(values);
    setEditingSection(section);
  };

  const handleDelete = async (item: ContabilidadItem) => {
    if (!confirm(`¿Eliminar "${item.concepto}" de ${getSectionLabel(item.seccion)}?`)) return;
    try {
      await deleteItem(item.id);
      toast({ title: "Fila eliminada", description: `"${item.concepto}" eliminada correctamente.` });
    } catch (e) {
      toast({ title: "Error al eliminar", description: "No se pudo eliminar la fila.", variant: "destructive" });
    }
  };

  const handleSave = async (section: string) => {
    try {
      const promises: Promise<void>[] = [];
      for (const [id, fields] of Object.entries(editValues)) {
        for (const [field, value] of Object.entries(fields)) {
          const original = items.find(i => i.id === id);
          if (original && Number(original[field as keyof ContabilidadItem]) !== value) {
            promises.push(updateItem(id, field, value));
          }
        }
      }
      await Promise.all(promises);
      setEditingSection(null);
      toast({ title: "Cambios guardados", description: `Datos de ${getSectionLabel(section)} actualizados.` });
    } catch (e) {
      toast({ title: "Error al guardar", description: "No se pudieron guardar los cambios.", variant: "destructive" });
    }
  };

  const getSectionLabel = (s: string) => SECTION_LABELS[s] || getProfDisplayName(s);

  return (
    <div className="space-y-6">
      {allSections.map(section => {
        const sectionItems = items.filter(i => i.seccion === section);
        if (sectionItems.length === 0) return null;
        const isEditing = editingSection === section;
        const isProf = !EXPENSE_SECTIONS.includes(section);

        return (
          <div key={section} className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <p className="kpi-label">{getSectionLabel(section)}</p>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSection(null)}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => handleSave(section)}>
                      <Save className="w-4 h-4 mr-1" /> Guardar
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => handleStartEdit(section)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Editar
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground min-w-[150px]">Concepto</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className="text-right py-2 px-2 font-semibold text-muted-foreground min-w-[70px]">{m}</th>
                    ))}
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground min-w-[80px]">Total</th>
                    {isEditing && <th className="py-2 px-2 min-w-[40px]"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map(item => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium text-foreground text-xs">{item.concepto}</td>
                      {MONTH_KEYS.map(mk => (
                        <td key={mk} className="py-1 px-1 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              className="h-7 text-xs text-right w-16 p-1"
                              value={editValues[item.id]?.[mk] ?? 0}
                              onChange={(e) => {
                                setEditValues(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], [mk]: parseFloat(e.target.value) || 0 }
                                }));
                              }}
                            />
                          ) : (
                            <span className="text-xs text-foreground">
                              {(Number(item[mk]) || 0) > 0 ? Number(item[mk]).toLocaleString('es-ES') : '-'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-semibold text-xs text-foreground">
                        {(isEditing
                          ? Object.values(editValues[item.id] || {}).reduce((s, v) => s + v, 0)
                          : MONTH_KEYS.reduce((s, mk) => s + (Number(item[mk]) || 0), 0)
                        ).toLocaleString('es-ES')}€
                      </td>
                      {isEditing && (
                        <td className="py-1 px-1 text-center">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {!isProf && (
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2 px-3 text-foreground text-xs">Total</td>
                      {MONTH_KEYS.map(mk => (
                        <td key={mk} className="py-2 px-2 text-right text-xs text-foreground">
                          {sectionItems.reduce((s, i) => s + (Number(i[mk]) || 0), 0).toLocaleString('es-ES')}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-xs text-foreground">
                        {sectionItems.reduce((s, i) => s + MONTH_KEYS.reduce((ms, mk) => ms + (Number(i[mk]) || 0), 0), 0).toLocaleString('es-ES')}€
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =================== PROFESIONALES TAB ===================
function ProfesionalesTab({ resumen, items }: { resumen: any; items: ContabilidadItem[] }) {
  return (
    <div className="space-y-6">
      {(resumen.dynamicProfSections || PROF_SECTIONS).map((sec: string) => {
        const profItems = items.filter(i => i.seccion === sec);
        if (profItems.length === 0) return null;

        return (
          <div key={sec} className="kpi-card">
            <p className="kpi-label mb-4">{getProfDisplayName(sec)}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground min-w-[150px]">Concepto</th>
                    {MONTH_LABELS.map(m => (
                      <th key={m} className="text-right py-2 px-2 font-semibold text-muted-foreground min-w-[70px]">{m}</th>
                    ))}
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {profItems.map(item => {
                    const isBeneficio = item.concepto.toUpperCase().includes('BENEFICIO');
                    return (
                      <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isBeneficio ? 'bg-muted/30' : ''}`}>
                        <td className="py-2 px-3 font-medium text-foreground text-xs">{item.concepto}</td>
                        {MONTH_KEYS.map(mk => (
                          <td key={mk} className={`py-2 px-2 text-right text-xs ${isBeneficio ? (Number(item[mk]) >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold') : 'text-foreground'}`}>
                            {(Number(item[mk]) || 0) !== 0 ? Number(item[mk]).toLocaleString('es-ES') : '-'}
                          </td>
                        ))}
                        <td className={`py-2 px-3 text-right font-semibold text-xs ${isBeneficio ? (Number(item.total) >= 0 ? 'text-green-500' : 'text-red-500') : 'text-foreground'}`}>
                          {(Number(item.total) || 0).toLocaleString('es-ES')}€
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
