// CSV parsing utilities for dashboard data imports
import Papa from 'papaparse';

export type CsvType = "citas_profesional" | "balance" | "balance_profesional" | "ocupacion_profesional" | "analisis_servicios" | "horas_profesional" | "listado_citas" | "analisis_productividad" | "listado_cumpleanos" | "recordatorios_cita" | "contabilidad_clinica" | "vacaciones";

export type DetectedCsvType = {
  type: CsvType;
  label: string;
  confidence: 'high' | 'medium' | 'low';
};

// Utility used by some parsers (HH:MM -> decimal hours)
// e.g. "46:30" -> 46.5
const parseTimeToDecimal = (value: string | undefined): number => {
  if (!value) return 0;
  const cleaned = value.replace(/"/g, '').trim();
  const match = cleaned.match(/^(\d+):(\d+)$/);
  if (!match) return 0;
  const h = Number.parseInt(match[1], 10) || 0;
  const m = Number.parseInt(match[2], 10) || 0;
  return h + m / 60;
};

// Detect CSV type based on headers and content
export function detectCsvType(csvContent: string, filename?: string): DetectedCsvType | null {
  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return null;

  // Detect separator
  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(15, rawLines.length)));

  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const filenameNorm = normalize(filename || '');
  const filenameHas = (...terms: string[]) => terms.some((t) => filenameNorm.includes(normalize(t)));

  // Get all normalized content for pattern matching - use more lines for combined files
  const allContent = rawLines.slice(0, Math.min(35, rawLines.length)).join(' ');
  const allContentNorm = normalize(allContent);

  // PRIORITY CHECK: Combined productivity analysis (has all 3 sections)
  // Must check this FIRST before other checks since it contains patterns that match other types
  if ((allContentNorm.includes('citas realizadas por dia') || allContentNorm.includes('citas realizadas por día')) &&
    (allContentNorm.includes('horas trabajadas por dia') || allContentNorm.includes('horas trabajadas por día')) &&
    (allContentNorm.includes('porcentaje de ocupacion por dia') || allContentNorm.includes('porcentaje de ocupación por día'))) {
    return { type: 'analisis_productividad', label: 'Análisis de productividad', confidence: 'high' };
  }

  // Get headers from potential header rows
  const getHeaders = (line: string) =>
    line.split(separator).map((col) => normalize(col.replace(/^"|"$/g, '').trim()));

  // Check first 10 lines for headers
  const headerCandidates = rawLines.slice(0, 10).flatMap(getHeaders);
  const headersSet = new Set(headerCandidates);
  const hasHeader = (patterns: string[]) => patterns.some(p =>
    headerCandidates.some(h => h === p || h.includes(p))
  );

  // 0. LISTADO DE CUMPLEAÑOS - has "n.h.", "sexo", "fecha nac."
  if (hasHeader(['n.h.', 'n.h']) && hasHeader(['sexo']) && hasHeader(['fecha nac.', 'fecha nac'])) {
    return { type: 'listado_cumpleanos', label: 'Listado de cumpleaños', confidence: 'high' };
  }

  // 0.5. VACACIONES - has "fisioterapeutas" and "libre día de disposición"
  if (allContentNorm.includes('libre dia de disposicion') && allContentNorm.includes('fisioterapeutas')) {
    return { type: 'vacaciones', label: 'Vacaciones y Ausencias', confidence: 'high' };
  }

  // 1. LISTADO DE CITAS - has "estado", "fecha cita" or "fecha", "agenda"
  if (hasHeader(['estado']) && hasHeader(['fecha cita', 'fechacita', 'fecha']) && hasHeader(['agenda'])) {
    return { type: 'listado_citas', label: 'Listado de citas', confidence: 'high' };
  }

  // 2. ANALISIS SERVICIOS - has "clinica", "servicio", "num citas" or "nº citas"
  if (hasHeader(['clinica']) && hasHeader(['servicio']) &&
    (hasHeader(['num citas', 'nº citas', 'numcitas']) || hasHeader(['imp servicio', 'imp. servicio']))) {
    return { type: 'analisis_servicios', label: 'Análisis por servicio', confidence: 'high' };
  }

  // 3. BALANCE PROFESIONAL - has "usuario", months, AND "porcentaje" or "liquido"
  if (hasHeader(['usuario']) && hasHeader(['enero', 'febrero']) &&
    (hasHeader(['porcentaje']) || hasHeader(['liquido']))) {
    return { type: 'balance_profesional', label: 'Análisis de Caja por Profesional', confidence: 'high' };
  }

  // 4. OCUPACION PROFESIONAL - has "usuario", months, and content has "%" patterns
  if (hasHeader(['usuario']) && hasHeader(['enero', 'febrero'])) {
    // Check if data contains percentage patterns like "53,07% de 87:00h"
    const dataLines = rawLines.slice(1, 10).join(' ');
    if (dataLines.match(/\d+[,.]?\d*%\s*(de|of)?\s*\d+:\d+h?/i)) {
      return { type: 'ocupacion_profesional', label: 'Ocupación por profesional', confidence: 'high' };
    }

    // Check if it mentions "horas" in title/first lines
    if (allContentNorm.includes('horas trabajadas') || allContentNorm.includes('horas por')) {
      return { type: 'horas_profesional', label: 'Horas trabajadas por profesional', confidence: 'high' };
    }

    // (analisis_productividad is checked at the top, before header checks)

    // Check if it mentions "citas" or "realizadas" in title
    if (allContentNorm.includes('citas realizadas') || allContentNorm.includes('citas por')) {
      return { type: 'citas_profesional', label: 'Citas por profesional', confidence: 'high' };
    }

    // Check if it mentions "ocupacion" in title
    if (allContentNorm.includes('ocupacion') || allContentNorm.includes('ocupación')) {
      return { type: 'ocupacion_profesional', label: 'Ocupación por profesional', confidence: 'medium' };
    }

    // Default to citas_profesional if has usuario + months but no other indicators
    return { type: 'citas_profesional', label: 'Citas por profesional', confidence: 'low' };
  }

  // 5. BALANCE MENSUAL - has "fecha", "mes", payment columns but NO "usuario"
  if (!hasHeader(['usuario']) && hasHeader(['fecha']) && hasHeader(['mes']) &&
    (hasHeader(['efectivo']) || hasHeader(['tarjeta']) || hasHeader(['total']))) {
    return { type: 'balance', label: 'Análisis de Caja', confidence: 'high' };
  }

  // 5.5 CONTABILIDAD CLINICA - has "alquiler", "empleados", "gastos", "ingresos", "beneficio real"
  if ((allContentNorm.includes('alquiler') || allContentNorm.includes('hipoteca')) &&
    allContentNorm.includes('empleados') &&
    (allContentNorm.includes('gastos') || allContentNorm.includes('variables')) &&
    allContentNorm.includes('ingresos')) {
    return { type: 'contabilidad_clinica', label: 'Contabilidad Clínica', confidence: 'high' };
  }

  // 6. Fallback heuristics based on filename (useful when content parsing is ambiguous)
  // We intentionally keep confidence <= medium so the UI can warn without being too aggressive.
  if (filenameNorm) {
    if (filenameHas('contabilidad') || filenameHas('gastos')) {
      return { type: 'contabilidad_clinica', label: 'Contabilidad Clínica', confidence: 'high' };
    }

    if (filenameHas('cumpleanos') || filenameHas('cumpleaños')) {
      return { type: 'listado_cumpleanos', label: 'Listado de cumpleaños', confidence: 'high' };
    }

    if (filenameHas('productividad')) {
      return { type: 'analisis_productividad', label: 'Análisis de productividad', confidence: 'medium' };
    }

    if (filenameHas('listado') && filenameHas('citas')) {
      return { type: 'listado_citas', label: 'Listado de citas', confidence: 'medium' };
    }

    if (filenameHas('servicios') || filenameHas('servicio')) {
      return { type: 'analisis_servicios', label: 'Análisis por servicio', confidence: 'medium' };
    }

    if (filenameHas('ocupacion') || filenameHas('ocupación')) {
      return { type: 'ocupacion_profesional', label: 'Ocupación por profesional', confidence: 'medium' };
    }

    if (filenameHas('horas')) {
      return { type: 'horas_profesional', label: 'Horas trabajadas por profesional', confidence: 'medium' };
    }

    // Caja / balance
    if (filenameHas('caja') || filenameHas('balance')) {
      if (filenameHas('profesional') || filenameHas('usuario')) {
        return { type: 'balance_profesional', label: 'Análisis de Caja por Profesional', confidence: 'medium' };
      }
      return { type: 'balance', label: 'Análisis de Caja', confidence: 'medium' };
    }

    // Citas (professional monthly)
    if (filenameHas('citas')) {
      return { type: 'citas_profesional', label: 'Citas por profesional', confidence: 'low' };
    }
  }

  return null;
}

