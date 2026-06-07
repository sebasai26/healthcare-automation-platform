import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://your-project-id.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "your-anon-key";

// Cliente real de Supabase
const realSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Comprobar si el modo de demostración está activo
const isDemoMode = () => localStorage.getItem("marbellafisio_demo_mode") === "true";

// Datos ficticios detallados para el Modo Demo (sin datos reales de pacientes)
const MOCK_DATASETS: Record<string, any[]> = {
  ocupacion_profesional: [
    { usuario: "Yolanda Romero", anio: 2025, mes: "Diciembre", enero: 80, febrero: 82, marzo: 85, abril: 80, mayo: 78, junio: 84, julio: 82, agosto: 75, septiembre: 80, octubre: 82, noviembre: 84, diciembre: 85, valor_ocupacion: 81 },
    { usuario: "Cristina Ponce", anio: 2025, mes: "Diciembre", enero: 70, febrero: 72, marzo: 75, abril: 72, mayo: 70, junio: 74, julio: 72, agosto: 65, septiembre: 70, octubre: 72, noviembre: 75, diciembre: 78, valor_ocupacion: 72 },
    { usuario: "David Gómez", anio: 2025, mes: "Diciembre", enero: 75, febrero: 78, marzo: 80, abril: 78, mayo: 75, junio: 80, julio: 78, agosto: 70, septiembre: 75, octubre: 78, noviembre: 80, diciembre: 82, valor_ocupacion: 77 },
    { usuario: "Yolanda Romero", anio: 2026, mes: "Enero", enero: 82, febrero: 84, marzo: 86, abril: 82, mayo: 80, junio: 85, julio: 83, agosto: 76, septiembre: 82, octubre: 84, noviembre: 85, diciembre: 86, valor_ocupacion: 83 },
    { usuario: "Cristina Ponce", anio: 2026, mes: "Enero", enero: 72, febrero: 74, marzo: 76, abril: 74, mayo: 72, junio: 76, julio: 74, agosto: 66, septiembre: 72, octubre: 74, noviembre: 76, diciembre: 79, valor_ocupacion: 74 },
    { usuario: "David Gómez", anio: 2026, mes: "Enero", enero: 76, febrero: 79, marzo: 81, abril: 79, mayo: 76, junio: 81, julio: 79, agosto: 71, septiembre: 76, octubre: 79, noviembre: 81, diciembre: 83, valor_ocupacion: 78 }
  ],
  citas_profesional: [
    { usuario: "Yolanda Romero", anio: 2025, mes: "Diciembre", enero: 120, febrero: 115, marzo: 130, abril: 122, mayo: 118, junio: 125, julio: 120, agosto: 90, septiembre: 110, octubre: 115, noviembre: 120, diciembre: 130, num_citas: 120 },
    { usuario: "Cristina Ponce", anio: 2025, mes: "Diciembre", enero: 95, febrero: 90, marzo: 100, abril: 95, mayo: 92, junio: 98, julio: 95, agosto: 70, septiembre: 85, octubre: 90, noviembre: 95, diciembre: 105, num_citas: 95 },
    { usuario: "David Gómez", anio: 2025, mes: "Diciembre", enero: 110, febrero: 105, marzo: 115, abril: 110, mayo: 108, junio: 112, julio: 110, agosto: 85, septiembre: 100, octubre: 105, noviembre: 110, diciembre: 120, num_citas: 110 },
    { usuario: "Yolanda Romero", anio: 2026, mes: "Enero", enero: 125, febrero: 120, marzo: 135, abril: 127, mayo: 123, junio: 130, julio: 125, agosto: 95, septiembre: 115, octubre: 120, noviembre: 125, diciembre: 135, num_citas: 125 },
    { usuario: "Cristina Ponce", anio: 2026, mes: "Enero", enero: 100, febrero: 95, marzo: 105, abril: 100, mayo: 97, junio: 103, julio: 100, agosto: 75, septiembre: 90, octubre: 95, noviembre: 100, diciembre: 110, num_citas: 100 },
    { usuario: "David Gómez", anio: 2026, mes: "Enero", enero: 115, febrero: 110, marzo: 120, abril: 115, mayo: 113, junio: 117, julio: 115, agosto: 90, septiembre: 105, octubre: 110, noviembre: 115, diciembre: 125, num_citas: 115 }
  ],
  balance_profesional: [
    { usuario: "Yolanda Romero", anio: 2025, mes: "Diciembre", total: 5400, liquido: 5400 },
    { usuario: "Cristina Ponce", anio: 2025, mes: "Diciembre", total: 4275, liquido: 2565 },
    { usuario: "David Gómez", anio: 2025, mes: "Diciembre", total: 4950, liquido: 2970 },
    { usuario: "Yolanda Romero", anio: 2026, mes: "Enero", total: 5625, liquido: 5625 },
    { usuario: "Cristina Ponce", anio: 2026, mes: "Enero", total: 4500, liquido: 2700 },
    { usuario: "David Gómez", anio: 2026, mes: "Enero", total: 5175, liquido: 3105 }
  ],
  horas_profesional: [
    { usuario: "Yolanda Romero", anio: 2025, mes: "Diciembre", enero: 120, febrero: 115, marzo: 130, horas: 120 },
    { usuario: "Cristina Ponce", anio: 2025, mes: "Diciembre", enero: 95, febrero: 90, marzo: 100, horas: 95 },
    { usuario: "David Gómez", anio: 2025, mes: "Diciembre", enero: 110, febrero: 105, marzo: 115, horas: 110 },
    { usuario: "Yolanda Romero", anio: 2026, mes: "Enero", enero: 125, febrero: 120, marzo: 135, horas: 125 },
    { usuario: "Cristina Ponce", anio: 2026, mes: "Enero", enero: 100, febrero: 95, marzo: 105, horas: 100 },
    { usuario: "David Gómez", anio: 2026, mes: "Enero", enero: 115, febrero: 110, marzo: 120, horas: 115 }
  ],
  balance_mensual: [
    { anio: 2025, mes: "Diciembre", total: 14625, gastos: 4500, beneficio: 10125 },
    { anio: 2026, mes: "Enero", total: 15300, gastos: 4800, beneficio: 10500 }
  ],
  listado_citas: [
    { id: 1, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Consulta General [Yolanda Romero]", servicio: "Fisioterapia", mes: "Junio", paciente_telefono: "600111222", anio: 2026 },
    { id: 2, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Pilates Grupal [Cristina Ponce]", servicio: "Pilates", mes: "Junio", paciente_telefono: "600333444", anio: 2026 },
    { id: 3, estado: "Anulada", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Primera Consulta [David Gómez]", servicio: "Primera sesión", mes: "Junio", paciente_telefono: "600555666", anio: 2026 },
    { id: 4, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Fisioterapia Deportiva [David Gómez]", servicio: "Fisioterapia", mes: "Junio", paciente_telefono: "600777888", anio: 2026 },
    { id: 5, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Pilates Individual [Yolanda Romero]", servicio: "Pilates", mes: "Junio", paciente_telefono: "600999000", anio: 2026 },
    { id: 6, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Rehabilitación [Cristina Ponce]", servicio: "Fisioterapia", mes: "Junio", paciente_telefono: "600111333", anio: 2026 },
    { id: 7, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Primera Sesión Osteopatía [Yolanda Romero]", servicio: "Primera sesión", mes: "Junio", paciente_telefono: "600222444", anio: 2026 },
    { id: 8, estado: "Realizada (Pagada)", fecha_cita: new Date().toISOString().split('T')[0], asunto: "Fisioterapia Suelo Pélvico [Cristina Ponce]", servicio: "Fisioterapia", mes: "Junio", paciente_telefono: "600444666", anio: 2026 }
  ],
  analisis_servicios: [
    { servicio: "Fisioterapia", importe_total: 8500, num_citas: 170, fecha_inicio: "2026-06-01", fecha_fin: "2026-06-30", periodo_tipo: "monthly", mes: 6, anio: 2026 },
    { servicio: "Pilates", importe_total: 4200, num_citas: 105, fecha_inicio: "2026-06-01", fecha_fin: "2026-06-30", periodo_tipo: "monthly", mes: 6, anio: 2026 },
    { servicio: "Primera sesión", "importe_total": 2600, "num_citas": 52, "fecha_inicio": "2026-06-01", "fecha_fin": "2026-06-30", "periodo_tipo": "monthly", "mes": 6, "anio": 2026 }
  ],
  citas_extras_profesional: [],
  jornada_profesional: [],
  contabilidad_clinica: [
    { id: 1, fecha: "2026-06-01", categoria: "Alquiler", concepto: "Alquiler local comercial", importe: 1200, tipo: "gasto" },
    { id: 2, fecha: "2026-06-03", categoria: "Suministros", concepto: "Factura de Luz y Agua", importe: 250, tipo: "gasto" },
    { id: 3, fecha: "2026-06-05", categoria: "Material", concepto: "Consumibles y cremas de masaje", importe: 120, tipo: "gasto" }
  ],
  pacientes_demograficos: [
    { id: 1, nombre: "Juan Pérez García (Demo)", telefono: "600111222", edad: 42, direccion: "Calle Falsa 123, Marbella" },
    { id: 2, nombre: "María Rodríguez López (Demo)", telefono: "600333444", edad: 29, direccion: "Av. Principal 45, San Pedro" },
    { id: 3, nombre: "Carlos Martínez Ruiz (Demo)", telefono: "600555666", edad: 55, direccion: "Plaza Mayor 7, Estepona" },
    { id: 4, nombre: "Ana Belén Gómez (Demo)", telefono: "600777888", edad: 34, direccion: "Calle del Sol 19, Marbella" },
    { id: 5, nombre: "Jorge Sánchez Villa (Demo)", telefono: "600999000", edad: 61, direccion: "Calle del Mar 8, Marbella" }
  ],
  cumple_inactivos: [
    { id: 1, nombre: "Juan Pérez García (Demo)", telefono: "600111222", fecha_cumple: "1984-06-12", mes: "Junio", dia: 12 },
    { id: 2, nombre: "María Rodríguez López (Demo)", telefono: "600333444", fecha_cumple: "1997-06-25", mes: "Junio", dia: 25 }
  ],
  campanas_marketing: [
    { id: 1, nombre: "Campaña Google Ads - Fisioterapia (Demo)", tipo: "Google Ads", estado: "Activa", inversion: 300, retorno: 1200 },
    { id: 2, nombre: "Campaña Facebook - Pilates (Demo)", tipo: "Facebook Ads", estado: "Pausada", inversion: 150, retorno: 450 }
  ],
  sugerencias_guardadas: [
    { id: 1, sugerencia: "Fidelizar a los pacientes de Pilates ofreciendo un pack trimestral con 10% de descuento (Sugerencia Demo).", fecha: "2026-06-01", categoria: "Fidelización" },
    { id: 2, sugerencia: "Aumentar la inversión en Google Ads en la zona centro de Marbella para captar casos de dolor crónico (Sugerencia Demo).", fecha: "2026-06-03", categoria: "Captación" }
  ],
  analisis_ia: [],
  objetivo_mensual: [
    { anio: 2026, mes: "Junio", objetivo: 18000 }
  ]
};

// Builder de consultas falso para encadenamiento de métodos de Supabase PostgREST
class MockBuilder {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns?: string) { return this; }
  eq(column: string, value: any) { return this; }
  neq(column: string, value: any) { return this; }
  gt(column: string, value: any) { return this; }
  gte(column: string, value: any) { return this; }
  lt(column: string, value: any) { return this; }
  lte(column: string, value: any) { return this; }
  like(column: string, pattern: string) { return this; }
  ilike(column: string, pattern: string) { return this; }
  is(column: string, value: any) { return this; }
  in(column: string, values: any[]) { return this; }
  order(column: string, options?: any) { return this; }
  limit(value: number) { return this; }
  range(from: number, to: number) { return this; }
  not(column: string, operator: string, value: any) { return this; }

  // Permite resolver el builder como una promesa directamente (await o .then)
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    const data = MOCK_DATASETS[this.tableName] || [];
    const response = { data, error: null, count: data.length };
    return Promise.resolve(response).then(onfulfilled, onrejected);
  }
}

// Métodos de autenticación falsos para simular sesión
const mockAuth = {
  getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  onAuthStateChange: (callback: any) => {
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
  signOut: () => Promise.resolve({ error: null }),
  signInWithPassword: (credentials: any) => {
    return Promise.resolve({ data: { user: {}, session: {} }, error: null });
  }
};

// Interceptar llamadas al cliente de Supabase cuando el Modo Demo está activo
export const supabase = new Proxy(realSupabase, {
  get(target, prop, receiver) {
    if (isDemoMode()) {
      if (prop === 'auth') return mockAuth;
      if (prop === 'from') {
        return (tableName: string) => new MockBuilder(tableName);
      }
    }
    return Reflect.get(target, prop, receiver);
  }
});