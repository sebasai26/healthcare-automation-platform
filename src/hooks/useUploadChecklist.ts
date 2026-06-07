import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistItem {
  id: string;
  label: string;
  instruction: string;
  isUploaded: boolean;
  type: 'weekly' | 'monthly' | 'range' | 'manual';
}

// Helper to get ISO 8601 week number (Copied from csv-parsers.ts)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper for Spanish month names
const getMonthName = (monthIndex: number): string => {
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return months[monthIndex];
};

export function useUploadChecklist() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const currentMonthName = getMonthName(currentMonthIdx);
  const currentWeek = getWeekNumber(now);
  
  // The user uploads the PREVIOUS week's data on Monday
  const targetWeek = currentWeek - 1;
  const targetYear = targetWeek === 0 ? currentYear - 1 : currentYear;
  const finalTargetWeek = targetWeek === 0 ? 52 : targetWeek; 

  // Calculate start/end of the TARGET week
  const startOfTargetWeek = new Date(now);
  const day = now.getDay() || 7;
  startOfTargetWeek.setDate(now.getDate() - day + 1 - 7);
  const endOfTargetWeek = new Date(startOfTargetWeek);
  endOfTargetWeek.setDate(startOfTargetWeek.getDate() + 6);

  const weekRangeStr = `${startOfTargetWeek.getDate()}/${startOfTargetWeek.getMonth() + 1} - ${endOfTargetWeek.getDate()}/${endOfTargetWeek.getMonth() + 1}`;

  // Calculate the start of the CURRENT week (Monday) at 00:00:00
  // This is used for items that must be uploaded every week even if they are monthly
  const startOfCurrentWeek = new Date(now);
  const currentDay = now.getDay() || 7; // 1 (Mon) - 7 (Sun)
  startOfCurrentWeek.setHours(0, 0, 0, 0);
  startOfCurrentWeek.setDate(now.getDate() - currentDay + 1);
  const startOfWeekISO = startOfCurrentWeek.toISOString();

  // Previous Sunday (for the range instruction)
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - (now.getDay())); // If Mon (1), 16-1=15. If Tue (2), 17-2=15.
  const lastSundayStr = `${lastSunday.getDate()}/${lastSunday.getMonth() + 1}`;

  return useQuery({
    queryKey: ["upload-checklist", currentYear, currentMonthName, currentWeek],
    queryFn: async () => {
      // Use any for the client to avoid deep type recursion in this complex hook
      const client = supabase as any;

      // 1. Listado de Citas (PREVIOUS Week)
      // This naturally resets every week as targetWeek changes
      const listadoQuery = client
        .from("listado_citas")
        .select("*", { count: 'exact', head: true })
        .eq("anio", targetYear)
        .eq("semana", finalTargetWeek);

      // 2. Analisis de Productividad (MUST BE RE-UPLOADED WEEKLY)
      // We only check that data was uploaded THIS WEEK (created_at) for the current year.
      // Month filter removed: on the first days of a new month the upload is for the previous month.
      const prodQuery = client
        .from("citas_profesional")
        .select("*", { count: 'exact', head: true })
        .eq("anio", currentYear)
        .gte("created_at", startOfWeekISO);

      // 3. Analisis de Caja (MUST BE RE-UPLOADED WEEKLY)
      const cajaQuery = client
        .from("balance_mensual")
        .select("*", { count: 'exact', head: true })
        .eq("anio", currentYear)
        .gte("created_at", startOfWeekISO);

      // 4. Analisis de Caja por Profesional (MUST BE RE-UPLOADED WEEKLY)
      const profQuery = client
        .from("balance_profesional")
        .select("*", { count: 'exact', head: true })
        .eq("anio", currentYear)
        .gte("created_at", startOfWeekISO);

      // 5. Analisis por Servicio (MUST BE RE-UPLOADED WEEKLY)
      const serviciosQuery = client
        .from("analisis_servicios")
        .select("*", { count: 'exact', head: true })
        .eq("anio", currentYear)
        .gte("created_at", startOfWeekISO);

      const [listadoRes, prodRes, cajaRes, profRes, serviciosRes] = await Promise.all([
        listadoQuery,
        prodQuery,
        cajaQuery,
        profQuery,
        serviciosQuery
      ]);

      // 6. Contabilidad Clinica (Previous Month check)
      const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
      const prevMonthYear = currentMonthIdx === 0 ? currentYear - 1 : currentYear;
      const prevMonthName = getMonthName(prevMonthIdx);
      const prevMonthNameCap = prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1);
      // Contabilidad Clinica is uploaded ONCE a month (usually at the start of the current month).
      // We check if any data was uploaded since the 1st of the current month.
      const startOfCurrentMonth = new Date(currentYear, currentMonthIdx, 1);
      const startOfMonthISO = startOfCurrentMonth.toISOString();

      const { count: contabilidadCount } = await client
        .from("contabilidad_clinica")
        .select("*", { count: 'exact', head: true })
        .eq("anio", prevMonthYear)
        .gte("created_at", startOfMonthISO);

      const hasContabilidad = (contabilidadCount || 0) > 0;

      const checklistItems: ChecklistItem[] = [
        {
          id: 'listado_citas',
          label: 'Listado de Citas',
          instruction: `Semana ${finalTargetWeek} (${weekRangeStr})`,
          isUploaded: (listadoRes.count || 0) > 0,
          type: 'weekly'
        },
        {
          id: 'analisis_productividad',
          label: 'Análisis de Productividad',
          instruction: `Mes de ${currentMonthName} (Filtrar por mes en Clinic Cloud)`,
          isUploaded: (prodRes.count || 0) > 0,
          type: 'monthly'
        },
        {
          id: 'balance',
          label: 'Análisis de Caja',
          instruction: `Mes de ${currentMonthName} (Filtrar por mes en Clinic Cloud)`,
          isUploaded: (cajaRes.count || 0) > 0,
          type: 'monthly'
        },
        {
          id: 'balance_profesional',
          label: 'Análisis de Caja por Profesional',
          instruction: `Mes de ${currentMonthName} (Filtrar por mes en Clinic Cloud)`,
          isUploaded: (profRes.count || 0) > 0,
          type: 'monthly'
        },
        {
          id: 'contabilidad_clinica',
          label: 'Contabilidad Clínica',
          instruction: `Datos del mes anterior (${prevMonthNameCap})`,
          isUploaded: hasContabilidad,
          type: 'monthly'
        },
        {
          id: 'servicios',
          label: 'Análisis por Servicio',
          instruction: `Clinic Cloud → Análisis por servicio → Filtrar semana ${finalTargetWeek} (${weekRangeStr}) → Exportar → Subir como "Semanal / Semana ${finalTargetWeek}". Se acumulan semana a semana.`,
          isUploaded: (serviciosRes.count || 0) > 0,
          type: 'weekly'
        }
      ];
      return checklistItems;
    },
    refetchOnWindowFocus: true
  });
}
