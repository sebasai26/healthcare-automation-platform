import { useState, useRef, forwardRef, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Upload, FileSpreadsheet, CheckCircle, Loader2, AlertCircle, Calendar, Info, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  parseBalanceCSV,
  parseBalanceProfesionalCSV,
  parseCitasProfesionalCSV,
  parseOcupacionProfesionalCSV,
  parseAnalisisServiciosCSV,
  parseHorasProfesionalCSV,
  parseListadoCitasCSV,
  parseAnalisisProductividadCSV,
  parseCumpleanosCSV,
  parseRecordatoriosCitaCSV,
  parseContabilidadClinicaCSV,
  parseVacacionesCSV,
  detectCsvType,
  type DetectedCsvType,
  type CsvType,
} from "@/lib/csv-parsers";
import { useUploadChecklist } from "@/hooks/useUploadChecklist";
import {
  sanitizeString,
  validateNumber,
  validateYear,
  validateDataArray,
  BalanceMensualSchema,
  BalanceProfesionalSchema,
  ListadoCitasSchema,
  ProfesionalMonthlySchema,
  AnalisisServiciosSchema,
  RecordatoriosCitaSchema,
} from "@/lib/csv-validation";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type UploadStatus = "idle" | "uploading" | "success" | "error" | "wrong_type";
type PeriodType = "monthly" | "weekly" | "annual";

type WrongTypeInfo = {
  selectedType: string;
  suggestedType: DetectedCsvType;
};

const csvTypes = [
  { value: "listado_citas", label: "Listado de citas" },
  { value: "recordatorios_cita", label: "Listado de citas (pendientes)" },
  { value: "analisis_productividad", label: "Análisis de productividad" },
  { value: "balance", label: "Análisis de Caja" },
  { value: "balance_profesional", label: "Análisis de Caja por Profesional" },
  { value: "analisis_servicios", label: "Análisis por servicio" },
  { value: "contabilidad_clinica", label: "Contabilidad Clínica" },
  { value: "vacaciones", label: "Vacaciones" },
];

const months = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

// Generate all weeks of the year with their date ranges (Monday to Sunday)
const getWeeksOfYear = (year: number) => {
  const weeks: { value: string; label: string; startDate: string; endDate: string }[] = [];

  // Find the first Monday of the year (or the Monday of the week containing Jan 1)
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days to go back to get to Monday
  // If Jan 1 is Sunday (0), go back 6 days
  // If Jan 1 is Monday (1), stay at 0
  // If Jan 1 is Tuesday (2), go back 1 day, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Start from the Monday of the week containing Jan 1
  let currentStartDay = 1 - daysToMonday;
  let weekNum = 1;

  // Helper to format date as ISO without timezone issues
  const toLocalISODate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Generate weeks until we're past the year
  while (weekNum <= 53) {
    // Create start date using year, month 0 (January), and calculated day
    // JavaScript Date handles negative days and days > 31 correctly
    const weekStart = new Date(year, 0, currentStartDay);
    const weekEnd = new Date(year, 0, currentStartDay + 6); // Sunday = Monday + 6 days


    weeks.push({
      value: `${weekNum}`,
      label: `Semana ${weekNum}: ${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM", { locale: es })}`,
      startDate: format(weekStart, "yyyy-MM-dd"),
      endDate: format(weekEnd, "yyyy-MM-dd"),
    });

    // Move to next Monday (add 7 days)
    currentStartDay += 7;
    weekNum++;

    // Stop when the start of the week is past the year
    const nextWeekStart = new Date(year, 0, currentStartDay);
    if (nextWeekStart.getFullYear() > year) break;
  }

  return weeks;
};