export type BalanceRow = {
  id?: string;
  fecha: string;
  mes: string;
  anio: number;
  efectivo: number;
  tarjeta: number;
  talon_transferencia: number;
  bono_regalo: number;
  domiciliacion: number;
  total: number;
  created_at?: string;
};

export type BalanceProfesionalRow = {
  id?: string;
  usuario: string;
  fecha: string;
  mes: string;
  anio: number;
  efectivo: number;
  tarjeta: number;
  talon_transferencia: number;
  bono_regalo: number;
  domiciliacion: number;
  total: number;
  porcentaje: number;
  liquido: number;
  created_at?: string;
};

export type CitasProfesionalRow = {
  id?: string;
  usuario: string;
  fecha: string;
  num_citas: number;
  anio: number;
  mes: string;
  created_at?: string;
};

export type OcupacionProfesionalRow = {
  id?: string;
  usuario: string;
  fecha: string;
  valor_ocupacion: number;
  anio: number;
  mes: string;
  created_at?: string;
};

export type AnalisisServiciosRow = {
  id?: string;
  clinica: string;
  especialidad?: string;
  mutua?: string;
  servicio: string;
  num_citas: number;
  imp_servicio: number;
  imp_cita: number;
  duracion_media: number;
  total_base: number;
  total_desc: number;
  total_iva: number;
  total_ret: number;
  importe_total: number;
  anio: number;
  mes?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  periodo_tipo?: string;
  created_at?: string;
};

export type HorasProfesionalRow = {
  id?: string;
  usuario: string;
  fecha: string;
  horas: number;
  anio: number;
  mes: string;
  created_at?: string;
};

export type ListadoCitasRow = {
  id?: string;
  source_key?: string;
  estado: string;
  fecha_cita: string;
  fecha_creacion?: string;
  accion_id?: string;
  asunto?: string;
  paciente_nombre?: string;
  paciente_telefono?: string;
  servicio?: string;
  agenda: string;
  tipo?: string;
  importe: number | null; // No guardamos importe - los ingresos se toman del balance mensual
  sala_box?: string;
  confirmada: boolean;
  procedencia?: string;
  anio: number;
  mes: string;
  semana?: number;
  created_at?: string;
};

export type PacienteDemograficoRow = {
  id?: string;
  nh: string;
  nombre: string;
  apellidos?: string;
  sexo: string;
  fecha_nacimiento?: string; // YYYY-MM-DD
  telefono?: string;
  created_at?: string;
};


export function parseSpanishNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

// Parse balance CSV content
export function parseBalanceCSV(csvContent: string): Omit<BalanceRow, 'id' | 'created_at'>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const cleanLine = line.replace(/^\uFEFF/, '');
    const columns = cleanLine.split(';').map(col => col.replace(/^"|"$/g, '').trim());

    const [fecha, mesRaw, anio, efectivo, tarjeta, talonTransferencia, bonoRegalo, domiciliacion, total] = columns;

    const capitalizeMonth = (m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    const mes = mesRaw ? capitalizeMonth(mesRaw) : '';

    return {
      fecha: fecha || '',
      mes,
      anio: parseInt(anio) || new Date().getFullYear(),
      efectivo: parseSpanishNumber(efectivo),
      tarjeta: parseSpanishNumber(tarjeta),
      talon_transferencia: parseSpanishNumber(talonTransferencia),
      bono_regalo: parseSpanishNumber(bonoRegalo),
      domiciliacion: parseSpanishNumber(domiciliacion),
      total: parseSpanishNumber(total),
    };
  }).filter(row => row.fecha !== '');
}

// Parse balance profesional CSV content
export function parseBalanceProfesionalCSV(csvContent: string): Omit<BalanceProfesionalRow, 'id' | 'created_at'>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const cleanLine = line.replace(/^\uFEFF/, '');
    const columns = cleanLine.split(';').map(col => col.replace(/^"|"$/g, '').trim());

    const [usuario, fecha, mes, anio, efectivo, tarjeta, talonTransferencia, bonoRegalo, domiciliacion, total, porcentaje, liquido] = columns;

    return {
      usuario: usuario || '',
      fecha: fecha || '',
      mes: mes || '',
      anio: parseInt(anio) || new Date().getFullYear(),
      efectivo: parseSpanishNumber(efectivo),
      tarjeta: parseSpanishNumber(tarjeta),
      talon_transferencia: parseSpanishNumber(talonTransferencia),
      bono_regalo: parseSpanishNumber(bonoRegalo),
      domiciliacion: parseSpanishNumber(domiciliacion),
      total: parseSpanishNumber(total),
      porcentaje: parseSpanishNumber(porcentaje),
      liquido: parseSpanishNumber(liquido),
    };
  }).filter(row => row.usuario !== '');
}

// Parse citas profesional CSV content
export function parseCitasProfesionalCSV(csvContent: string): Omit<CitasProfesionalRow, 'id' | 'created_at'>[] {
  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const parseIntSafe = (value: string | undefined) => {
    if (!value) return 0;
    const cleaned = value.replace(/"/g, '').trim();
    const digits = cleaned.replace(/[^0-9-]/g, '');
    return digits ? parseInt(digits, 10) || 0 : 0;
  };

  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  // Extract year from any of the first lines (e.g., "Citas realizadas por mes de 2025")
  const firstLines = rawLines.slice(0, Math.min(10, rawLines.length)).join(' ');
  const yearMatch = firstLines.match(/(\d{4})/);
  const anio = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(30, rawLines.length)));
  const split = (line: string) =>
    line
      .split(separator)
      .map((col) => col.replace(/^"|"$/g, '').trim());

  // Find header row dynamically (it may have leading empty columns)
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    return cols.includes('usuario') && (cols.includes('enero') || cols.includes('febrero'));
  });

  if (headerIndex === -1) return [];

  const headerCols = split(rawLines[headerIndex]);
  const headerColsNorm = headerCols.map(normalize);

  const usuarioIdx = headerColsNorm.indexOf('usuario');
  if (usuarioIdx === -1) return [];

  const monthKeys = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ] as const;

  const monthIdx: Record<(typeof monthKeys)[number], number> = {
    enero: headerColsNorm.indexOf('enero'),
    febrero: headerColsNorm.indexOf('febrero'),
    marzo: headerColsNorm.indexOf('marzo'),
    abril: headerColsNorm.indexOf('abril'),
    mayo: headerColsNorm.indexOf('mayo'),
    junio: headerColsNorm.indexOf('junio'),
    julio: headerColsNorm.indexOf('julio'),
    agosto: headerColsNorm.indexOf('agosto'),
    septiembre: headerColsNorm.indexOf('septiembre'),
    octubre: headerColsNorm.indexOf('octubre'),
    noviembre: headerColsNorm.indexOf('noviembre'),
    diciembre: headerColsNorm.indexOf('diciembre'),
  };

  const dataLines = rawLines.slice(headerIndex + 1);
  const results: Omit<CitasProfesionalRow, 'id' | 'created_at'>[] = [];

  const getMonthNameSpanish = (monthIndex: number) => {
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return months[monthIndex];
  };

  dataLines.forEach((line) => {
    const cols = split(line);
    const usuario = (cols[usuarioIdx] || '').trim();
    if (!usuario) return;

    monthKeys.forEach((key, index) => {
      const value = parseIntSafe(cols[monthIdx[key]]);
      if (value > 0) {
        results.push({
          usuario,
          fecha: `${anio}-${String(index + 1).padStart(2, '0')}-01`,
          num_citas: value,
          anio,
          mes: getMonthNameSpanish(index)
        });
      }
    });
  });

  return results;
}

