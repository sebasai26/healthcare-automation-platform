import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVacaciones, Vacacion } from "./useVacaciones";
import { getDaysInMonth, startOfMonth, endOfMonth, getDay, eachDayOfInterval, isWeekend } from "date-fns";

// =================== TYPES ===================

export interface PhysioConfig {
  name: string;
  horasSemanales: number;    // Total weekly hours contracted
  horasComida: number;       // Lunch break hours to subtract
  horasPilatesTotal: number; // Total weekly pilates hours
  pilatesDetalle: Record<string, number>; // { "Lunes": 2, "Martes": 1, ... }
}

export interface CapacidadConfig {
  fisios: PhysioConfig[];
  duracionSesionMinutos: number; // Default 50
}

export interface CapacidadResult {
  config: CapacidadConfig;
  capacidadMaxima: number;       // Max monthly sessions
  capacidadHastaHoy: number;     // Max sessions up to today
  sesionesRealizadas: number;    // Actual sessions performed
  sesionesPotencialesDiarias: number; // Daily session capacity
  productividad: number;         // Percentage 0-100 (full month)
  productividadHastaHoy: number; // Percentage 0-100 (up to today)
  semanasDelMes: number;
  diasLaboralesTotales: number;  // Total weekdays in month
  diasLaboralesTranscurridos: number; // Weekdays elapsed up to today
  desglosePorFisio: PhysioCapacidadDesglose[];
  isLoading: boolean;
  isConfigLoading: boolean;
  saveConfig: (newConfig: CapacidadConfig) => void;
  isSaving: boolean;
}

export interface PhysioCapacidadDesglose {
  name: string;
  horasNetasSemanales: number;
  sesionesSemanales: number;
  sesionesDelMes: number;
  diasVacacionesMes: number;
  sesionesPerdidasVacaciones: number;
  capacidadFinal: number;
}

// =================== DEFAULT CONFIG ===================

const DEFAULT_CONFIG: CapacidadConfig = {
  fisios: [
    {
      name: "Paula",
      horasSemanales: 6,
      horasComida: 0,
      horasPilatesTotal: 2,
      pilatesDetalle: { "Lunes": 2 },
    },
    {
      name: "Cris",
      horasSemanales: 32,
      horasComida: 1,
      horasPilatesTotal: 7,
      pilatesDetalle: { "Lunes": 1, "Martes": 3, "Miércoles": 3 },
    },
    {
      name: "Maca",
      horasSemanales: 29,
      horasComida: 2,
      horasPilatesTotal: 8,
      pilatesDetalle: { "Lunes": 2, "Martes": 1, "Miércoles": 2, "Jueves": 2, "Viernes": 1 },
    },
    {
      name: "Yolanda",
      horasSemanales: 26,
      horasComida: 0,
      horasPilatesTotal: 9,
      pilatesDetalle: { "Lunes": 2, "Martes": 1, "Miércoles": 3, "Viernes": 3 },
    },
  ],
  duracionSesionMinutos: 50,
};

// Alba: solo Pilates (Lunes 3h, Jueves 3h, Viernes 1h = 7h), no tiene horas de fisio individuales.

const CONFIG_KEY = "capacidad_fisio_config";

// =================== HELPERS ===================

/** Count weekdays (Mon-Fri) in a given month */
function getWeekdaysInMonth(year: number, month: number): number {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
}

/** Count weekdays (Mon-Fri) elapsed up to today (inclusive) within the given month */
function getWeekdaysElapsed(year: number, month: number): number {
  const today = new Date();
  const start = startOfMonth(new Date(year, month));
  // If current month/year, count up to today; otherwise count all weekdays
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const end = isCurrentMonth ? today : endOfMonth(new Date(year, month));
  if (start > end) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
}

/** Get the day-of-week name in Spanish from a Date */
function getDayNameES(date: Date): string {
  const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return names[getDay(date)];
}

/**
 * Count how many vacation days a physio has in a specific month.
 * We match by checking if the vacacion.usuario contains the fisio name (case-insensitive).
 */
