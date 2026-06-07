import { z } from 'zod';

// Validation schemas for CSV data
// These ensure data integrity and prevent injection attacks

// Sanitize string to prevent XSS - removes potentially dangerous characters
export function sanitizeString(value: string | undefined | null, maxLength: number = 200): string {
  if (!value) return '';
  return value
    .toString()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML/script tags
    .trim();
}

// Validate and clamp numeric values
export function validateNumber(value: number, min: number = 0, max: number = 999999999): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.min(Math.max(value, min), max);
}

// Validate date format (YYYY-MM-DD)
export function validateDateString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return value;
}

// Validate year is reasonable (not in distant past or future)
export function validateYear(value: number): number {
  const currentYear = new Date().getFullYear();
  if (value < 2000 || value > currentYear + 1) {
    return currentYear;
  }
  return value;
}

// Schema for listado_citas validation
export const ListadoCitasSchema = z.object({
  source_key: z.string().max(100).optional(),
  estado: z.string().max(50).transform(v => sanitizeString(v, 50)),
  fecha_cita: z.string().refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha inválida'),
  fecha_creacion: z.string().optional().transform(v => validateDateString(v)),
  accion_id: z.string().max(100).optional().transform(v => sanitizeString(v, 100)),
  asunto: z.string().max(500).optional().transform(v => sanitizeString(v, 500)),
  paciente_nombre: z.string().max(200).optional().transform(v => sanitizeString(v, 200)),
  paciente_telefono: z.string().max(50).optional().transform(v => sanitizeString(v, 50)),
  servicio: z.string().max(200).optional().transform(v => sanitizeString(v, 200)),
  agenda: z.string().max(200).transform(v => sanitizeString(v, 200)),
  tipo: z.string().max(100).optional().transform(v => sanitizeString(v, 100)),
  importe: z.number().nullable().transform(v => v ? validateNumber(v, 0, 999999) : null),
  sala_box: z.string().max(100).optional().transform(v => sanitizeString(v, 100)),
  confirmada: z.boolean(),
  procedencia: z.string().max(200).optional().transform(v => sanitizeString(v, 200)),
  anio: z.number().transform(v => validateYear(v)),
  mes: z.string().max(20).transform(v => sanitizeString(v, 20)),
  semana: z.number().optional().transform(v => v ? validateNumber(v, 1, 53) : undefined),
});

// Schema for balance_mensual validation
export const BalanceMensualSchema = z.object({
  fecha: z.string().max(50).transform(v => sanitizeString(v, 50)),
  mes: z.string().max(20).transform(v => sanitizeString(v, 20)),
  anio: z.number().transform(v => validateYear(v)),
  efectivo: z.number().transform(v => validateNumber(v)),
  tarjeta: z.number().transform(v => validateNumber(v)),
  talon_transferencia: z.number().transform(v => validateNumber(v)),
  bono_regalo: z.number().transform(v => validateNumber(v)),
  domiciliacion: z.number().transform(v => validateNumber(v)),
  total: z.number().transform(v => validateNumber(v)),
});

// Schema for balance_profesional validation  
export const BalanceProfesionalSchema = z.object({
  usuario: z.string().max(200).transform(v => sanitizeString(v, 200)),
  fecha: z.string().max(50).transform(v => sanitizeString(v, 50)),
  mes: z.string().max(20).transform(v => sanitizeString(v, 20)),
  anio: z.number().transform(v => validateYear(v)),
  efectivo: z.number().transform(v => validateNumber(v)),
  tarjeta: z.number().transform(v => validateNumber(v)),
  talon_transferencia: z.number().transform(v => validateNumber(v)),
  bono_regalo: z.number().transform(v => validateNumber(v)),
  domiciliacion: z.number().transform(v => validateNumber(v)),
  total: z.number().transform(v => validateNumber(v)),
  porcentaje: z.number().transform(v => validateNumber(v, 0, 100)),
  liquido: z.number().transform(v => validateNumber(v)),
});

// Schema for profesional monthly data (citas, ocupacion, horas)
export const ProfesionalMonthlySchema = z.object({
  usuario: z.string().min(1).max(200).transform(v => sanitizeString(v, 200)),
  enero: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  febrero: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  marzo: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  abril: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  mayo: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  junio: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  julio: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  agosto: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  septiembre: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  octubre: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  noviembre: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  diciembre: z.number().nullable().optional().transform(v => v != null ? validateNumber(v, 0, 99999) : null),
  anio: z.number().transform(v => validateYear(v)),
});

// Schema for analisis_servicios validation
export const AnalisisServiciosSchema = z.object({
  clinica: z.string().max(200).transform(v => sanitizeString(v, 200)),
  especialidad: z.string().max(200).optional().transform(v => sanitizeString(v, 200)),
  mutua: z.string().max(200).optional().transform(v => sanitizeString(v, 200)),
  servicio: z.string().max(300).transform(v => sanitizeString(v, 300)),
  num_citas: z.number().transform(v => validateNumber(v, 0, 99999)),
  imp_servicio: z.number().transform(v => validateNumber(v)),
  imp_cita: z.number().transform(v => validateNumber(v)),
  duracion_media: z.number().transform(v => validateNumber(v, 0, 999)),
  total_base: z.number().transform(v => validateNumber(v)),
  total_desc: z.number().transform(v => validateNumber(v)),
  total_iva: z.number().transform(v => validateNumber(v)),
  total_ret: z.number().transform(v => validateNumber(v)),
  importe_total: z.number().transform(v => validateNumber(v)),
  anio: z.number().transform(v => validateYear(v)),
  mes: z.number().optional().nullable(),
  semana: z.number().optional().nullable().transform(v => v != null ? validateNumber(v, 1, 53) : null),
  fecha_inicio: z.string().optional().transform(v => validateDateString(v)),
  fecha_fin: z.string().optional().transform(v => validateDateString(v)),
  periodo_tipo: z.string().max(20).optional().transform(v => sanitizeString(v, 20)),
});

// Schema for recordatorios de cita
export const RecordatoriosCitaSchema = z.object({
  nombre: z.string().max(200).transform(v => sanitizeString(v, 200)),
  telefono: z.string().max(50).transform(v => sanitizeString(v, 50)),
  fecha_cita: z.string().refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha inválida'),
  hora_cita: z.string().max(20).optional().transform(v => v ? String(v).substring(0, 20) : ""),
  agenda: z.string().max(200).optional().transform(v => v ? String(v).substring(0, 200) : ""),
  asunto: z.string().max(500).optional().transform(v => v ? String(v).substring(0, 500) : ""),
  tipo_cita: z.string().max(200).optional().transform(v => v ? sanitizeString(v, 200) : ""),
});

// Validation helper that returns validated data or null with error message
export function validateData<T>(
  schema: z.ZodType<T>,
  data: unknown,
  rowIndex?: number
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      const prefix = rowIndex !== undefined ? `Fila ${rowIndex + 1}: ` : '';
      return { success: false, error: `${prefix}${issues}` };
    }
    return { success: false, error: 'Error de validación desconocido' };
  }
}

// Batch validate array of data
export function validateDataArray<T>(
  schema: z.ZodType<T>,
  dataArray: unknown[],
  maxErrors: number = 5
): { validData: T[]; errors: string[] } {
  const validData: T[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < dataArray.length; i++) {
    const result = validateData(schema, dataArray[i], i);
    if (result.success === true) {
      validData.push(result.data);
    } else if (result.success === false && errors.length < maxErrors) {
      errors.push(result.error);
    }
  }
  
  return { validData, errors };
}