// Parse ocupacion profesional CSV content (values like "53,07% de 87:00h")
export function parseOcupacionProfesionalCSV(csvContent: string): Omit<OcupacionProfesionalRow, 'id' | 'created_at'>[] {
  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  // Parse percentage from format like "53,07% de 87:00h" -> 53.07
  const parsePercentage = (value: string | undefined) => {
    if (!value) return 0;
    const match = value.match(/^([\d,.]+)%/);
    if (!match) return 0;
    const numStr = match[1].replace(',', '.');
    return parseFloat(numStr) || 0;
  };

  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  // Extract year from any of the first lines
  const firstLines = rawLines.slice(0, Math.min(10, rawLines.length)).join(' ');
  const yearMatch = firstLines.match(/(\d{4})/);
  const anio = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(30, rawLines.length)));
  const split = (line: string) =>
    line
      .split(separator)
      .map((col) => col.replace(/^"|"$/g, '').trim());

  // Find header row dynamically
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    return cols.includes('usuario') && (cols.includes('enero') || cols.includes('febrero'));
  });

  if (headerIndex === -1) return [];

  const headerCols = split(rawLines[headerIndex]);
  const headerColsNorm = headerCols.map(normalize);

  const usuarioIdx = headerColsNorm.indexOf('usuario');
  if (usuarioIdx === -1) return [];

  const monthKeys = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ] as const;

  const monthIdx: Record<(typeof monthKeys)[number], number> = {
    enero: headerColsNorm.indexOf('enero'),
    febrero: headerColsNorm.indexOf('febrero'),
    marzo: headerColsNorm.indexOf('marzo'),
    abril: headerColsNorm.indexOf('abril'),
    mayo: headerColsNorm.indexOf('mayo'),
    junio: headerColsNorm.indexOf('junio'),
    julio: headerColsNorm.indexOf('julio'),
    agosto: headerColsNorm.indexOf('agosto'),
    septiembre: headerColsNorm.indexOf('septiembre'),
    octubre: headerColsNorm.indexOf('octubre'),
    noviembre: headerColsNorm.indexOf('noviembre'),
    diciembre: headerColsNorm.indexOf('diciembre'),
  };

  const dataLines = rawLines.slice(headerIndex + 1);
  const results: Omit<OcupacionProfesionalRow, 'id' | 'created_at'>[] = [];

  const getMonthNameSpanish = (monthIndex: number) => {
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return months[monthIndex];
  };

  dataLines.forEach((line) => {
    const cols = split(line);
    const usuario = (cols[usuarioIdx] || '').trim();
    if (!usuario) return;

    monthKeys.forEach((key, index) => {
      const value = parsePercentage(cols[monthIdx[key]]);
      if (value > 0) {
        results.push({
          usuario,
          fecha: `${anio}-${String(index + 1).padStart(2, '0')}-01`,
          valor_ocupacion: value,
          anio,
          mes: getMonthNameSpanish(index)
        });
      }
    });
  });

  return results;
}

// Parse analisis servicios CSV content
export function parseAnalisisServiciosCSV(
  csvContent: string,
  anio: number,
  fechaInicio?: string,
  fechaFin?: string,
  periodoTipo?: string,
  mes?: string | number,
  semana?: number
): Omit<AnalisisServiciosRow, 'id' | 'created_at'>[] {
  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(10, rawLines.length)));

  const split = (line: string) =>
    line
      .split(separator)
      .map((col) => col.replace(/^"|"$/g, '').trim());

  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  // Parse Spanish decimal format
  const parseDecimal = (value: string | undefined) => {
    if (!value) return 0;
    const cleaned = value.replace(/"/g, '').trim();
    // Handle Spanish format: 1.234,56 -> 1234.56
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const parseIntValue = (value: string | undefined) => {
    if (!value) return 0;
    const cleaned = value.replace(/"/g, '').trim();
    return Number.parseInt(cleaned, 10) || 0;
  };

  // Find header row
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    return cols.includes('clinica') && cols.includes('servicio');
  });

  if (headerIndex === -1) return [];

  const headerCols = split(rawLines[headerIndex]);
  const headerColsNorm = headerCols.map(normalize);

  // Map column indices
  const colIdx = {
    clinica: headerColsNorm.findIndex(c => c === 'clinica'),
    especialidad: headerColsNorm.findIndex(c => c === 'especialidad'),
    mutua: headerColsNorm.findIndex(c => c === 'mutua'),
    servicio: headerColsNorm.findIndex(c => c === 'servicio'),
    numCitas: headerColsNorm.findIndex(c => c.includes('citas') || c === 'n citas' || c === 'nº citas'),
    impServicio: headerColsNorm.findIndex(c => c.includes('imp.servicio') || c === 'impservicio'),
    impCita: headerColsNorm.findIndex(c => c.includes('imp.cita') || c === 'impcita'),
    duracionMedia: headerColsNorm.findIndex(c => c.includes('duracion') || c === 'duracion media'),
    totalBase: headerColsNorm.findIndex(c => c === 'total base'),
    totalDesc: headerColsNorm.findIndex(c => c === 'total desc'),
    totalIva: headerColsNorm.findIndex(c => c === 'total iva'),
    totalRet: headerColsNorm.findIndex(c => c === 'total ret'),
    importeTotal: headerColsNorm.findIndex(c => c === 'importe total'),
  };

  if (colIdx.clinica === -1 || colIdx.servicio === -1) return [];

  const dataLines = rawLines.slice(headerIndex + 1);

  return dataLines
    .map((line) => {
      const cols = split(line);
      const clinica = (cols[colIdx.clinica] || '').trim();
      const servicio = (cols[colIdx.servicio] || '').trim();

      if (!clinica || !servicio || servicio.toUpperCase().includes('SIN AGENDA')) return null;

      return {
        clinica,
        especialidad: colIdx.especialidad >= 0 ? cols[colIdx.especialidad]?.trim() : undefined,
        mutua: colIdx.mutua >= 0 ? cols[colIdx.mutua]?.trim() : undefined,
        servicio,
        num_citas: parseIntValue(cols[colIdx.numCitas]),
        imp_servicio: parseDecimal(cols[colIdx.impServicio]),
        imp_cita: parseDecimal(cols[colIdx.impCita]),
        duracion_media: parseDecimal(cols[colIdx.duracionMedia]),
        total_base: parseDecimal(cols[colIdx.totalBase]),
        total_desc: parseDecimal(cols[colIdx.totalDesc]),
        total_iva: parseDecimal(cols[colIdx.totalIva]),
        total_ret: parseDecimal(cols[colIdx.totalRet]),
        importe_total: parseDecimal(cols[colIdx.importeTotal]),
        anio,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        periodo_tipo: periodoTipo,
        mes: typeof mes === 'number' ? mes : (mes ? parseInt(mes as string) : null),
        semana: semana ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

// Parse horas profesional CSV content - converts "HH:MM" format to decimal hours
export function parseHorasProfesionalCSV(csvContent: string): Omit<HorasProfesionalRow, 'id' | 'created_at'>[] {
  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  // Parse time format "HH:MM" to integer hours (e.g., "167:00" -> 167, "46:10" -> 46, "46:40" -> 47)
  const parseTimeToHours = (value: string | undefined) => {
    if (!value) return 0;
    const cleaned = value.replace(/"/g, '').trim();
    if (cleaned === '0' || cleaned === '') return 0;

    const match = cleaned.match(/^(\d+):(\d+)$/);
    if (!match) return 0;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    // Return precise decimal hour
    return hours + (minutes / 60);
  };

  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  // Extract year from any of the first lines
  const firstLines = rawLines.slice(0, Math.min(10, rawLines.length)).join(' ');
  const yearMatch = firstLines.match(/(\d{4})/);
  const anio = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(30, rawLines.length)));
  const split = (line: string) =>
    line
      .split(separator)
      .map((col) => col.replace(/^"|"$/g, '').trim());

  // Find header row dynamically
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    return cols.includes('usuario') && (cols.includes('enero') || cols.includes('febrero'));
  });

  if (headerIndex === -1) return [];

  const headerCols = split(rawLines[headerIndex]);
  const headerColsNorm = headerCols.map(normalize);

  const usuarioIdx = headerColsNorm.indexOf('usuario');
  if (usuarioIdx === -1) return [];

  const monthKeys = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ] as const;

  const monthIdx: Record<(typeof monthKeys)[number], number> = {
    enero: headerColsNorm.indexOf('enero'),
    febrero: headerColsNorm.indexOf('febrero'),
    marzo: headerColsNorm.indexOf('marzo'),
    abril: headerColsNorm.indexOf('abril'),
    mayo: headerColsNorm.indexOf('mayo'),
    junio: headerColsNorm.indexOf('junio'),
    julio: headerColsNorm.indexOf('julio'),
    agosto: headerColsNorm.indexOf('agosto'),
    septiembre: headerColsNorm.indexOf('septiembre'),
    octubre: headerColsNorm.indexOf('octubre'),
    noviembre: headerColsNorm.indexOf('noviembre'),
    diciembre: headerColsNorm.indexOf('diciembre'),
  };

  const dataLines = rawLines.slice(headerIndex + 1);
  const results: Omit<HorasProfesionalRow, 'id' | 'created_at'>[] = [];

  const getMonthNameSpanish = (monthIndex: number) => {
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return months[monthIndex];
  };

  dataLines.forEach((line) => {
    const cols = split(line);
    const usuario = (cols[usuarioIdx] || '').trim();
    if (!usuario) return;

    monthKeys.forEach((key, index) => {
      const value = parseTimeToHours(cols[monthIdx[key]]);
      if (value > 0) {
        results.push({
          usuario,
          fecha: `${anio}-${String(index + 1).padStart(2, '0')}-01`,
          horas: value,
          anio,
          mes: getMonthNameSpanish(index)
        });
      }
    });
  });

  return results;
}