function countVacationDaysForPhysio(
  vacaciones: Vacacion[],
  physioName: string,
  year: number,
  month: number
): number {
  return vacaciones.filter(v => {
    const vDate = new Date(v.fecha);
    if (vDate.getFullYear() !== year || vDate.getMonth() !== month) return false;
    // Match by name (case-insensitive, partial match)
    const usuario = v.usuario.toLowerCase();
    const name = physioName.toLowerCase();
    return usuario.includes(name) || name.includes(usuario);
  }).length;
}

/**
 * Count vacation days that fall on specific weekdays for pilates coverage calculation.
 * Returns a map of { dayName: count } for the vacationing physio.
 */
function getVacationDaysByWeekday(
  vacaciones: Vacacion[],
  physioName: string,
  year: number,
  month: number
): Record<string, number> {
  const result: Record<string, number> = {};
  vacaciones.forEach(v => {
    const vDate = new Date(v.fecha);
    if (vDate.getFullYear() !== year || vDate.getMonth() !== month) return;
    const usuario = v.usuario.toLowerCase();
    const name = physioName.toLowerCase();
    if (!(usuario.includes(name) || name.includes(usuario))) return;
    if (isWeekend(vDate)) return; // Only count weekdays
    const dayName = getDayNameES(vDate);
    result[dayName] = (result[dayName] || 0) + 1;
  });
  return result;
}

// =================== HOOK: Load/Save Config ===================

function useCapacidadConfig() {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["capacidad_config"],
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CapacidadConfig> => {
      const { data, error } = await supabase
        .from("clinic_config")
        .select("value")
        .eq("key", CONFIG_KEY)
        .maybeSingle();

      if (error) {
        console.error("Error loading capacidad config:", error);
        return DEFAULT_CONFIG;
      }

      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value) as CapacidadConfig;
          // Validate minimum structure
          if (parsed.fisios && Array.isArray(parsed.fisios) && parsed.duracionSesionMinutos > 0) {
            return parsed;
          }
        } catch {
          console.warn("Invalid capacidad config in DB, using defaults");
        }
      }

      return DEFAULT_CONFIG;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: CapacidadConfig) => {
      const valueStr = JSON.stringify(newConfig);

      // Upsert: try update first, then insert
      const { data: existing } = await supabase
        .from("clinic_config")
        .select("id")
        .eq("key", CONFIG_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("clinic_config")
          .update({ value: valueStr, updated_at: new Date().toISOString() })
          .eq("key", CONFIG_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clinic_config")
          .insert({ key: CONFIG_KEY, value: valueStr });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacidad_config"] });
    },
  });

  return {
    config: configQuery.data ?? DEFAULT_CONFIG,
    isConfigLoading: configQuery.isLoading,
    saveConfig: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}

// =================== MAIN HOOK ===================