const DataUploadChecklist = () => {
  const { data: items, isLoading } = useUploadChecklist();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando estado de subidas...</span>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden mb-6">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          Estado de Subidas Semanales
        </h3>
        <span className="text-xs text-muted-foreground">Todos los lunes</span>
      </div>
      <div className="divide-y">
        {items?.map((item) => (
          <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-muted/10 transition-colors">
            <div className={cn(
              "mt-0.5 rounded-full p-0.5",
              item.type === 'manual' ? "bg-blue-100 text-blue-600" :
              item.isUploaded ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
            )}>
              {item.type === 'manual' ? (
                <HelpCircle className="h-4 w-4" />
              ) : item.isUploaded ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium leading-none text-foreground">
                  {item.label}
                </p>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap",
                  item.type === 'manual' ? "bg-blue-50 text-blue-700" :
                  item.isUploaded ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                )}>
                  {item.type === 'manual' ? "NOTA" : item.isUploaded ? "SUBIDO" : "PENDIENTE"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 italic">
                <Info className="h-3 w-3 inline shrink-0" />
                {item.instruction}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


export const UploadSection = forwardRef<HTMLElement>(function UploadSection(_, ref) {
  const queryClient = useQueryClient();
  const [csvType, setCsvType] = useState<CsvType | "">("");
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [fileName, setFileName] = useState("");
  const [wrongTypeInfo, setWrongTypeInfo] = useState<WrongTypeInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = currentYear; y >= 2017; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, [currentYear]);
  const weeksOfYear = useMemo(
    () => getWeeksOfYear(selectedYear ? parseInt(selectedYear) : currentYear),
    [selectedYear, currentYear],
  );

  // Get selected week dates for metadata
  const getSelectedPeriodDates = () => {
    const toLocalISODate = (d: Date): string => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    if (periodType === "annual" && selectedYear) {
      const year = parseInt(selectedYear);
      const startDate = toLocalISODate(new Date(year, 0, 1));
      const endDate = toLocalISODate(new Date(year, 11, 31));
      return { startDate, endDate, periodType: "annual" as const, month: null, week: null, year };
    } else if (periodType === "monthly" && selectedMonth) {
      const year = selectedYear ? parseInt(selectedYear) : currentYear;
      const month = parseInt(selectedMonth);
      const startDate = toLocalISODate(new Date(year, month - 1, 1));
      const endDate = toLocalISODate(new Date(year, month, 0));
      return { startDate, endDate, periodType: "monthly" as const, month, week: null, year };
    } else if (periodType === "weekly" && selectedWeek) {
      const year = selectedYear ? parseInt(selectedYear) : currentYear;
      const week = weeksOfYear.find((w) => w.value === selectedWeek);
      if (week) {
        return {
          startDate: week.startDate,
          endDate: week.endDate,
          periodType: "weekly" as const,
          month: null,
          week: parseInt(selectedWeek),
          year,
        };
      }
    }
    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!csvType) {
      toast({
        title: "Selecciona un tipo",
        description: "Por favor, selecciona el tipo de exportación antes de subir el archivo.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedYear) {
      toast({
        title: "Selecciona un año",
        description: "Por favor, selecciona el año de los datos.",
        variant: "destructive",
      });
      return;
    }

    const periodDates = getSelectedPeriodDates();
    if (!periodDates) {
      const periodLabel = periodType === "monthly" ? "un mes" : periodType === "weekly" ? "una semana" : "";
      if (periodLabel) {
        toast({
          title: `Selecciona ${periodLabel}`,
          description: `Por favor, selecciona ${periodLabel} para los datos.`,
          variant: "destructive",
        });
        return;
      }
    }

    setFileName(file.name);
    setStatus("uploading");

    try {
      const nameLower = file.name.toLowerCase();
      let fileContent: string;

      if (nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls")) {
        const XLSXMod = await import("xlsx");
        const XLSX = (XLSXMod as any).default ?? (XLSXMod as any);
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert to TSV (tab-separated) so our parser can read it reliably
        fileContent = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
      } else {
        fileContent = await file.text();
      }

      // Helper function to handle wrong type detection
      const handleWrongType = (detectedType: DetectedCsvType | null) => {
        // Only warn when detection is reasonably confident to avoid false positives.
        // "Recordatorios de Cita" uses the same CSV format as "Listado de citas", so treat as compatible.
        const isCompatible = detectedType?.type === "listado_citas" && csvType === "recordatorios_cita";
        if (detectedType && detectedType.type !== csvType && !isCompatible && detectedType.confidence !== "low") {
          const selectedLabel = csvTypes.find((t) => t.value === csvType)?.label || csvType;
          setWrongTypeInfo({
            selectedType: selectedLabel,
            suggestedType: detectedType,
          });
          setStatus("wrong_type");
          return true;
        }
        return false;
      };

      // Early mismatch detection: prevents trying to import into the wrong table and showing a generic error.
      const detectedEarly = detectCsvType(fileContent, file.name);
      if (handleWrongType(detectedEarly)) return;

      if (csvType === "balance") {
        const parsedData = parseBalanceCSV(fileContent);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el CSV");
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(BalanceMensualSchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en balance:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        const insertData = validData;

        // Delete existing records only for the specific dates present in the new CSV
        const datesInCsv = [...new Set(validData.map((r: any) => r.fecha).filter(Boolean))];

        for (const fecha of datesInCsv) {
          const { error: deleteError } = await (supabase as any)
            .from("balance_mensual")
            .delete()
            .eq("fecha", fecha);

          if (deleteError) {
            console.error(`Error deleting old balance_mensual for date ${fecha}:`, deleteError);
          }
        }

        const insertDataWithClinic = validData.map((row: any) => ({
          ...row,
          clinic_id: 'marbellafisio'
        }));
        const { error } = await (supabase as any).from("balance_mensual").insert(insertDataWithClinic);

        if (error) {
          console.error("Error saving balance_mensual:", error);
          console.error("Payload that failed:", validData);
          throw new Error("Error al guardar los datos: " + (error.message || "Desconocido"));
        }

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${validData.length} registros de balance mensual.`,
        });
      } else if (csvType === "balance_profesional") {
        const parsedData = parseBalanceProfesionalCSV(fileContent);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el CSV");
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(BalanceProfesionalSchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en balance_profesional:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        // Delete existing records for the specific dates present in the CSV, then insert new data
        const datesInCsv = [...new Set(validData.map((r: any) => r.fecha).filter(Boolean))];

        for (const fecha of datesInCsv) {
          const { error: deleteError } = await (supabase as any)
            .from("balance_profesional")
            .delete()
            .eq("fecha", fecha);

          if (deleteError) {
            console.error(`Error deleting old balance_profesional for date ${fecha}:`, deleteError);
          }
        }

        const insertDataWithClinic = validData.map((row: any) => ({
          ...row,
          clinic_id: 'marbellafisio'
        }));
        const { error } = await (supabase as any).from("balance_profesional").insert(insertDataWithClinic);

        if (error) {
          console.error("Error saving balance_profesional:", error);
          console.error("Sample data:", JSON.stringify(validData[0]));
          throw new Error("Error al guardar los datos: " + (error.message || "Desconocido"));
        }

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${validData.length} registros de balance por profesional.`,
        });
      } else if (csvType === "citas_profesional") {
        const parsedData = parseCitasProfesionalCSV(fileContent);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el CSV");
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(ProfesionalMonthlySchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en citas_profesional:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        const { error } = await (supabase as any).from("citas_profesional").upsert(validData, {
          onConflict: "usuario,fecha",
          ignoreDuplicates: false,
        });

        if (error) {
          throw new Error("Error al guardar los datos. Por favor, inténtalo de nuevo.");
        }

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${validData.length} registros de citas por profesional.`,
        });
      } else if (csvType === "ocupacion_profesional") {
        const parsedData = parseOcupacionProfesionalCSV(fileContent);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el CSV");
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(ProfesionalMonthlySchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en ocupacion_profesional:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        const { error } = await (supabase as any).from("ocupacion_profesional").upsert(validData, {
          onConflict: "usuario,fecha",
          ignoreDuplicates: false,
        });

        if (error) {
          throw new Error("Error al guardar los datos. Por favor, inténtalo de nuevo.");
        }

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${validData.length} registros de ocupación por profesional.`,
        });
      } else if (csvType === "analisis_servicios") {
        const selectedYearNum = selectedYear ? parseInt(selectedYear) : currentYear;
        const selectedMonthNum = selectedMonth ? parseInt(selectedMonth) : undefined;
        const selectedWeekNum = selectedWeek ? parseInt(selectedWeek) : undefined;
        const parsedData = parseAnalisisServiciosCSV(
          fileContent,
          selectedYearNum,
          periodDates?.startDate,
          periodDates?.endDate,
          periodDates?.periodType,
          selectedMonthNum,
          selectedWeekNum  // pass ISO week number
        );

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el CSV");
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(AnalisisServiciosSchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en analisis_servicios:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        // Smart deduplication: use semana (ISO week) for weekly, mes for monthly
        // This prevents orphaned duplicates when the user selects a wrong week
        if (periodDates?.periodType === 'weekly' && selectedWeekNum) {
          // Delete all records for this exact week number + year
          const { error: deleteError } = await (supabase as any)
            .from("analisis_servicios")
            .delete()
            .eq("anio", selectedYearNum)
            .eq("semana", selectedWeekNum);
          if (deleteError) console.error("Error deleting analisis_servicios by semana:", deleteError);
        } else if (periodDates?.periodType === 'monthly' && selectedMonthNum) {
          // Delete all records for this month + year
          const { error: deleteError } = await (supabase as any)
            .from("analisis_servicios")
            .delete()
            .eq("anio", selectedYearNum)
            .eq("mes", selectedMonthNum);
          if (deleteError) console.error("Error deleting analisis_servicios by mes:", deleteError);
        } else {
          // Fallback: delete by fecha_inicio + fecha_fin
          const { error: deleteError } = await (supabase as any)
            .from("analisis_servicios")
            .delete()
            .eq("anio", selectedYearNum)
            .eq("fecha_inicio", periodDates?.startDate)
            .eq("fecha_fin", periodDates?.endDate);
          if (deleteError) console.error("Error deleting old analisis_servicios:", deleteError);
        }

        // Sanitize data to ensure proper types for PostgreSQL
        const sanitizedData = validData.map((row: any) => ({
          clinica: String(row.clinica || ''),
          especialidad: row.especialidad ? String(row.especialidad) : null,
          mutua: row.mutua ? String(row.mutua) : null,
          servicio: String(row.servicio || ''),
          num_citas: typeof row.num_citas === 'number' ? Math.round(row.num_citas) : 0,
          imp_servicio: typeof row.imp_servicio === 'number' ? row.imp_servicio : 0,
          imp_cita: typeof row.imp_cita === 'number' ? row.imp_cita : 0,
          duracion_media: typeof row.duracion_media === 'number' ? row.duracion_media : 0,
          total_base: typeof row.total_base === 'number' ? row.total_base : 0,
          total_desc: typeof row.total_desc === 'number' ? row.total_desc : 0,
          total_iva: typeof row.total_iva === 'number' ? row.total_iva : 0,
          total_ret: typeof row.total_ret === 'number' ? row.total_ret : 0,
          importe_total: typeof row.importe_total === 'number' ? row.importe_total : 0,
          anio: typeof row.anio === 'number' ? row.anio : selectedYearNum,
          mes: row.mes === null || row.mes === undefined ? null : Number(row.mes),
          semana: row.semana === null || row.semana === undefined ? null : Number(row.semana),
          fecha_inicio: row.fecha_inicio || null,
          fecha_fin: row.fecha_fin || null,
          periodo_tipo: row.periodo_tipo || null,
        }));

        const { error } = await (supabase as any).from("analisis_servicios").insert(sanitizedData);

        if (error) {
          console.error("Error saving analisis_servicios:", error);
          throw new Error("Error al guardar los datos. Por favor, inténtalo de nuevo.");
        }

        setStatus("success");
        const periodDesc = periodDates?.periodType === 'weekly'
          ? `Semana ${selectedWeekNum} (${periodDates.startDate} → ${periodDates.endDate})`
          : periodDates?.periodType === 'monthly'
          ? `Mes ${selectedMonthNum} / ${selectedYearNum}`
          : periodDates?.periodType || '';
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${validData.length} registros de análisis de servicios (${periodDesc}).`,
        });
      } else if (csvType === "horas_profesional") {
        const parsedData = parseHorasProfesionalCSV(fileContent);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el CSV");
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(ProfesionalMonthlySchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en horas_profesional:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        const { error } = await (supabase as any).from("horas_profesional").upsert(validData, {
          onConflict: "usuario,fecha",
          ignoreDuplicates: false,
        });

        if (error) {
          throw new Error("Error al guardar los datos. Por favor, inténtalo de nuevo.");
        }

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${validData.length} registros de horas trabajadas.`,
        });
      } else if (csvType === "listado_citas") {
        const selectedYearNum = selectedYear ? parseInt(selectedYear) : currentYear;
        const selectedMonthName = selectedMonth ? months.find((m) => m.value === selectedMonth)?.label : undefined;
        const selectedWeekNum = selectedWeek ? parseInt(selectedWeek) : undefined;

        const parsedData = parseListadoCitasCSV(
          fileContent,
          selectedYearNum,
          selectedMonthName,
          selectedWeekNum,
        );

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error(
            "No se encontraron datos válidos en el archivo. Asegúrate de que el archivo tenga las columnas: Estado, Fecha cita, Agenda.",
          );
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(ListadoCitasSchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en listado_citas:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        // NO filtrar por periodo - guardar TODAS las citas del CSV, cada una en su semana correspondiente
        // El parser ya asigna la semana correcta basándose en la fecha real de cada cita
        const allValidData = validData;

        if (allValidData.length === 0) {
          throw new Error("El archivo tiene datos, pero no se pudieron validar. Revisa el formato del archivo.");
        }

        // Deduplicar por source_key antes del upsert (quedarse con la última ocurrencia)
        // Esto evita el error "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const deduplicatedData = Array.from(
          allValidData
            .reduce((map, item: any) => {
              map.set(item.source_key, item);
              return map;
            }, new Map<string, any>())
            .values(),
        );

        // Identificar todas las fechas únicas en los datos importados
        const datesInData = [...new Set(deduplicatedData.map((r: any) => r.fecha_cita))];
        const yearsInData = new Set(deduplicatedData.map((r: any) => r.anio));

        // Para cada fecha presente en los datos, eliminar los registros existentes de ESA FECHA
        // Esto evita borrar semanas enteras cuando el CSV incluye registros sueltos de otra semana
        for (const fecha of datesInData) {
          const { error: deleteError } = await (supabase as any)
            .from("listado_citas")
            .delete()
            .eq("fecha_cita", fecha);

          if (deleteError) {
            console.error(`Error deleting old listado_citas for date ${fecha}:`, deleteError);
          }
        }

        const insertData = deduplicatedData.map((row: any) => ({
          ...row,
          clinic_id: 'marbellafisio'
        }));
        const { error } = await (supabase as any).from("listado_citas").insert(insertData as any);

        if (error) {
          console.error("Error saving listado_citas:", error);
          throw new Error("Error al guardar los datos. Por favor, inténtalo de nuevo.");
        }

        // Generar mensaje informativo sobre las fechas importadas
        const dateRange = datesInData.sort();
        const firstDate = dateRange[0];
        const lastDate = dateRange[dateRange.length - 1];

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${deduplicatedData.length} citas (${firstDate} a ${lastDate}).`,
        });

        // Refrescar todas las métricas que dependen del listado de citas
        queryClient.invalidateQueries({ queryKey: ["capacidad_sesiones_reales"] });
        queryClient.invalidateQueries({ queryKey: ["overviewData"] });
        queryClient.invalidateQueries({ queryKey: ["controlCitas"] });
        queryClient.invalidateQueries({ queryKey: ["controlCitasMensuales"] });
      } else if (csvType === "analisis_productividad") {
        const parsedResult = parseAnalisisProductividadCSV(fileContent);

        if (!parsedResult) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se pudieron detectar las 3 secciones (citas, horas, ocupación) en el archivo.");
        }

        const { citas, horas, ocupacion, jornadas, month, year } = parsedResult;

        if (citas.length === 0 && horas.length === 0 && ocupacion.length === 0 && jornadas.length === 0) {
          throw new Error("No se encontraron datos de profesionales en el archivo.");
        }

        let citasCount = 0;
        let horasCount = 0;
        let ocupacionCount = 0;
        let jornadasCount = 0;

        // Process citas_profesional
        if (citas.length > 0) {
          // Delete existing for this month/year first to refresh created_at for the weekly checklist
          await (supabase as any).from("citas_profesional").delete().eq("anio", year).eq("mes", month);
          const { error } = await (supabase as any).from("citas_profesional").insert(citas);
          if (error) {
            console.error("Error inserting citas_profesional:", error);
            toast({
              title: "Error al guardar citas por profesional",
              description: error.message,
              variant: "destructive",
            });
          } else {
            citasCount = citas.length;
          }
        }

        // Process horas_profesional
        if (horas.length > 0) {
          // Delete existing for this month/year first to refresh created_at
          await (supabase as any).from("horas_profesional").delete().eq("anio", year).eq("mes", month);
          const { error } = await (supabase as any).from("horas_profesional").insert(horas);
          if (error) {
            console.error("Error inserting horas_profesional:", error);
            toast({
              title: "Error al guardar horas por profesional",
              description: error.message,
              variant: "destructive",
            });
          } else {
            horasCount = horas.length;
          }
        }

        // Process ocupacion_profesional
        if (ocupacion.length > 0) {
          // Delete existing for this month/year first to refresh created_at
          await (supabase as any).from("ocupacion_profesional").delete().eq("anio", year).eq("mes", month);
          const { error } = await (supabase as any).from("ocupacion_profesional").insert(ocupacion);
          if (error) {
            console.error("Error inserting ocupacion_profesional:", error);
            toast({
              title: "Error al guardar ocupación por profesional",
              description: error.message,
              variant: "destructive",
            });
          } else {
            ocupacionCount = ocupacion.length;
          }
        }

        // Process jornada_profesional
        if (jornadas.length > 0) {
          // Delete existing for this month/year first to refresh created_at
          await (supabase as any).from("jornada_profesional").delete().eq("anio", year).eq("mes", month);
          const { error } = await (supabase as any).from("jornada_profesional").insert(jornadas);
          if (error) {
            console.error("Error inserting jornada_profesional:", error);
            toast({
              title: "Error al guardar jornada laboral",
              description: error.message,
              variant: "destructive",
            });
          } else {
            jornadasCount = jornadas.length;
          }
        }

        setStatus("success");
        const monthLabel =
          months.find((m) => m.value === String(months.findIndex((m2) => m2.label.toLowerCase() === month) + 1))
            ?.label || month;
        toast({
          title: "Datos de productividad procesados",
          description: `${monthLabel} ${year}: ${citasCount} citas, ${horasCount} horas, ${ocupacionCount} ocupación, ${jornadasCount} jornada.`,
        });
      } else if (csvType === "listado_cumpleanos") {
        const parsedData = parseCumpleanosCSV(fileContent);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos en el archivo.");
        }

        const insertData = parsedData;
        // Upsert to accumulate patients. If 'id' is present, it will update existing records.
        // If not, it will insert as new records.
        const { error } = await (supabase as any).from("pacientes_demograficos").upsert(insertData, {
          ignoreDuplicates: false,
        });

        if (error) {
          console.error("Error saving pacientes_demograficos:", error);
          throw new Error("Error al guardar los datos. Por favor, inténtalo de nuevo.");
        }

        setStatus("success");
        toast({
          title: "Datos guardados correctamente",
          description: `Se han importado ${parsedData.length} pacientes con datos demográficos.`,
        });
      } else if (csvType === "recordatorios_cita") {
        const parsedData = parseRecordatoriosCitaCSV(fileContent);

        if (parsedData.length === 0) {
          throw new Error(
            "No se encontraron citas válidas. El archivo debe ser un 'Listado de Citas' con citas en estado 'Pendiente' y contener el nombre y teléfono del paciente (normalmente dentro de la columna Asunto)."
          );
        }

        // Validate data with Zod schema
        const { validData, errors } = validateDataArray(RecordatoriosCitaSchema, parsedData, 5);

        if (errors.length > 0) {
          console.warn("Errores de validación en recordatorios_cita:", errors);
        }

        if (validData.length === 0) {
          throw new Error("No hay datos válidos después de la validación");
        }

        // Deduplicate by telefono + fecha_cita + hora_cita
        const deduped = Array.from(
          validData
            .reduce((map, item) => {
              const key = `${item.telefono}|${item.fecha_cita}|${item.hora_cita}`;
              if (!map.has(key)) map.set(key, item);
              return map;
            }, new Map<string, (typeof validData)[0]>())
            .values()
        );

        // Identificar todas las fechas únicas en los datos importados
        const datesInData = [...new Set(deduped.map((r: any) => r.fecha_cita))];

        // PASO 1: Para cada fecha, eliminar TODOS los registros con estado "Por enviar"
        // Esto sobreescribe los datos pendientes del día con el nuevo listado actualizado
        for (const fecha of datesInData) {
          const { error: deleteError } = await (supabase as any)
            .from("recordatorios_cita")
            .delete()
            .eq("fecha_cita", fecha)
            .neq("estado_recordatorio", "Enviado");

          if (deleteError) {
            console.error(`Error deleting old recordatorios_cita for date ${fecha}:`, deleteError);
          }
        }

        // PASO 2: Obtener los registros ya "Enviado" que sobrevivieron al borrado
        // para no re-insertarlos y evitar duplicados
        const { data: existingSent } = await (supabase as any)
          .from("recordatorios_cita")
          .select("telefono, fecha_cita, hora_cita")
          .in("fecha_cita", datesInData)
          .eq("estado_recordatorio", "Enviado");

        const sentKeys = new Set<string>();
        existingSent?.forEach((r: any) => {
          sentKeys.add(`${r.telefono}|${r.fecha_cita}|${r.hora_cita}`);
        });

        // PASO 3: Filtrar los nuevos registros — excluir los que ya están como "Enviado"
        const insertData = deduped
          .filter(row => {
            const key = `${row.telefono}|${row.fecha_cita}|${row.hora_cita}`;
            return !sentKeys.has(key);
          })
          .map(row => ({
            ...row,
            clinic_id: 'marbellafisio',
            estado: 'Pendiente',
            estado_recordatorio: 'Por enviar'
          }));

        const skippedCount = deduped.length - insertData.length;

        // PASO 4: Insertar los nuevos recordatorios
        if (insertData.length > 0) {
          const { error } = await (supabase as any).from("recordatorios_cita").insert(insertData);

          if (error) {
            console.error("Error saving recordatorios_cita:", error);
            throw new Error("Error al guardar los recordatorios. Por favor, inténtalo de nuevo.");
          }
        }

        setStatus("success");
        const skippedMsg = skippedCount > 0 ? ` (${skippedCount} ya enviados, no se modificaron)` : '';
        toast({
          title: "Recordatorios guardados",
          description: `Se han importado ${insertData.length} recordatorios de cita${skippedMsg}. Datos anteriores "Por enviar" de ${datesInData.length === 1 ? 'ese día' : `esos ${datesInData.length} días`} han sido sobreescritos.`,
        });
      } else if (csvType === "contabilidad_clinica") {
        const selectedYearNum = selectedYear ? parseInt(selectedYear) : currentYear;
        const parsedData = parseContabilidadClinicaCSV(fileContent, selectedYearNum);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos de contabilidad en el archivo.");
        }

        // Delete ALL existing records for this year to remove stale sections
        // (e.g. 'MINIMO FACTURACIÓN' from previous parser versions)
        const { error: deleteError } = await (supabase as any)
          .from("contabilidad_clinica")
          .delete()
          .eq("anio", selectedYearNum);
        
        if (deleteError) {
          console.error(`Error deleting old contabilidad_clinica for year ${selectedYearNum}:`, deleteError);
        }



        // Insert rows in batches to avoid payload limits
        const BATCH_SIZE = 50;
        for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
          const batch = parsedData.slice(i, i + BATCH_SIZE).map((row: any) => ({
            ...row,
            id: crypto.randomUUID(),
          }));
          const { error } = await (supabase as any)
            .from("contabilidad_clinica")
            .insert(batch);

          if (error) {
            console.error("Error saving contabilidad_clinica batch:", error);
            throw new Error("Error al guardar los datos de contabilidad.");
          }
        }

        setStatus("success");
        toast({
          title: "Contabilidad importada correctamente",
          description: `Se han importado ${parsedData.length} registros de contabilidad para ${selectedYearNum}.`,
        });
      } else if (csvType === "vacaciones") {
        const selectedYearNum = selectedYear ? parseInt(selectedYear) : currentYear;
        const parsedData = parseVacacionesCSV(fileContent, selectedYearNum);

        if (parsedData.length === 0) {
          const detected = detectCsvType(fileContent, file.name);
          if (handleWrongType(detected)) return;
          throw new Error("No se encontraron datos válidos de vacaciones en el archivo.");
        }

        // Delete existing records only for the specific dates present in the CSV to prevent duplicates
        const datesInCsv = [...new Set(parsedData.map((r: any) => r.fecha))];
        for (const fecha of datesInCsv) {
          const { error: deleteError } = await (supabase as any)
            .from("vacaciones")
            .delete()
            .eq("fecha", fecha);

          if (deleteError) {
            console.error(`Error deleting old vacaciones for date ${fecha}:`, deleteError);
          }
        }



        const BATCH_SIZE = 500;
        for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
          const batch = parsedData.slice(i, i + BATCH_SIZE).map((row: any) => ({ ...row, clinic_id: 'marbellafisio' }));
          const { error } = await (supabase as any)
            .from("vacaciones")
            .insert(batch);

          if (error) {
            console.error("Error saving vacaciones batch:", error);
            throw new Error("Error al guardar los datos de vacaciones.");
          }
        }

        setStatus("success");
        toast({
          title: "Vacaciones importadas correctamente",
          description: `Se han importado ${parsedData.length} días de ausencias para ${selectedYearNum}.`,
        });

        // Refrescar métricas ya que las vacaciones afectan a la capacidad
        queryClient.invalidateQueries({ queryKey: ["vacaciones"] });
        queryClient.invalidateQueries({ queryKey: ["capacidad_sesiones_reales"] });
      } else {
        toast({
          title: "Tipo no implementado",
          description: "Este tipo de CSV aún no está disponible.",
          variant: "destructive",
        });
        setStatus("idle");
        return;
      }
    } catch (error) {
      setStatus("error");
      toast({
        title: "Error al procesar el archivo",
        description: error instanceof Error ? error.message : "Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    }

    // Reset after a delay (except for wrong_type which needs user action)
    if (status !== "wrong_type") {
      setTimeout(() => {
        setStatus("idle");
        setFileName("");
        setCsvType("");
        setSelectedMonth("");
        setSelectedWeek("");
        setSelectedYear("");
        setWrongTypeInfo(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 3000);
    }
  };

  const handleApplySuggestion = () => {
    if (wrongTypeInfo) {
      setCsvType(wrongTypeInfo.suggestedType.type);
      setStatus("idle");
      setWrongTypeInfo(null);
      setFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast({
        title: "Tipo de exportación cambiado",
        description: `Se ha seleccionado "${wrongTypeInfo.suggestedType.label}". Vuelve a subir el archivo.`,
      });
    }
  };

  const handleDismissWrongType = () => {
    setStatus("idle");
    setWrongTypeInfo(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleButtonClick = () => {
    if (!csvType) {
      toast({
        title: "Selecciona un tipo",
        description: "Por favor, selecciona el tipo de exportación primero.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedYear) {
      toast({
        title: "Selecciona un año",
        description: "Por favor, selecciona el año de los datos.",
        variant: "destructive",
      });
      return;
    }

    const periodDates = getSelectedPeriodDates();
    if (!periodDates) {
      const periodLabel = periodType === "monthly" ? "un mes" : periodType === "weekly" ? "una semana" : "";
      if (periodLabel) {
        toast({
          title: `Selecciona ${periodLabel}`,
          description: `Por favor, selecciona ${periodLabel} para los datos.`,
          variant: "destructive",
        });
        return;
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    fileInputRef.current?.click();
  };

  return (
    <section ref={ref} className="animate-slide-up">
      <h3 className="section-title flex items-center gap-2">
        <Upload className="w-5 h-5 text-primary" />
        Importar Datos
      </h3>

      <div className="kpi-card max-w-4xl mx-auto">
        <p className="text-muted-foreground mb-8">Sube tus archivos para actualizar los datos del dashboard.</p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-6">
            <div className="space-y-6">
              {/* Period Type Toggle */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Tipo de periodo</label>
                <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                  {csvType !== "analisis_servicios" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPeriodType("monthly");
                        setSelectedWeek("");
                      }}
                      className={cn(
                        "flex-1 transition-all",
                        periodType === "monthly"
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Mensual
                    </Button>
                  )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPeriodType("weekly");
                        setSelectedMonth("");
                      }}
                      className={cn(
                        "flex-1 transition-all",
                        periodType === "weekly"
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Semanal
                    </Button>
                  {csvType !== "analisis_servicios" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPeriodType("annual");
                        setSelectedMonth("");
                        setSelectedWeek("");
                      }}
                      className={cn(
                        "flex-1 transition-all",
                        periodType === "annual"
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Anual
                    </Button>
                  )}
                </div>
              </div>

              {/* Year Selector */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Año</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona el año" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month Selector */}
              {periodType === "monthly" && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Mes</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona el mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Week Selector */}
              {periodType === "weekly" && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Semana</label>
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona la semana" />
                    </SelectTrigger>
                    <SelectContent>
                      {weeksOfYear.map((week) => (
                        <SelectItem key={week.value} value={week.value}>
                          {week.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* CSV Type Selector */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Tipo de exportación</label>
                <Select 
                  value={csvType} 
                  onValueChange={(v) => {
                    setCsvType(v as CsvType);
                    if (v === "analisis_servicios") {
                      setPeriodType("weekly");
                      setSelectedMonth("");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona el tipo de datos" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                onClick={handleButtonClick}
                disabled={status === "uploading"}
                className="w-full h-24 border-2 border-dashed border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex flex-col gap-2"
                variant="ghost"
              >
                {status === "idle" && (
                  <>
                    <FileSpreadsheet className="w-8 h-8" />
                    <span>Subir archivo</span>
                  </>
                )}
                {status === "uploading" && (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span>Procesando datos...</span>
                  </>
                )}
                {status === "success" && (
                  <>
                    <CheckCircle className="w-8 h-8 text-success" />
                    <span className="text-success">Datos guardados</span>
                  </>
                )}
                {status === "error" && (
                  <>
                    <AlertCircle className="w-8 h-8 text-destructive" />
                    <span className="text-destructive">Error al guardar</span>
                  </>
                )}
                {status === "wrong_type" && (
                  <>
                    <Info className="w-8 h-8 text-muted-foreground" />
                    <span className="text-muted-foreground">Tipo incorrecto</span>
                  </>
                )}
              </Button>

              {status === "wrong_type" && wrongTypeInfo && (
                <Alert className="bg-muted/50 border-border">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Tipo de exportación incorrecto</AlertTitle>
                  <AlertDescription className="mt-2 space-y-3">
                    <p>
                      Seleccionaste <span className="font-medium">"{wrongTypeInfo.selectedType}"</span>, pero el archivo
                      parece ser <span className="font-medium text-primary">"{wrongTypeInfo.suggestedType.label}"</span>.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={handleApplySuggestion}>
                        Usar "{wrongTypeInfo.suggestedType.label}"
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleDismissWrongType}>
                        Cancelar
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {fileName && status !== "idle" && status !== "wrong_type" && (
                <p className="text-sm text-muted-foreground text-center">{fileName}</p>
              )}
            </div>
          </div>

          {/* Right Column: Checklist */}
          <div className="lg:col-span-12 xl:col-span-5">
            <DataUploadChecklist />
          </div>
        </div>
      </div>
    </section>
  );
});