// Helper function to get ISO 8601 week number from date (weeks start on Monday)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks between yearStart and nearest Thursday
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Tiny MD5 (for stable dedupe keys). Public-domain style implementation.
// Only used to generate a deterministic key matching backend stored source_key.
function md5(str: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rotateLeft = (lValue: number, iShiftBits: number) => (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  const addUnsigned = (lX: number, lY: number) => {
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  };
  const f = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const g = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const h = (x: number, y: number, z: number) => x ^ y ^ z;
  const i = (x: number, y: number, z: number) => y ^ (x | ~z);
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, f(b, c, d)), addUnsigned(x, ac)), s), b);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, g(b, c, d)), addUnsigned(x, ac)), s), b);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, h(b, c, d)), addUnsigned(x, ac)), s), b);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, i(b, c, d)), addUnsigned(x, ac)), s), b);

  const convertToWordArray = (s: string) => {
    const lWordCount: number[] = [];
    const lMessageLength = s.length;
    let lNumberOfWordsTemp1 = lMessageLength + 8;
    const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCountIndex = (lByteCount - (lByteCount % 4)) / 4;
      lWordCount[lWordCountIndex] = lWordCount[lWordCountIndex] || 0;
      lWordCount[lWordCountIndex] |= s.charCodeAt(lByteCount) << ((lByteCount % 4) * 8);
      lByteCount++;
    }
    const lWordCountIndex = (lByteCount - (lByteCount % 4)) / 4;
    lWordCount[lWordCountIndex] = lWordCount[lWordCountIndex] || 0;
    lWordCount[lWordCountIndex] |= 0x80 << ((lByteCount % 4) * 8);
    lWordCount[lNumberOfWords - 2] = lMessageLength << 3;
    lWordCount[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordCount;
  };

  const wordToHex = (lValue: number) => {
    let wordToHexValue = "";
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      const hex = "0" + lByte.toString(16);
      wordToHexValue += hex.slice(-2);
    }
    return wordToHexValue;
  };

  // UTF-8 encode
  const utf8 = unescape(encodeURIComponent(str));
  const x = convertToWordArray(utf8);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const aa = a, bb = b, cc = c, dd = d;
    a = ff(a, b, c, d, x[k + 0], 7, 0xd76aa478);
    d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, x[k + 2], 17, 0x242070db);
    b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);

    a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, x[k + 10], 9, 0x02441453);
    c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);

    a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, x[k + 0], 11, 0xeaa127fa);
    c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, x[k + 6], 23, 0x04881d05);
    a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);

    a = ii(a, b, c, d, x[k + 0], 6, 0xf4292244);
    d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// Helper function to get month name in Spanish
function getMonthName(monthIndex: number): string {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return months[monthIndex] || "Enero";
}