export function useCapacidadProductividad(year: number, month: number): CapacidadResult {
  const { config, isConfigLoading, saveConfig, isSaving } = useCapacidadConfig();
  const { data: vacaciones } = useVacaciones(year);

  // Fetch real sessions for the month
  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const { data: sesionesData, isLoading: sesionesLoading } = useQuery({
    queryKey: ["capacidad_sesiones_reales", year, month],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<number> => {
      const mesName = MONTH_NAMES[month];
      const PAGE_SIZE = 1000;
      let total = 0;

      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("listado_citas")
          .select("id,estado,asunto,servicio")
          .eq("anio", year)
          .eq("mes", mesName)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        // Count realized sessions excluding Pilates, Superinductiva, Presoterapia
        const count = data.filter(c => {
          const estado = (c.estado || "").toLowerCase();
          if (!estado.startsWith("realizada")) return false;

          const asunto = (c.asunto || "").toLowerCase();
          const servicio = (c.servicio || "").toLowerCase();

          // Exclude placeholders
          if (asunto.includes("1918") || asunto.includes("bloqueado") || asunto.includes("no citar") || servicio === "sin agenda") {
            return false;
          }

          // Exclude Pilates, Superinductiva, Presoterapia
          const combined = asunto + " " + servicio;
          if (combined.includes("pilates") || combined.includes("superinductiva") || combined.includes("presoterapia")) {
            return false;
          }

          return true;
        }).length;

        total += count;
        if (data.length < PAGE_SIZE) break;
        if (offset > 50000) break; // Safety
      }

      return total;
    },
  });

  // Calculate capacity
  const result = useMemo(() => {
    const diasLaboralesTotales = getWeekdaysInMonth(year, month);
    const diasLaboralesTranscurridos = getWeekdaysElapsed(year, month);
    const semanasDelMes = diasLaboralesTotales / 5; // Effective weeks

    const vacs = vacaciones || [];
    const desglosePorFisio: PhysioCapacidadDesglose[] = [];
    let totalCapacidad = 0;

    for (const fisio of config.fisios) {
      // Net weekly hours for individual sessions
      const horasNetas = fisio.horasSemanales - fisio.horasComida - fisio.horasPilatesTotal;
      const sesionesSemanales = (horasNetas * 60) / config.duracionSesionMinutos;
      const sesionesDelMesBruto = sesionesSemanales * semanasDelMes;

      // Vacation adjustments
      const diasVacaciones = countVacationDaysForPhysio(vacs, fisio.name, year, month);

      // Each vacation day removes 1/5 of their weekly capacity
      const sesionesPerdidasPorDiaVacacion = sesionesSemanales / 5;
      const sesionesPerdidasVacaciones = diasVacaciones * sesionesPerdidasPorDiaVacacion;

      // When a physio is on vacation, their pilates is covered by another physio
      // who loses those hours from their individual capacity.
      // We calculate extra sessions lost from covering pilates.
      const vacDaysByWeekday = getVacationDaysByWeekday(vacs, fisio.name, year, month);
      let horasPilatesCubiertas = 0;
      for (const [dayName, count] of Object.entries(vacDaysByWeekday)) {
        const pilatesHoursOnDay = fisio.pilatesDetalle[dayName] || 0;
        horasPilatesCubiertas += pilatesHoursOnDay * count;
      }
      // These hours are removed from the OTHER physios' capacity (distributed)
      // For simplicity, we subtract from total capacity at the end

      const capacidadFinal = Math.max(0, Math.round(sesionesDelMesBruto - sesionesPerdidasVacaciones));

      desglosePorFisio.push({
        name: fisio.name,
        horasNetasSemanales: horasNetas,
        sesionesSemanales: Math.round(sesionesSemanales * 10) / 10,
        sesionesDelMes: Math.round(sesionesDelMesBruto),
        diasVacacionesMes: diasVacaciones,
        sesionesPerdidasVacaciones: Math.round(sesionesPerdidasVacaciones),
        capacidadFinal,
      });

      totalCapacidad += capacidadFinal;

      // Subtract pilates coverage from total (other physios lose these hours)
      const sesionesPerdidasCubrirPilates = (horasPilatesCubiertas * 60) / config.duracionSesionMinutos;
      totalCapacidad -= Math.round(sesionesPerdidasCubrirPilates);
    }

    totalCapacidad = Math.max(0, totalCapacidad);

    // Daily capacity and "up to today" calculations
    const sesionesPotencialesDiarias = diasLaboralesTotales > 0
      ? Math.round((totalCapacidad / diasLaboralesTotales) * 10) / 10
      : 0;
    const capacidadHastaHoy = Math.round(sesionesPotencialesDiarias * diasLaboralesTranscurridos);

    const sesionesRealizadas = sesionesData ?? 0;
    const productividad = totalCapacidad > 0 ? Math.round((sesionesRealizadas / totalCapacidad) * 100) : 0;
    const productividadHastaHoy = capacidadHastaHoy > 0 ? Math.round((sesionesRealizadas / capacidadHastaHoy) * 100) : 0;

    return {
      capacidadMaxima: totalCapacidad,
      capacidadHastaHoy,
      sesionesRealizadas,
      sesionesPotencialesDiarias,
      productividad,
      productividadHastaHoy,
      semanasDelMes: Math.round(semanasDelMes * 100) / 100,
      diasLaboralesTotales,
      diasLaboralesTranscurridos,
      desglosePorFisio,
    };
  }, [config, vacaciones, sesionesData, year, month]);

  return {
    config,
    ...result,
    isLoading: sesionesLoading,
    isConfigLoading,
    saveConfig,
    isSaving,
  };
}
