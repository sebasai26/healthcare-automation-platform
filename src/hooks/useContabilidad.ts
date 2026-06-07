import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_KEYS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export { MONTH_KEYS, MONTH_NAMES };

export interface ContabilidadItem {
  id: string;
  seccion: string;
  concepto: string;
  enero: number;
  febrero: number;
  marzo: number;
  abril: number;
  mayo: number;
  junio: number;
  julio: number;
  agosto: number;
  septiembre: number;
  octubre: number;
  noviembre: number;
  diciembre: number;
  total: number;
  anio: number;
}

// Name mapping: contabilidad section → display name
const PROF_NAME_MAP: Record<string, string> = {
  'MACA': 'Macarena',
  'Maca': 'Macarena',
  'XIARA': 'Xiara',
  'Xiara': 'Xiara',
  'CRIS': 'Cris',
  'Cris': 'Cris',
  'CRIS RECEPCION': 'Cris (Recepción)',
  'Cris recepcion': 'Cris (Recepción)',
  'CRIS AUTONOMA': 'Cris (Autónoma)',
  'Cris autonoma': 'Cris (Autónoma)',
  'Cristina autonoma': 'Cristina (Autónoma)',
  'Cristina recepcion': 'Cris (Recepción)',
  'PAULA AUTONOMA': 'Paula (Autónoma)',
  'Paula autonoma': 'Paula (Autónoma)',
  'LUISA': 'Luisa',
  'Luisa': 'Luisa',
  'ALBA': 'Alba',
  'Alba': 'Alba',
  'YO': 'Tú (Propietario)',
  'Yo': 'Tú (Propietario)',
  'PAULA': 'Paula',
  'Paula': 'Paula',
  'AUTONOMO2': 'Autónomo 2',
};

// Known non-professional sections
const KNOWN_NON_PROF_SECTIONS = new Set([
  'FIJOS', 'VARIABLES', 'EMPLEADOS', 'RESUMEN', 'INGRESOS', 'BENEFICIO', 'TOTAL_BENEFICIO',
  'MINIMO FACTURACION', 'MINIMO FACTURACIÓN',
]);

export const EXPENSE_SECTIONS = ['FIJOS', 'VARIABLES', 'EMPLEADOS'];

// Legacy static list — kept for backward compat but dynamic detection is preferred
export const PROF_SECTIONS = ['MACA', 'XIARA', 'CRIS', 'LUISA', 'ALBA', 'YO', 'PAULA', 'AUTONOMO2'];

// (Autonomous physios now have individual tables in the parser - no EMPLEADOS fallback needed)

export function getProfDisplayName(seccion: string): string {
  return PROF_NAME_MAP[seccion] || seccion;
}

/** Derive professional sections dynamically from actual data */
function getDynamicProfSections(items: ContabilidadItem[]): string[] {
  const sections = [...new Set(items.map(i => i.seccion))];
  return sections.filter(s => !KNOWN_NON_PROF_SECTIONS.has(s) && !KNOWN_NON_PROF_SECTIONS.has(s.toUpperCase()));
}

export function useContabilidadData(anio: number) {
  return useQuery({
    queryKey: ["contabilidad_clinica", anio],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ContabilidadItem[]> => {
      const { data, error } = await (supabase as any)
        .from("contabilidad_clinica")
        .select("*")
        .eq("anio", anio)
        .order("seccion")
        .order("concepto");

      if (error) throw error;
      return (data || []) as ContabilidadItem[];
    },
  });
}