// Parse listado de citas from tab-separated content (Excel export)
export function parseListadoCitasCSV(
  csvContent: string,
  anioSeleccionado: number,
  mesSeleccionado?: string,
  semanaSeleccionada?: number
): Omit<ListadoCitasRow, 'id' | 'created_at'>[] {
  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(15, rawLines.length)));

  const split = (line: string) =>
    line.split(separator).map((col) => col.replace(/^"|"$/g, '').trim());

  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  // Find header row - look for key columns
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    // Check for "estado" and ("fecha cita" or "fechacita" or "fecha")
    const hasEstado = cols.some(c => c === 'estado');
    const hasFechaCita = cols.some(c => c === 'fecha cita' || c === 'fechacita' || c === 'fecha' || (c.includes('fecha') && c.includes('cita')));
    return hasEstado && hasFechaCita;
  });

  if (headerIndex === -1) {
    console.log('Header not found. First lines:', rawLines.slice(0, 5));
    return [];
  }

  const headerCols = split(rawLines[headerIndex]);
  const headerColsNorm = headerCols.map(normalize);

  console.log('Headers found:', headerColsNorm);

  // Map column indices - more flexible matching
  const findColIndex = (patterns: string[]) => {
    return headerColsNorm.findIndex(c =>
      patterns.some(p => c === p || c.includes(p))
    );
  };

  const colIdx = {
    estado: findColIndex(['estado']),
    fechaCita: findColIndex(['fecha cita', 'fechacita', 'fecha']),
    fechaCreacion: findColIndex(['fecha creacion', 'fecha creación', 'fechacreacion']),
    acciones: findColIndex(['acciones', 'accion']),
    asunto: findColIndex(['asunto']),
    agenda: findColIndex(['agenda']),
    tipo: findColIndex(['tipo']),
    importe: findColIndex(['importe']),
    salaBox: findColIndex(['sala/box', 'sala', 'box']),
    confirmada: findColIndex(['confirmada']),
    procedencia: findColIndex(['procedencia']),
    hora: findColIndex(['hora', 'horacita', 'horario']),
  };

  console.log('Column indices:', colIdx);

  if (colIdx.estado === -1 || colIdx.fechaCita === -1) {
    console.log('Required columns not found');
    return [];
  }

  // Parse date in DD/MM/YYYY format
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  };

  // Parse importe - handles Spanish number format
  const parseImporte = (value: string | undefined): number => {
    if (!value) return 0;
    // Si contiene una coma, es formato español (1.234,56 o 1234,56)
    if (value.includes(',')) {
      const cleaned = value.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    }
    // Si no contiene coma pero tiene punto, es formato internacional o simple (26.25)
    const cleaned = value.replace(/[€\s]/g, '');
    return parseFloat(cleaned) || 0;
  };

  // Extract patient name and phone from asunto (format: "ID. NAME [PHONE] (SERVICE)")
  const extractPatientInfo = (asunto: string): { nombre: string; telefono: string; servicio: string } => {
    const result = { nombre: '', telefono: '', servicio: '' };
    if (!asunto) return result;

    // Extract service from parentheses
    const serviceMatch = asunto.match(/\(([^)]*(?:\([^)]*\)[^)]*)*)\)[^()]*$/);
    if (serviceMatch) {
      result.servicio = serviceMatch[1].trim();
    }

    // Extract phone from brackets
    const phoneMatch = asunto.match(/\[([^\]]+)\]/);
    if (phoneMatch) {
      const rawPhone = phoneMatch[1].trim();
      // If contains ' - ' it is multiple phones. Split and take first.
      const primary = rawPhone.includes(' - ') ? rawPhone.split(' - ')[0] : rawPhone;
      result.telefono = primary.replace(/\D/g, '');
    }

    // Extract name (after optional ID dot, before bracket or parenthesis)
    const nameMatch = asunto.match(/^(?:\d+\.\s*)?([^[\(]+)/);
    if (nameMatch) {
      result.nombre = nameMatch[1].trim();
    }

    return result;
  };

  const dataLines = rawLines.slice(headerIndex + 1);

  const toLocalISODate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const results = dataLines
    .map((line) => {
      const cols = split(line);
      let estado = (cols[colIdx.estado] || '').trim();

      // Normalizar "Pagada" a "Realizada (Pagada)" para que la lógica existente del dashboard 
      // (que busca startsWith("realizada")) las contabilice como citas completadas y pacientes nuevos.
      if (estado.toLowerCase() === 'pagada') {
        estado = 'Realizada (Pagada)';
      }
      const fechaCitaStr = (cols[colIdx.fechaCita] || '').trim();
      const horaStr = colIdx.hora >= 0 ? (cols[colIdx.hora] || '').trim() : '';
      const agenda = colIdx.agenda >= 0 ? (cols[colIdx.agenda] || '').trim() : 'Sin asignar';

      // Skip empty rows or header-like rows
      if (!estado || !fechaCitaStr || estado.toLowerCase() === 'estado') return null;

      // Try to parse date from file, otherwise use selected year
      let fechaCita = parseDate(fechaCitaStr);
      let anio = anioSeleccionado;
      let mes = mesSeleccionado || 'Enero';
      let semana = semanaSeleccionada || 1;

      if (fechaCita) {
        anio = fechaCita.getFullYear();
        mes = getMonthName(fechaCita.getMonth());
        semana = getWeekNumber(fechaCita);
      } else {
        // If date can't be parsed, create a date from the selected period
        const monthIndex = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ].indexOf(mes);
        fechaCita = new Date(anio, monthIndex >= 0 ? monthIndex : 0, 1);
      }

      const fechaCreacionStr = colIdx.fechaCreacion >= 0 ? (cols[colIdx.fechaCreacion] || '').trim() : '';
      const asunto = colIdx.asunto >= 0 ? (cols[colIdx.asunto] || '').trim() : '';

      // Filtrar bloques o citas sin profesional (SIN AGENDA) para que no ensucien las estadísticas
      const asuntoUpper = asunto.toUpperCase();
      const agendaUpper = agenda.toUpperCase();
      if (asuntoUpper.includes('SIN AGENDA') || agendaUpper.includes('SIN AGENDA')) return null;

      const patientInfo = extractPatientInfo(asunto);

      const confirmadaStr = colIdx.confirmada >= 0 ? (cols[colIdx.confirmada] || '').toLowerCase() : '';
      const confirmada = confirmadaStr === 'sí' || confirmadaStr === 'si' || confirmadaStr === 'yes' || confirmadaStr === 'true';

      const fecha_cita = toLocalISODate(fechaCita);
      const fecha_creacion = fechaCreacionStr ? (() => {
        const d = parseDate(fechaCreacionStr);
        return d ? toLocalISODate(d) : undefined;
      })() : undefined;

      // Incluimos accion_id y hora para diferenciar citas del mismo paciente en el mismo día
      const accion_id = colIdx.acciones >= 0 ? (cols[colIdx.acciones] || '').trim() : '';
      const source_key = md5(
        `${fecha_cita}|${horaStr}|${agenda}|${accion_id}|${asunto}|${patientInfo.telefono || ''}|${patientInfo.servicio || ''}`
      );

      return {
        source_key,
        estado,
        fecha_cita,
        fecha_creacion,
        accion_id: accion_id || undefined,
        asunto,
        paciente_nombre: patientInfo.nombre || undefined,
        paciente_telefono: patientInfo.telefono || undefined,
        servicio: patientInfo.servicio || undefined,
        agenda,
        tipo: colIdx.tipo >= 0 ? (cols[colIdx.tipo] || '').trim() : undefined,
        importe: colIdx.importe >= 0 ? parseImporte(cols[colIdx.importe]) : null,
        sala_box: colIdx.salaBox >= 0 ? (cols[colIdx.salaBox] || '').trim() || undefined : undefined,
        confirmada,
        procedencia: colIdx.procedencia >= 0 ? (cols[colIdx.procedencia] || '').trim() || undefined : undefined,
        anio,
        mes,
        semana,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  console.log('Parsed rows:', results.length);
  return results;
}


// Type for the combined productivity analysis result
export type AnalisisProductividadResult = {
  citas: Omit<CitasProfesionalRow, 'id' | 'created_at'>[];
  horas: Omit<HorasProfesionalRow, 'id' | 'created_at'>[];
  ocupacion: Omit<OcupacionProfesionalRow, 'id' | 'created_at'>[];
  jornadas: any[];
  month: string;
  year: number;
};

// Parse "Análisis de productividad" CSV that contains 3 sections:
// 1. "Citas realizadas por día" - daily appointments per professional
// 2. "Horas trabajadas por día" - daily hours per professional 
// 3. "Porcentaje de ocupación por día" - daily occupancy percentage per professional
export function parseAnalisisProductividadCSV(csvContent: string): AnalisisProductividadResult | null {
  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd());

  if (rawLines.length < 10) return null;

  // Detect separator
  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, 30));
  const split = (line: string) =>
    line.split(separator).map((col) => col.replace(/^"|"$/g, '').trim());

  // Map Spanish month names to month index (0-11)
  const monthNameToIndex: Record<string, number> = {
    'enero': 0,
    'febrero': 1,
    'marzo': 2,
    'abril': 3,
    'mayo': 4,
    'junio': 5,
    'julio': 6,
    'agosto': 7,
    'septiembre': 8,
    'octubre': 9,
    'noviembre': 10,
    'diciembre': 11,
  };

  // Extract month index and year from section headers like "Citas realizadas por día en Enero de 2026"
  const extractMonthYear = (headerLine: string): { monthIndex: number; year: number } | null => {
    const normalized = normalize(headerLine);
    const yearMatch = headerLine.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

    for (const [monthName, index] of Object.entries(monthNameToIndex)) {
      if (normalized.includes(monthName)) {
        return { monthIndex: index, year };
      }
    }
    return null;
  };

  // Find the 3 sections based on their headers
  type SectionInfo = { startLine: number; endLine: number; type: 'citas' | 'horas' | 'ocupacion' };
  const sections: SectionInfo[] = [];
  let detectedMonthIndex: number | null = null;
  let detectedYear: number | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const normalized = normalize(rawLines[i]);

    if (normalized.includes('citas realizadas por dia') || normalized.includes('citas realizadas por día')) {
      sections.push({ startLine: i, endLine: -1, type: 'citas' });
      const monthYear = extractMonthYear(rawLines[i]);
      if (monthYear) {
        detectedMonthIndex = monthYear.monthIndex;
        detectedYear = monthYear.year;
      }
    } else if (normalized.includes('horas trabajadas por dia') || normalized.includes('horas trabajadas por día')) {
      sections.push({ startLine: i, endLine: -1, type: 'horas' });
      const monthYear = extractMonthYear(rawLines[i]);
      if (monthYear && detectedMonthIndex === null) {
        detectedMonthIndex = monthYear.monthIndex;
        detectedYear = monthYear.year;
      }
    } else if (normalized.includes('porcentaje de ocupacion por dia') || normalized.includes('porcentaje de ocupación por día')) {
      sections.push({ startLine: i, endLine: -1, type: 'ocupacion' });
      const monthYear = extractMonthYear(rawLines[i]);
      if (monthYear && detectedMonthIndex === null) {
        detectedMonthIndex = monthYear.monthIndex;
        detectedYear = monthYear.year;
      }
    }
  }

  // Set end lines for each section
  for (let i = 0; i < sections.length; i++) {
    sections[i].endLine = i + 1 < sections.length
      ? sections[i + 1].startLine - 1
      : rawLines.length - 1;
  }

  if (sections.length !== 3 || detectedMonthIndex === null || !detectedYear) {
    console.error('Could not find all 3 sections or month/year in productivity CSV');
    return null;
  }

  // Parse integer value (for citas)
  const parseIntSafe = (value: string | undefined) => {
    if (!value) return 0;
    const cleaned = value.replace(/"/g, '').trim();
    if (cleaned === '0' || cleaned === '') return 0;
    const digits = cleaned.replace(/[^0-9-]/g, '');
    return digits ? parseInt(digits, 10) || 0 : 0;
  };

  // Parse time format "HH:MM" to hours and round
  const parseTimeToHours = (value: string | undefined) => {
    if (!value) return 0;
    const cleaned = value.replace(/"/g, '').trim();
    if (cleaned === '0' || cleaned === '') return 0;

    const match = cleaned.match(/^(\d+):(\d+)$/);
    if (!match) return 0;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours + (minutes / 60); // Return decimal for summing
  };

  // Parse percentage value - handles formats like "80% de 5:00h", "85.71%", "Libre"
  const parsePercentage = (value: string | undefined): { percentage: number; baseHours: number } => {
    if (!value) return { percentage: 0, baseHours: 0 };
    const cleaned = value.replace(/"/g, '').replace(',', '.').trim().toLowerCase();
    if (cleaned === '0' || cleaned === '' || cleaned === 'libre') return { percentage: 0, baseHours: 0 };
    
    let percentage = 0;
    let baseHours = 0;

    // Match percentage at the start (e.g., "80% de 5:00h")
    const matchPct = cleaned.match(/^([\d.]+)\s*%/);
    if (matchPct) {
      percentage = parseFloat(matchPct[1]) || 0;
    } else {
      // Fallback: try to parse as plain number
      percentage = parseFloat(cleaned) || 0;
    }

    // Attempt to extract base hours from '... de 5:00h'
    const matchHours = cleaned.match(/de\s+(\d+):(\d+)/i);
    if (matchHours) {
      baseHours = parseInt(matchHours[1], 10) + parseInt(matchHours[2], 10) / 60;
    }

    return { percentage, baseHours };
  };

  // Create empty month template
  const createEmptyMonths = () => ({
    enero: 0,
    febrero: 0,
    marzo: 0,
    abril: 0,
    mayo: 0,
    junio: 0,
    julio: 0,
    agosto: 0,
    septiembre: 0,
    octubre: 0,
    noviembre: 0,
    diciembre: 0,
  });

  // Parse a section and aggregate daily values
  const parseSection = (section: SectionInfo): Map<string, any[]> => {
    const results = new Map<string, any[]>();

    // Find header row (with Usuario and day numbers)
    let headerLineIdx = -1;
    for (let i = section.startLine + 1; i <= section.endLine; i++) {
      const cols = split(rawLines[i]).map(normalize);
      if (cols.includes('usuario') && cols.some(c => c === '01' || c === '02' || c === '1' || c === '2')) {
        headerLineIdx = i;
        break;
      }
    }

    if (headerLineIdx === -1) return results;

    const headerCols = split(rawLines[headerLineIdx]).map(normalize);
    const usuarioIdx = headerCols.indexOf('usuario');
    if (usuarioIdx === -1) return results;

    // Find day columns (01-31 or 1-31)
    const dayIndices: { day: number; index: number }[] = [];
    for (let i = 0; i < headerCols.length; i++) {
      const col = headerCols[i];
      const dayNum = parseInt(col, 10);
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
        dayIndices.push({ day: dayNum, index: i });
      }
    }

    // Parse data lines
    for (let i = headerLineIdx + 1; i <= section.endLine; i++) {
      const line = rawLines[i];
      if (!line.trim()) continue;

      const cols = split(line);
      const usuario = (cols[usuarioIdx] || '').trim();
      if (!usuario || usuario.toUpperCase().includes('SIN AGENDA')) continue;

      const values: any[] = dayIndices.map(({ day, index }) => {
        const val = cols[index] || '';
        if (section.type === 'citas') {
          return { day, value: parseIntSafe(val) };
        } else if (section.type === 'horas') {
          return { day, value: parseTimeToHours(val) };
        } else {
          return { day, value: parsePercentage(val) };
        }
      });

      results.set(usuario, values);
    }

    return results;
  };

  // Parse all sections
  const citasSection = sections.find(s => s.type === 'citas');
  const horasSection = sections.find(s => s.type === 'horas');
  const ocupacionSection = sections.find(s => s.type === 'ocupacion');

  if (!citasSection || !horasSection || !ocupacionSection) {
    return null;
  }

  const citasData = parseSection(citasSection);
  const horasData = parseSection(horasSection);
  const ocupacionData = parseSection(ocupacionSection);

  // Aggregation results
  const citas: Omit<CitasProfesionalRow, 'id' | 'created_at'>[] = [];
  const horas: Omit<HorasProfesionalRow, 'id' | 'created_at'>[] = [];
  const ocupacion: Omit<OcupacionProfesionalRow, 'id' | 'created_at'>[] = [];
  const jornadas: any[] = [];

  const formatFecha = (year: number, monthIndex: number, day: number) => {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getMonthNameSpanish = (monthIndex: number) => {
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return months[monthIndex];
  };

  const monthName = getMonthNameSpanish(detectedMonthIndex);

  // Get all unique users
  const allUsers = new Set([...citasData.keys(), ...horasData.keys(), ...ocupacionData.keys()]);

  for (const usuario of allUsers) {
    const dailyCitas = citasData.get(usuario) || [];
    const dailyHoras = horasData.get(usuario) || [];
    const dailyOcupacion = ocupacionData.get(usuario) || [];

    // Create daily rows for citas
    dailyCitas.forEach(item => {
      if (item.value > 0) {
        citas.push({
          usuario,
          fecha: formatFecha(detectedYear, detectedMonthIndex, item.day),
          num_citas: item.value,
          anio: detectedYear,
          mes: monthName
        });
      }
    });

    // Create daily rows for horas
    dailyHoras.forEach(item => {
      if (item.value > 0) {
        horas.push({
          usuario,
          fecha: formatFecha(detectedYear, detectedMonthIndex, item.day),
          horas: Math.round(item.value * 1000) / 1000,
          anio: detectedYear,
          mes: monthName
        });
      }
    });

    // Create daily rows for ocupacion (keeping only non-zero)
    dailyOcupacion.forEach(item => {
      if (item.value.percentage > 0) {
        ocupacion.push({
          usuario,
          fecha: formatFecha(detectedYear, detectedMonthIndex, item.day),
          valor_ocupacion: Math.round(item.value.percentage * 1000) / 1000,
          anio: detectedYear,
          mes: monthName
        });
      }

      // Also collect daily jornadas if baseHours > 0
      if (item.value.baseHours > 0) {
        jornadas.push({
          usuario,
          anio: detectedYear,
          mes: monthName,
          fecha: formatFecha(detectedYear, detectedMonthIndex, item.day),
          horas_jornada: item.value.baseHours,
        });
      }
    });
  }

  return {
    citas,
    horas,
    ocupacion,
    jornadas,
    month: monthName,
    year: detectedYear,
  };
}

// Parse "Listado de cumpleaños" CSV - extracts NH, name, sex, birth date, phone
export function parseCumpleanosCSV(csvContent: string): Partial<PacienteDemograficoRow>[] {
  const normalize = (s: string) =>
    (s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  // Detect separator
  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, 10));
  const split = (line: string) =>
    line.split(separator).map((col) => col.replace(/^"|"$/g, '').trim());

  // Find header row
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    return (cols.some(c => c === 'n.h.' || c === 'n.h' || c === 'nh') && cols.some(c => c === 'sexo')) ||
      (cols.some(c => c === 'nh') && cols.some(c => c === 'nombre'));
  });

  if (headerIndex === -1) return [];

  const headerCols = split(rawLines[headerIndex]).map(normalize);

  const idIdx = headerCols.findIndex(c => c === 'id' || c === 'identificador');
  const nhIdx = headerCols.findIndex(c => c === 'n.h.' || c === 'n.h' || c === 'nh');
  const nombreIdx = headerCols.findIndex(c => c === 'nombre');
  const apellidosIdx = headerCols.findIndex(c => c === 'apellidos');
  const sexoIdx = headerCols.findIndex(c => c === 'sexo');
  const fechaNacIdx = headerCols.findIndex(c => c === 'fecha nac.' || c === 'fecha nac' || c === 'fecha_nacimiento');
  const telIdx = headerCols.findIndex(c => c === 'telefono principal' || c === 'telefono');

  if (nhIdx === -1) return [];

  const dataLines = rawLines.slice(headerIndex + 1);

  return dataLines
    .map((line) => {
      const cols = split(line);
      const nh = (cols[nhIdx] || '').trim();
      if (!nh) return null;

      const id = idIdx >= 0 ? (cols[idIdx] || '').trim() : undefined;
      const nombre = nombreIdx >= 0 ? (cols[nombreIdx] || '').trim() : '';
      const apellidos = apellidosIdx >= 0 ? (cols[apellidosIdx] || '').trim() : '';
      const sexoRaw = sexoIdx >= 0 ? (cols[sexoIdx] || '').trim().toUpperCase() : 'DESCONOCIDO';
      const sexo = sexoRaw === 'MASCULINO' ? 'MASCULINO' : sexoRaw === 'FEMENINO' ? 'FEMENINO' : 'DESCONOCIDO';

      // Parse date DD/MM/YYYY -> YYYY-MM-DD or use YYYY-MM-DD directly
      let fechaNacimiento: string | undefined;
      if (fechaNacIdx >= 0) {
        const raw = (cols[fechaNacIdx] || '').trim();
        // Check if it's already YYYY-MM-DD
        if (raw.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const year = parseInt(raw.split('-')[0]);
          if (year > 1900) {
            fechaNacimiento = raw;
          }
        } else {
          const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (match) {
            const [, d, m, y] = match;
            const year = parseInt(y);
            // Filter out dummy dates (01/01/1000)
            if (year > 1900) {
              fechaNacimiento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        }
      }

      // Parse phone - clean up format like "++34 659-095-789"
      let telefono: string | undefined;
      if (telIdx >= 0) {
        const rawTel = (cols[telIdx] || '').trim();
        const cleaned = rawTel.replace(/\+/g, '').replace(/-/g, '').replace(/\s+/g, '').trim();
        if (cleaned && cleaned !== '' && cleaned.length >= 6) {
          telefono = cleaned;
        }
      }

      const row: Partial<PacienteDemograficoRow> = {
        nh,
        nombre: nombre || 'Sin nombre',
        apellidos: apellidos || undefined,
        sexo,
        fecha_nacimiento: fechaNacimiento,
        telefono,
      };

      if (id) {
        row.id = id;
      }

      return row;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// Type for recordatorios de cita
export type RecordatorioCitaRow = {
  nombre: string;
  telefono: string;
  fecha_cita: string; // YYYY-MM-DD
  hora_cita: string;
  agenda: string;
  asunto: string;
  tipo_cita: string;
};

// Parse listado de citas and extract only "Pendiente" appointments for reminders
export function parseRecordatoriosCitaCSV(csvContent: string): RecordatorioCitaRow[] {
  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 2) return [];

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(15, rawLines.length)));

  const split = (line: string) =>
    line.split(separator).map((col) => col.replace(/^"|"$/g, '').trim());

  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  // Find header row
  const headerIndex = rawLines.findIndex((line) => {
    const cols = split(line).map(normalize);
    const hasEstado = cols.some(c => c === 'estado');
    const hasFechaCita = cols.some(c => c === 'fecha' || c === 'fecha cita' || c === 'fechacita' || (c.includes('fecha') && c.includes('cita')));
    return hasEstado && hasFechaCita;
  });

  if (headerIndex === -1) return [];

  const headerCols = split(rawLines[headerIndex]);
  const headerColsNorm = headerCols.map(normalize);

  const findColIndex = (patterns: string[]) => {
    return headerColsNorm.findIndex(c =>
      patterns.some(p => c === p || c.includes(p))
    );
  };

  const colIdx = {
    estado: findColIndex(['estado']),
    fechaCita: findColIndex(['fecha cita', 'fechacita', 'fecha']),
    hora: findColIndex(['hora', 'horacita', 'horario']),
    agenda: findColIndex(['agenda']),
    asunto: findColIndex(['asunto']),
  };

  if (colIdx.estado === -1 || colIdx.fechaCita === -1) return [];

  // Parse date DD/MM/YYYY -> YYYY-MM-DD
  const parseDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Extract patient name, phone and service from asunto (format: "ID. NAME [PHONE] (SERVICE)")
  const extractPatientInfo = (asunto: string): { nombre: string; telefono: string; tipo_cita: string } => {
    const result = { nombre: '', telefono: '', tipo_cita: '' };
    if (!asunto) return result;

    // Extract phone from brackets
    const phoneMatch = asunto.match(/\[([^\]]+)\]/);
    if (phoneMatch) {
      const rawPhone = phoneMatch[1].trim();
      // If contains ' - ' it is multiple phones. Split and take first.
      // Otherwise, it might be 616-027-365 (replace only non-digits).
      const primary = rawPhone.includes(' - ') ? rawPhone.split(' - ')[0] : rawPhone;
      result.telefono = primary.replace(/\D/g, '');
    }
    
    // Extract service from parentheses
    const serviceMatch = asunto.match(/\(([^)]*(?:\([^)]*\)[^)]*)*)\)[^()]*$/);
    if (serviceMatch) {
      result.tipo_cita = serviceMatch[1].trim();
    }

    // Extract name (after optional ID dot, before bracket or parenthesis)
    const nameMatch = asunto.match(/^(?:\d+\.\s*)?([^[\(]+)/);
    if (nameMatch) {
      result.nombre = nameMatch[1].trim();
    }

    return result;
  };

  // Excluded asunto patterns (placeholders/test records)
  const EXCLUDED_ASUNTO = ['1918'];
  const EXCLUDED_PHONES = ['666666666'];

  const dataLines = rawLines.slice(headerIndex + 1);

  return dataLines
    .map((line) => {
      const cols = split(line);
      const estado = (cols[colIdx.estado] || '').trim();
      const fechaCitaStr = (cols[colIdx.fechaCita] || '').trim();
      const horaStr = colIdx.hora >= 0 ? (cols[colIdx.hora] || '').trim() : '';
      const agenda = colIdx.agenda >= 0 ? (cols[colIdx.agenda] || '').trim() : 'Sin asignar';
      const asunto = colIdx.asunto >= 0 ? (cols[colIdx.asunto] || '').trim() : '';

      // Filtrar estrictamente por estado "Pendiente" para evitar enviar recordatorios de citas anuladas
      if (!estado || !fechaCitaStr || estado.toLowerCase() !== 'pendiente') return null;

      // Filter out 'SIN AGENDA' (Pilates appointments MUST be included)
      const asuntoUpper = asunto.toUpperCase();
      const agendaUpper = agenda.toUpperCase();
      if (asuntoUpper.includes('SIN AGENDA') || agendaUpper.includes('SIN AGENDA')) return null;

      // Filter out placeholders
      if (EXCLUDED_ASUNTO.some(code => asunto.startsWith(code + '.'))) return null;

      const patientInfo = extractPatientInfo(asunto);

      // Filter out test phones
      if (!patientInfo.telefono || EXCLUDED_PHONES.includes(patientInfo.telefono)) return null;
      if (!patientInfo.nombre) return null;

      const fechaCita = parseDate(fechaCitaStr);
      if (!fechaCita) return null;

      return {
        nombre: patientInfo.nombre,
        telefono: patientInfo.telefono,
        fecha_cita: fechaCita,
        hora_cita: horaStr,
        agenda: agenda,
        asunto: asunto,
        tipo_cita: patientInfo.tipo_cita,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

// =====================================================
// CONTABILIDAD CLÍNICA - Complex accounting CSV parser
// =====================================================
export type ContabilidadRow = {
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
};

// Parse a CSV line handling quoted fields
function parseCSVLineQuoted(line: string, separator: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseContabilidadNumber(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '-') return 0;
  // Remove currency symbols, spaces, quotes
  let cleaned = value.replace(/[€$\s"]/g, '').trim();
  // Handle Spanish format: "132,032.30" or "132.032,30"
  // If it has both . and , check which comes last
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // comma is decimal: 132.032,30
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // dot is decimal: 132,032.30
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be decimal or thousands separator - if 2 digits after comma, treat as decimal
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseContabilidadClinicaCSV(csvContent: string, anio: number): ContabilidadRow[] {
  const rawLines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, '').trimEnd())
    .filter((l) => l.trim() !== '');

  if (rawLines.length < 5) return [];

  const rows: ContabilidadRow[] = [];
  let currentSection = '';

  const normalize = (s: string) =>
    (s || '').trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  // Known expense/structure section markers
  const KNOWN_SECTIONS: Record<string, string> = {
    'FIJOS': 'FIJOS',
    'FIJOS CLINICA': 'FIJOS',
    'EMPLEADOS': 'EMPLEADOS',
    'VARIABLES': 'VARIABLES',
    'VARIABLES CINICA': 'VARIABLES',
    'VARIABLES CLINICA': 'VARIABLES',
  };

  // Summary/skip section markers
  const SUMMARY_SECTIONS: Record<string, string> = {
    'GASTOS': 'RESUMEN',
    'INGRESOS': 'INGRESOS',
    'BENEFICIO': 'BENEFICIO',
    'TOTAL BENEFICIO': 'TOTAL_BENEFICIO',
    'TOTAL BENEFICIO EMPLEADOS': 'TOTAL_BENEFICIO',
  };

  // Labels to skip (summary rows)
  const SKIP_CONCEPTS = new Set([
    'TOTAL', 'TOTAL INGRESOS', 'TOTAL GASTOS',
    'MEDIA GASTOS FIJOS', 'MEDIA GASTOS TOTALES',
    'TOTAL FIJOS', 'EMPLEADOS SIN IRPF', 'EMPLEADOS CON IRPF',
    'TOTAL BENEFICIO EMPLEADOS',
    'MINIMO FACTURACION', 'TOTAL SUELDO',
  ]);

  // Professional detail row concepts (used to detect professional blocks)
  const PROF_ROW_CONCEPTS = new Set([
    'INGRESO', 'SALARIO NETO', 'NOMINA', 'TRANSFERENCIA',
    'COMISIONES', 'SS', 'IRPF', 'DESPIDO', 'VACACIONES',
    'MINIMO FACTURACION', 'TOTAL SUELDO', 'GASTO CON IRPF',
    'GASTO SIN IRPF', 'BENEFICIO REAL', 'BENEFICIO',
  ]);

  // Helper: check if monthly columns (2-13) have any numeric data
  const hasMonthlyData = (cols: string[]): boolean => {
    for (let m = 2; m <= 13; m++) {
      const val = parseContabilidadNumber(cols[m] || '');
      if (val !== 0) return true;
    }
    return false;
  };

  const detectSeparator = (lines: string[]) => {
    const candidates: Array<'\t' | ';' | ','> = ['\t', ';', ','];
    const totals = candidates.map((c) => {
      const re = c === '\t' ? /\t/g : c === ';' ? /;/g : /,/g;
      const n = lines.reduce((acc, line) => acc + (line.match(re) || []).length, 0);
      return { c, n };
    });
    totals.sort((a, b) => b.n - a.n);
    return totals[0]?.n ? totals[0].c : ';';
  };

  const separator = detectSeparator(rawLines.slice(0, Math.min(30, rawLines.length)));

  let passedSummary = false; // true once we've seen GASTOS/INGRESOS summary sections

  // Pre-parse all lines for lookahead
  const parsedLines = rawLines.map(l => parseCSVLineQuoted(l, separator));

  // Pre-scan: collect names of professionals that have individual tables (after summary)
  // so we can skip their rows in the EMPLEADOS section (they have more accurate data)
  const profWithIndividualTable = new Set<string>();
  {
    let seenSummary = false;
    for (let i = 1; i < parsedLines.length; i++) {
      const c0 = normalize(parsedLines[i][0] || '');
      const c1Raw = (parsedLines[i][1] || '').trim();
      const c1 = normalize(c1Raw);
      const sKey = (c0 && SUMMARY_SECTIONS[c0]) ? c0 : (c1 && SUMMARY_SECTIONS[c1]) ? c1 : null;
      if (sKey) { seenSummary = true; continue; }
      if (!seenSummary) continue;
      if (c1Raw && !PROF_ROW_CONCEPTS.has(c1) && !SKIP_CONCEPTS.has(c1)) {
        for (let j = i + 1; j < Math.min(i + 3, parsedLines.length); j++) {
          const nc = normalize((parsedLines[j][1] || '').trim());
          if (nc && PROF_ROW_CONCEPTS.has(nc)) {
            profWithIndividualTable.add(c1Raw.toUpperCase());
            break;
          }
        }
      }
    }
  }

  // Skip header row and process
  for (let i = 1; i < rawLines.length; i++) {
    const cols = parsedLines[i];

    const col0Norm = normalize(cols[0] || '');
    const conceptRaw = (cols[1] || '').trim();
    const conceptNorm = normalize(conceptRaw);

    // Check for known section markers (expense sections)
    let knownKey = (col0Norm && KNOWN_SECTIONS[col0Norm]) ? KNOWN_SECTIONS[col0Norm]
      : (conceptNorm && KNOWN_SECTIONS[conceptNorm]) ? KNOWN_SECTIONS[conceptNorm] : null;

    if (!knownKey && conceptNorm.startsWith('VARIABLES')) {
      knownKey = 'VARIABLES';
    }

    if (knownKey && !hasMonthlyData(cols)) {
      currentSection = knownKey;
      continue;
    }

    // Check for summary section markers
    const summaryKey = (col0Norm && SUMMARY_SECTIONS[col0Norm]) ? col0Norm
      : (conceptNorm && SUMMARY_SECTIONS[conceptNorm]) ? conceptNorm : null;

    if (summaryKey && !hasMonthlyData(cols)) {
      passedSummary = true;
      currentSection = SUMMARY_SECTIONS[summaryKey];
      continue;
    }

    const isSkippedConcept = (concept: string) => {
      if (!concept) return false;
      if (SKIP_CONCEPTS.has(concept)) return true;
      if (concept.startsWith('MINIMO FACTURAC')) return true;
      if (concept.startsWith('TOTAL SUELDO')) return true;
      return false;
    };

    // After summary sections, detect professional headers dynamically
    // A professional header: has a name in col[1], no meaningful monthly data,
    // and the next non-empty line has a professional detail concept (INGRESO, SALARIO NETO, etc.)
    if (passedSummary && conceptRaw && !hasMonthlyData(cols) && !isSkippedConcept(conceptNorm) && !PROF_ROW_CONCEPTS.has(conceptNorm)) {
      // Look ahead for a professional detail row
      for (let j = i + 1; j < Math.min(i + 3, rawLines.length); j++) {
        const nextCols = parsedLines[j];
        const nextConcept = normalize((nextCols[1] || '').trim());
        if (nextConcept && PROF_ROW_CONCEPTS.has(nextConcept)) {
          // This is a professional section header
          currentSection = conceptRaw; // Use original name as section key
          break;
        }
      }
      continue;
    }

    // Skip empty concept rows, summary sections
    if (!conceptRaw || currentSection === '' || currentSection === 'RESUMEN' || currentSection === 'TOTAL_BENEFICIO') continue;

    // Skip BENEFICIO summary section data
    if (currentSection === 'BENEFICIO') continue;

    // Skip summary label rows
    if (isSkippedConcept(conceptNorm)) continue;

    // (Skipping employees logic removed to ensure they appear in the UI's Empleados table)

    // Parse monthly values from columns 2-13
    const monthValues = [];
    for (let m = 2; m <= 13; m++) {
      monthValues.push(parseContabilidadNumber(cols[m] || ''));
    }

    // Only include rows that have at least one non-zero value
    const hasData = monthValues.some(v => v !== 0);
    if (!hasData) continue;

    // For autonomous professionals, map TRANSFERENCIA to GASTO CON IRPF for consistency
    let finalConcept = conceptRaw;
    if (conceptNorm === 'TRANSFERENCIA') {
      finalConcept = 'GASTO CON IRPF';
    }

    // Always calculate total from monthly values (CSV totals are unreliable)
    const calculatedTotal = monthValues.reduce((sum, v) => sum + v, 0);

    rows.push({
      seccion: currentSection,
      concepto: finalConcept,
      enero: monthValues[0],
      febrero: monthValues[1],
      marzo: monthValues[2],
      abril: monthValues[3],
      mayo: monthValues[4],
      junio: monthValues[5],
      julio: monthValues[6],
      agosto: monthValues[7],
      septiembre: monthValues[8],
      octubre: monthValues[9],
      noviembre: monthValues[10],
      diciembre: monthValues[11],
      total: calculatedTotal,
      anio,
    });
  }

  // Deduplicate: if same seccion+concepto appears twice, keep the last one
  const deduped = new Map<string, ContabilidadRow>();
  for (const row of rows) {
    const key = `${row.seccion}::${row.concepto}`;
    deduped.set(key, row);
  }

  return Array.from(deduped.values());
}

// ==== NEW: Vacaciones Parser ====
export interface VacacionesRegistro {
  usuario: string;
  fecha: string; // YYYY-MM-DD
  tipo: string;
  anio: number;
}

export function parseVacacionesCSV(csvData: string, anio: number): VacacionesRegistro[] {
  const parsed = Papa.parse(csvData, { skipEmptyLines: true });
  const records = parsed.data as string[][];

  if (!records || records.length === 0) return [];

  // Find the header row that starts with "Fisioterapeutas"
  let headerRowIndex = -1;
  for (let i = 0; i < records.length; i++) {
    if (records[i][0] && records[i][0].toLowerCase().includes('fisioterapeutas')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const headers = records[headerRowIndex];
  const results: VacacionesRegistro[] = [];

  const monthNamesMap: Record<string, string> = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dic': '12'
  };

  // Build a map of column index to full date string YYYY-MM-DD
  const dateColumns: { colIndex: number; dateStr: string }[] = [];
  for (let c = 1; c < headers.length; c++) {
    const colHeader = headers[c]?.trim().toLowerCase();
    if (!colHeader) continue;

    const match = colHeader.match(/^(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)$/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const monthStr = match[2];
      const monthNum = monthNamesMap[monthStr];
      if (monthNum) {
        dateColumns.push({
          colIndex: c,
          dateStr: `${anio}-${monthNum}-${day}`
        });
      }
    }
  }

  // Define valid absence types
  const validTypes = new Set(['V', 'E', 'C', 'LD', 'M']);

  // Extract data from the rows below the header
  for (let r = headerRowIndex + 1; r < records.length; r++) {
    const row = records[r];
    const physioName = row[0]?.trim();
    if (!physioName) continue; // Skip empty rows

    for (const { colIndex, dateStr } of dateColumns) {
      const cellValue = row[colIndex]?.trim().toUpperCase();
      if (cellValue && validTypes.has(cellValue)) {
        results.push({
          usuario: physioName,
          fecha: dateStr,
          tipo: cellValue,
          anio
        });
      }
    }
  }

  return results;
}