export function useContabilidadResumen(anio: number, hastaMes?: number) {
  const { data: items, isLoading, error } = useContabilidadData(anio);

  const resumen = (() => {
    if (!items || items.length === 0) return null;

    const now = new Date();
    const maxMonthIdx = hastaMes !== undefined
      ? hastaMes
      : (now.getFullYear() === anio ? now.getMonth() : 11);
    const activeMonthKeys = MONTH_KEYS.slice(0, maxMonthIdx + 1);

    const NON_INCOME_CONCEPTS = [
      'BENEFICIO', 'BENEFICIO REAL', 'GASTO CON IRPF', 'GASTO SIN IRPF',
      'SALARIO NETO', 'TOTAL SUELDO', 'SS', 'IRPF', 'DESPIDO', 'COMISIONES',
      'VACACIONES', 'TOTAL BENEFICIO EMPLEADOS', 'TRANSFERENCIA',
    ];

    const sumSection = (secciones: string[], filterIncome = false) => {
      const result: Record<string, number> = {};
      for (const mk of MONTH_KEYS) result[mk] = 0;
      result['total'] = 0;
      items
        .filter(item => {
          if (!secciones.includes(item.seccion)) return false;
          if (filterIncome) {
            return !NON_INCOME_CONCEPTS.includes(item.concepto.toUpperCase().trim());
          }
          return true;
        })
        .forEach(item => {
          for (const mk of MONTH_KEYS) {
            result[mk] += Number(item[mk]) || 0;
          }
        });
      result['total'] = activeMonthKeys.reduce((s, mk) => s + result[mk], 0);
      return result;
    };

    const FISCAL_CONCEPTS = ['IRPF M.111', 'IRPF M.130', 'IVA M.303'];

    const gastosFijos = sumSection(['FIJOS']);
    const gastosVariables = sumSection(['VARIABLES']);
    const gastosEmpleados = sumSection(['EMPLEADOS']);
    const ingresos = sumSection(['INGRESOS'], true);

    const gastosFijosSinFiscal: Record<string, number> = {};
    for (const mk of MONTH_KEYS) gastosFijosSinFiscal[mk] = 0;
    gastosFijosSinFiscal['total'] = 0;
    items
      .filter(item => item.seccion === 'FIJOS' && !FISCAL_CONCEPTS.includes(item.concepto.trim()))
      .forEach(item => {
        for (const mk of MONTH_KEYS) gastosFijosSinFiscal[mk] += Number(item[mk]) || 0;
      });
    gastosFijosSinFiscal['total'] = activeMonthKeys.reduce((s, mk) => s + gastosFijosSinFiscal[mk], 0);

    // gastosTotal and beneficioNeto are computed after profBeneficios (below)
    // so we can use accurate employee costs from individual professional tables

    const sumAllMatchingRows = (rows: ContabilidadItem[]) => {
      const merged: Record<string, number> = {};
      for (const mk of MONTH_KEYS) merged[mk] = 0;
      rows.forEach(r => {
        for (const mk of MONTH_KEYS) merged[mk] += Number(r[mk]) || 0;
      });
      merged['total'] = activeMonthKeys.reduce((s, mk) => s + merged[mk], 0);
      return merged;
    };

    // Detect professional sections dynamically from data
    const dynamicProfSections = getDynamicProfSections(items);

    const profBeneficios = dynamicProfSections.map(sec => {
      const profItems = items.filter(item => item.seccion === sec);
      if (profItems.length === 0) return null;

      const beneficioRows = profItems.filter(item =>
        item.concepto.toUpperCase().includes('BENEFICIO REAL') ||
        item.concepto.toUpperCase() === 'BENEFICIO'
      );
      const ingresoRows = profItems.filter(item =>
        item.concepto.toUpperCase().includes('INGRESO')
      );
      const ingresoFiltered = ingresoRows.filter(r => !r.concepto.toUpperCase().includes('CLINIC CLOUD'));
      const finalIngresoRows = ingresoFiltered.length > 0 ? ingresoFiltered : ingresoRows;

      const gastoRows = profItems.filter(item =>
        item.concepto.toUpperCase().trim() === 'GASTO CON IRPF'
      );

      const beneficio = beneficioRows.length > 0 ? sumAllMatchingRows(beneficioRows) : null;
      const ingreso = finalIngresoRows.length > 0 ? sumAllMatchingRows(finalIngresoRows) : null;
      const gasto = gastoRows.length > 0 ? sumAllMatchingRows(gastoRows) : null;

      return {
        seccion: sec,
        nombre: getProfDisplayName(sec),
        beneficio: beneficio ? { total: beneficio.total, ...beneficio } : undefined,
        ingreso: ingreso ? { total: ingreso.total, ...ingreso } : undefined,
        gasto: gasto ? { total: gasto.total, ...gasto } : undefined,
      };
    }).filter((p): p is NonNullable<typeof p> => p !== null && (!!p.beneficio || !!p.ingreso || !!p.gasto));

    // (Autonomous physio fallback from EMPLEADOS no longer needed - parser now skips them
    //  from EMPLEADOS since they have individual tables with accurate data)

    // Use EMPLEADOS section costs (sin IRPF) for KPIs and chart
    const gastosTotal: Record<string, number> = {};
    for (const mk of [...MONTH_KEYS, 'total'] as const) {
      gastosTotal[mk] = (gastosFijosSinFiscal[mk] || 0) + (gastosVariables[mk] || 0) + (gastosEmpleados[mk] || 0);
    }

    const beneficioNeto: Record<string, number> = {};
    for (const mk of [...MONTH_KEYS, 'total'] as const) {
      beneficioNeto[mk] = (ingresos[mk] || 0) - (gastosTotal[mk] || 0);
    }

    // Chart data — use the global ingresos summary and expenses components
    const chartData = MONTH_KEYS.map((mk, i) => {
      const chartIngresos = ingresos[mk] || 0;
      const chartGastos = (gastosFijos[mk] || 0) + (gastosVariables[mk] || 0) + (gastosEmpleados[mk] || 0);
      return {
        name: MONTH_NAMES[i].substring(0, 3),
        ingresos: chartIngresos,
        gastos: chartGastos,
        beneficio: chartIngresos - chartGastos,
      };
    });

    return {
      gastosFijos,
      gastosVariables,
      gastosEmpleados,
      gastosTotal,
      ingresos,
      beneficioNeto,
      profBeneficios,
      chartData,
      dynamicProfSections,
    };
  })();

  return { data: resumen, items, isLoading, error };
}

export function useUpdateContabilidadItem() {
  return async (id: string, field: string, value: number) => {
    const updateData: Record<string, number> = { [field]: value };

    const { error } = await (supabase as any)
      .from("contabilidad_clinica")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
  };
}

export function useInvalidateContabilidad() {
  const queryClient = useQueryClient();
  return () => queryClient.refetchQueries({ queryKey: ["contabilidad_clinica"] });
}

export function useDeleteContabilidadItem() {
  const queryClient = useQueryClient();

  return async (id: string) => {
    const { error } = await (supabase as any)
      .from("contabilidad_clinica")
      .delete()
      .eq("id", id);

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ["contabilidad_clinica"] });
  };
}