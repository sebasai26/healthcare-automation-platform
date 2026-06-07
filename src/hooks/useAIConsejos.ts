import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type AIConsejosTopic = "citas" | "pacientes" | "contabilidad" | "equipo" | "marketing";

export interface AIConsejosResponse {
    diagnostico: string;
    acciones: {
        id: string; // added for rating
        titulo: string;
        impacto: string;
        prioridad: "recomendada" | "urgente" | string;
        rating?: number; // 1-5
    }[];
}

export interface AISpecificConsejo {
    id: string;
    titulo: string;
    descripcion: string;
    feedback?: "up" | "down" | null;
}

export type AIPeriod = {
    type: 'month' | 'week';
    month?: string;
    week?: number;
    year: number;
};

export interface AISavedSuggestion {
    id: string;
    titulo: string;
    objetivo: string;
    hoja_ruta: string;
    fecha_guardado: string;
    topic: AIConsejosTopic;
}

export function useAIConsejos() {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentDataContext, setCurrentDataContext] = useState<string>("");
    
    // Initialize from localStorage if exists
    const getInitialAnalysis = () => {
        try {
            const saved = localStorage.getItem("ai_consejos_result");
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    };
    const [analysisResult, setAnalysisResult] = useState<AIConsejosResponse | null>(getInitialAnalysis);

    const [savedSuggestions, setSavedSuggestions] = useState<AISavedSuggestion[]>([]);

    // Load saved suggestions from Supabase
    useEffect(() => {
        const loadSuggestions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("sugerencias_guardadas")
                .select("*")
                .order("fecha_guardado", { ascending: false });
            
            if (error) {
                console.error("Error loading suggestions:", error);
                // Fallback to localStorage if DB fails
                const local = localStorage.getItem("ai_saved_suggestions");
                if (local) setSavedSuggestions(JSON.parse(local));
            } else {
                setSavedSuggestions(data as any[]);
            }
        };
        loadSuggestions();
    }, []);

    const getInitialSpecific = () => {
        try {
            const saved = localStorage.getItem("ai_specific_consejos");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    };
    const [specificConsejos, setSpecificConsejos] = useState<AISpecificConsejo[]>(getInitialSpecific);
    const [lastCustomTopic, setLastCustomTopic] = useState<string>(() => localStorage.getItem("ai_custom_topic") || "");
    const [isGeneratingSpecific, setIsGeneratingSpecific] = useState(false);

    const checkDailyLimit = async () => {
        const today = new Date().toLocaleDateString('en-CA');
        
        // 1. Check local storage (fastest)
        const localLastDate = localStorage.getItem("last_ai_generation_date");
        if (localLastDate === today) return true;

        // 2. Check clinic_config (most robust)
        try {
            const { data, error } = await supabase
                .from("clinic_config")
                .select("value")
                .eq("key", "last_ai_generation_date")
                .maybeSingle();
            
            if (error) {
                console.warn("Could not check daily limit in DB:", error.message);
                return false; // Fallback to allow if DB check fails or RLS blocks
            }

            if (data?.value === today) {
                // Sync local storage if DB has it but local doesn't
                localStorage.setItem("last_ai_generation_date", today);
                return true;
            }
        } catch (e) {
            console.warn("Error checking daily limit:", e);
        }

        return false;
    };

    const updateDailyLimit = async () => {
        const today = new Date().toLocaleDateString('en-CA');
        localStorage.setItem("last_ai_generation_date", today);

        try {
            // Check if we can write to clinic_config
            const { error } = await supabase
                .from("clinic_config")
                .upsert({
                    key: "last_ai_generation_date",
                    value: today,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'key'
                });
            
            if (error) {
                console.warn("Could not update daily limit in DB:", error.message);
            }
        } catch (e) {
            console.warn("Error updating daily limit:", e);
        }
    };

    const generateConsejos = async (topic: AIConsejosTopic, period: AIPeriod) => {
        setIsGenerating(true);

        try {
            const limitReached = await checkDailyLimit();
            if (limitReached) {
                toast({ 
                    title: "Límite diario alcanzado", 
                    description: "El análisis de hoy ya ha sido generado. Puedes generar uno nuevo mañana.",
                    variant: "default"
                });
                setIsGenerating(false);
                return;
            }

            setAnalysisResult(null);
            
            let dataContext = "";
            const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
            
            const periodLabel = period.type === 'month' 
                ? `${period.month} de ${period.year}` 
                : `Semana ${period.week} de ${period.year}`;

            if (topic === "citas") {
                let query = supabase.from("listado_citas").select("estado, importe, servicio, fecha_cita, tipo, agenda, asunto, paciente_telefono");
                
                if (period.type === 'month') {
                    const monthIdx = monthNames.indexOf(period.month || "");
                    const startDate = new Date(period.year, monthIdx, 1).toISOString();
                    const endDate = new Date(period.year, monthIdx + 1, 0).toISOString();
                    query = query.gte("fecha_cita", startDate).lte("fecha_cita", endDate);
                } else {
                    query = query.eq("anio", period.year).eq("semana", period.week);
                }

                const { data: citas, error } = await query;
                if (error) throw error;
                
                // Filter out placeholders and test records
                const filteredCitas = (citas || []).filter((c: any) => {
                    const asunto = (c.asunto || "").toLowerCase();
                    const servicio = (c.servicio || "").toLowerCase();
                    const telefono = (c.paciente_telefono || "").trim();
                    const agenda = (c.agenda || "").toLowerCase();
                    const esPlaceholder =
                        asunto.includes("1918") || asunto.includes("bloqueado") || asunto.includes("no citar") || 
                        servicio.includes("sin agenda") || agenda.includes("sin agenda");
                    const esTest = telefono === "666666666";
                    return !esPlaceholder && !esTest;
                });

                // AGREGAR datos en resumen compacto para evitar payloads gigantes a Gemini
                const totalCitas = filteredCitas.length;
                const realizadas = filteredCitas.filter((c: any) => (c.estado || '').toLowerCase() === 'realizada' || (c.estado || '').toLowerCase() === 'confirmada').length;
                const canceladas = filteredCitas.filter((c: any) => (c.estado || '').toLowerCase().includes('cancel')).length;
                const pendientes = totalCitas - realizadas - canceladas;

                // Agrupar por servicio
                const porServicio: Record<string, { total: number; importe: number }> = {};
                filteredCitas.forEach((c: any) => {
                    const srv = (c.servicio || 'Sin especificar').trim();
                    if (!porServicio[srv]) porServicio[srv] = { total: 0, importe: 0 };
                    porServicio[srv].total++;
                    porServicio[srv].importe += Number(c.importe) || 0;
                });

                // Agrupar por profesional (agenda)
                const porProfesional: Record<string, { total: number; realizadas: number }> = {};
                filteredCitas.forEach((c: any) => {
                    const agenda = (c.agenda || 'Sin asignar').trim();
                    if (!porProfesional[agenda]) porProfesional[agenda] = { total: 0, realizadas: 0 };
                    porProfesional[agenda].total++;
                    const esRealizada = (c.estado || '').toLowerCase() === 'realizada' || (c.estado || '').toLowerCase() === 'confirmada';
                    if (esRealizada) porProfesional[agenda].realizadas++;
                });

                const ingresoTotal = filteredCitas.reduce((s: number, c: any) => s + (Number(c.importe) || 0), 0);
                const ticketMedio = realizadas > 0 ? Math.round(ingresoTotal / realizadas) : 0;

                dataContext = JSON.stringify({
                    periodo: periodLabel,
                    resumen_general: {
                        total_citas: totalCitas,
                        realizadas,
                        canceladas,
                        pendientes,
                        tasa_cancelacion: totalCitas > 0 ? Math.round((canceladas / totalCitas) * 100) + '%' : '0%',
                        ingreso_total: ingresoTotal,
                        ticket_medio: ticketMedio
                    },
                    distribucion_servicios: Object.entries(porServicio)
                        .sort((a, b) => b[1].total - a[1].total)
                        .slice(0, 10)
                        .map(([servicio, datos]) => ({ servicio, ...datos })),
                    distribucion_profesionales: Object.entries(porProfesional)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([profesional, datos]) => ({ profesional, ...datos, tasa_realizacion: datos.total > 0 ? Math.round((datos.realizadas / datos.total) * 100) + '%' : '0%' }))
                });
            } else if (topic === "pacientes") {
                let queryCitas = supabase.from("listado_citas").select("paciente_nombre, paciente_telefono, asunto, servicio, estado, fecha_cita, tipo, agenda");
                
                if (period.type === 'month') {
                    const monthIdx = monthNames.indexOf(period.month || "");
                    const startDate = new Date(period.year, monthIdx, 1).toISOString();
                    const endDate = new Date(period.year, monthIdx + 1, 0).toISOString();
                    queryCitas = queryCitas.gte("fecha_cita", startDate).lte("fecha_cita", endDate);
                } else {
                    queryCitas = queryCitas.eq("anio", period.year).eq("semana", period.week);
                }

                const { data: citas } = await queryCitas;

                // Filter out placeholders and test records
                const filteredCitas = (citas || []).filter((c: any) => {
                    const asunto = (c.asunto || "").toLowerCase();
                    const servicio = (c.servicio || "").toLowerCase();
                    const telefono = (c.paciente_telefono || "").trim();
                    const agenda = (c.agenda || "").toLowerCase();
                    const esPlaceholder =
                        asunto.includes("1918") || asunto.includes("bloqueado") || asunto.includes("no citar") || 
                        servicio.includes("sin agenda") || agenda.includes("sin agenda");
                    const esTest = telefono === "666666666";
                    return !esPlaceholder && !esTest;
                });

                const { data: demograficos } = await supabase
                    .from("pacientes_demograficos")
                    .select("nombre, apellidos, sexo, fecha_nacimiento");
                
                // Agregar datos de pacientes con recurrencia
                const pacientesMap: Record<string, { citas: number; servicios: Set<string>; fechas: string[] }> = {};
                filteredCitas.forEach((c: any) => {
                    const key = (c.paciente_nombre || c.paciente_telefono || 'desconocido').trim();
                    if (!pacientesMap[key]) pacientesMap[key] = { citas: 0, servicios: new Set(), fechas: [] };
                    pacientesMap[key].citas++;
                    if (c.servicio) pacientesMap[key].servicios.add(c.servicio);
                    if (c.fecha_cita) pacientesMap[key].fechas.push(c.fecha_cita);
                });

                const pacientesList = Object.entries(pacientesMap)
                    .map(([nombre, d]) => ({ nombre, citas: d.citas, servicios: Array.from(d.servicios) }))
                    .sort((a, b) => b.citas - a.citas);

                // Distribucion por servicio
                const porServicio: Record<string, number> = {};
                filteredCitas.forEach((c: any) => {
                    const srv = c.servicio || 'Sin especificar';
                    porServicio[srv] = (porServicio[srv] || 0) + 1;
                });

                dataContext = JSON.stringify({
                    periodo: periodLabel,
                    resumen_asistencia: {
                        total_citas: filteredCitas.length,
                        total_pacientes_distintos: pacientesList.length,
                        pacientes_recurrentes: pacientesList.filter(p => p.citas >= 3).length,
                        pacientes_nuevos_estimados: pacientesList.filter(p => p.citas === 1).length
                    },
                    top_pacientes_por_citas: pacientesList.slice(0, 15),
                    distribucion_servicios: Object.entries(porServicio)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([servicio, total]) => ({ servicio, total }))
                });
            } else if (topic === "contabilidad") {
                const targetMonthIndex = period.type === 'month' ? monthNames.indexOf(period.month || "") : new Date().getMonth();
                const targetMonthName = monthNames[targetMonthIndex];
                const targetMonthSpanishCapitalized = targetMonthName.charAt(0).toUpperCase() + targetMonthName.slice(1);

                // 1. Get official revenues from balance_mensual (matches dashboard KPIs)
                const { data: revenues } = await supabase
                    .from("balance_mensual" as any)
                    .select("total")
                    .eq("anio", period.year)
                    .eq("mes", targetMonthSpanishCapitalized);
                
                const totalRevenue = ((revenues as any[]) || []).reduce((sum, r) => sum + (r.total || 0), 0);

                // 2. Get expenses from contabilidad_clinica
                const { data: contabilidad } = await supabase
                    .from("contabilidad_clinica")
                    .select("*")
                    .eq('anio', period.year);

                const getMonthValue = (row: any) => Number(row[targetMonthName.toLowerCase()]) || 0;
                
                const expenses = (contabilidad || []).filter(r => !['IRPF M.111', 'IRPF M.130', 'IVA M.303'].includes(r.concepto.trim()));
                const gastosFijos = expenses.filter(r => r.seccion === "FIJOS").reduce((sum, r) => sum + getMonthValue(r), 0);
                const gastosVariables = expenses.filter(r => r.seccion === "VARIABLES").reduce((sum, r) => sum + getMonthValue(r), 0);
                const gastosEmpleados = expenses.filter(r => r.seccion === "EMPLEADOS").reduce((sum, r) => sum + getMonthValue(r), 0);
                
                // 3. Get professional profitability
                const profData = (contabilidad || []).filter(r => !['FIJOS', 'VARIABLES', 'EMPLEADOS', 'RESUMEN', 'INGRESOS', 'BENEFICIO', 'TOTAL_BENEFICIO'].includes(r.seccion.toUpperCase()));
                const profs = [...new Set(profData.map(r => r.seccion))];
                const profStats = profs.map(name => {
                    const items = profData.filter(r => r.seccion === name);
                    const ing = items.filter(r => r.concepto.toUpperCase().includes("INGRESO")).reduce((sum, r) => sum + getMonthValue(r), 0);
                    const cost = items.filter(r => r.concepto.toUpperCase().includes("GASTO CON IRPF")).reduce((sum, r) => sum + getMonthValue(r), 0);
                    return { name, ingreso: ing, coste: cost, beneficio: ing - cost };
                });

                dataContext = JSON.stringify({
                    periodo: `${targetMonthName} ${period.year}`,
                    resumen_financiero: {
                        ingresos_totales: totalRevenue,
                        gastos_totales: gastosFijos + gastosVariables + gastosEmpleados,
                        beneficio_neto: totalRevenue - (gastosFijos + gastosVariables + gastosEmpleados),
                        desglose_gastos: { fijos: gastosFijos, variables: gastosVariables, empleados_sin_irpf: gastosEmpleados }
                    },
                    rentabilidad_profesionales: profStats
                });
            } else if (topic === "equipo") {
                const targetMonthIndex = period.type === 'month' ? monthNames.indexOf(period.month || "") : new Date().getMonth();
                const targetMonthName = monthNames[targetMonthIndex];
                const targetMonthSpanishCapitalized = targetMonthName.charAt(0).toUpperCase() + targetMonthName.slice(1);
                
                // Fetch all necessary tables for dynamic aggregation
                const [citasRes, extrasRes, jornadasRes, horasRes, balanceRes, contabRes] = await Promise.all([
                    (supabase as any).from("citas_profesional").select("*").eq("anio", period.year),
                    (supabase as any).from("citas_extras_profesional").select("*").eq("anio", period.year),
                    (supabase as any).from("jornada_profesional").select("*").eq("anio", period.year),
                    (supabase as any).from("horas_profesional").select("*").eq("anio", period.year),
                    (supabase as any).from("balance_mensual").select("*").eq("anio", period.year),
                    (supabase as any).from("contabilidad_clinica").select("*").eq("anio", period.year)
                ]);

                const getMonthVal = (row: any, m: string) => Number(row[m.toLowerCase()]) || 0;
                const isMatch = (r: any) => period.type === 'month' ? r.mes?.toLowerCase() === targetMonthName : r.semana === period.week;

                // 1. Get all unique users
                const allUsers = new Set<string>();
                [
                    ...(citasRes.data as any[] || []), 
                    ...(horasRes.data as any[] || []), 
                    ...(extrasRes.data as any[] || []), 
                    ...(balanceRes.data as any[] || [])
                ].forEach(r => {
                    if (r.usuario) allUsers.add(r.usuario.trim());
                });

                const results = Array.from(allUsers).map(usuario => {
                    const trimUser = usuario.toLowerCase();
                    const filterUser = (data: any[]) => (data || []).filter(r => (r.usuario || "").trim().toLowerCase() === trimUser && isMatch(r));
                    
                    const uCitas = filterUser(citasRes.data || []);
                    const uExtras = filterUser(extrasRes.data || []);
                    const uHoras = filterUser(horasRes.data || []);
                    const uJornadas = filterUser(jornadasRes.data || []);
                    const uBalance = filterUser(balanceRes.data || []);

                    const appointments = uCitas.reduce((s, r) => s + (r.num_citas || 0), 0) + uExtras.length;
                    const hoursBase = uHoras.reduce((s, r) => s + (Number(r.horas) || 0), 0);
                    const hoursExtra = uExtras.reduce((s, r) => s + (Number(r.duracion) || 0), 0);
                    const totalHours = hoursBase + hoursExtra;

                    // Journey hours for occupancy
                    const datesWithData = new Set([...uHoras.map(r => r.fecha), ...uExtras.map(r => r.fecha)]);
                    let totalJourneyHours = 0;
                    datesWithData.forEach(date => {
                        const j = uJornadas.find(r => r.fecha === date);
                        totalJourneyHours += j ? (Number(j.horas_jornada) || 0) : (Number(uHoras.find(r => r.fecha === date)?.horas || 0) + uExtras.filter(r => r.fecha === date).reduce((s, r) => s + (Number(r.duracion) || 0), 0));
                    });

                    const isCristinaPonce = usuario.toLowerCase().includes('cristina ponce');
                    const occupancy = totalJourneyHours > 0 ? (totalHours / totalJourneyHours) * 100 : 0;
                    const revenue = uBalance.reduce((s, r) => s + (r.total || 0), 0);

                    // Net Profit from contabilidad_clinica
                    const profData = (contabRes.data || []).filter(r => r.seccion?.toUpperCase() === usuario.toUpperCase() || (usuario.toLowerCase().includes('cristina ponce') && r.seccion?.toUpperCase() === 'CRIS'));
                    const ing = profData.filter(r => r.concepto.toUpperCase().includes("INGRESO")).reduce((sum, r) => sum + getMonthVal(r, targetMonthName), 0);
                    const cost = profData.filter(r => r.concepto.toUpperCase().includes("GASTO CON IRPF")).reduce((sum, r) => sum + getMonthVal(r, targetMonthName), 0);
                    
                    return {
                        nombre: usuario,
                        citas: appointments,
                        horas: totalHours.toFixed(1),
                        ocupacion: isCristinaPonce ? "N/A" : occupancy.toFixed(1) + "%",
                        facturacion: revenue,
                        beneficio_neto: ing - cost
                    };
                });

                const isHistorical = period.type === 'month' ? (period.year < new Date().getFullYear() || (period.year === new Date().getFullYear() && targetMonthIndex < new Date().getMonth())) : true;

                dataContext = JSON.stringify({
                    periodo: `${targetMonthName} ${period.year}`,
                    datos_completos: isHistorical, // Flag to tell AI that this data is already final/historical
                    productividad_equipo: results.filter(r => r.nombre.toLowerCase() !== 'cristina'),
                    total_citas: results.filter(r => r.nombre.toLowerCase() !== 'cristina').reduce((s, r) => s + r.citas, 0),
                    ocupacion_media: Math.round(results.filter(r => r.nombre.toLowerCase() !== 'cristina' && r.ocupacion !== "N/A").reduce((s, r) => s + parseFloat(r.ocupacion), 0) / results.filter(r => r.nombre.toLowerCase() !== 'cristina' && r.ocupacion !== "N/A").length) + "%"
                });
            } else if (topic === "marketing") {
                const { data: demograficos } = await supabase
                    .from("pacientes_demograficos")
                    .select("nombre, apellidos, sexo, fecha_nacimiento");
                
                let queryCitas = supabase.from("listado_citas").select("servicio, paciente_nombre, paciente_telefono, tipo, agenda, fecha_cita, asunto");
                if (period.type === 'month') {
                    const monthIdx = monthNames.indexOf(period.month || "");
                    const startDate = new Date(period.year, monthIdx, 1).toISOString();
                    const endDate = new Date(period.year, monthIdx + 1, 0).toISOString();
                    queryCitas = queryCitas.gte("fecha_cita", startDate).lte("fecha_cita", endDate);
                } else {
                    queryCitas = queryCitas.eq("anio", period.year).eq("semana", period.week);
                }

                const { data: citas } = await queryCitas;
                
                // Filter out placeholders and test records
                const filteredCitas = (citas || []).filter((c: any) => {
                    const asunto = (c.asunto || "").toLowerCase();
                    const servicio = (c.servicio || "").toLowerCase();
                    const telefono = (c.paciente_telefono || "").trim();
                    const agenda = (c.agenda || "").toLowerCase();
                    const esPlaceholder =
                        asunto.includes("1918") || asunto.includes("bloqueado") || asunto.includes("no citar") || 
                        servicio.includes("sin agenda") || agenda.includes("sin agenda");
                    const esTest = telefono === "666666666";
                    return !esPlaceholder && !esTest;
                });

                // Process Marketing Context
                const patientsData = new Map<string, { sessions: number, services: Set<string>, age?: number }>();
                const now = new Date();

                filteredCitas.forEach(c => {
                    const key = (c.paciente_nombre || c.paciente_telefono || "").trim();
                    if (!key) return;
                    if (!patientsData.has(key)) {
                        patientsData.set(key, { sessions: 0, services: new Set() });
                    }
                    const p = patientsData.get(key)!;
                    p.sessions++;
                    p.services.add((c.servicio || "").toLowerCase());
                });

                // Add age info
                (demograficos || []).forEach(d => {
                    const fullName = `${d.nombre} ${d.apellidos}`.trim();
                    // Simple name matching for demo
                    for (const [key, p] of patientsData.entries()) {
                        if (key.includes(d.nombre) || fullName.includes(key)) {
                            if (d.fecha_nacimiento) {
                                const birth = new Date(d.fecha_nacimiento);
                                let age = now.getFullYear() - birth.getFullYear();
                                if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
                                p.age = age;
                            }
                            break;
                        }
                    }
                });

                const ageGroups = { under30: 0, from30to50: 0, over50: 0, unknown: 0 };
                const crossSelling = { onlyPilates: 0, onlyPhysio: 0, both: 0 };
                const recurrentes = [];

                for (const [name, p] of patientsData.entries()) {
                    // Age
                    if (p.age === undefined) ageGroups.unknown++;
                    else if (p.age < 30) ageGroups.under30++;
                    else if (p.age <= 50) ageGroups.from30to50++;
                    else ageGroups.over50++;

                    // Services
                    const hasPilates = Array.from(p.services).some(s => s.includes("pilates"));
                    const hasPhysio = Array.from(p.services).some(s => s.includes("fisioterapia") || s.includes("sesion") || s.includes("sesión"));
                    
                    if (hasPilates && hasPhysio) crossSelling.both++;
                    else if (hasPilates) crossSelling.onlyPilates++;
                    else if (hasPhysio) crossSelling.onlyPhysio++;

                    // Recurrence
                    if (p.sessions >= 4) {
                        recurrentes.push({ nombre: name, sesiones: p.sessions });
                    }
                }

                dataContext = JSON.stringify({
                    periodo: periodLabel,
                    segmentacion_edad: ageGroups,
                    oportunidades_cross_selling: crossSelling,
                    pacientes_recurrentes_para_referidos: recurrentes.slice(0, 10), // Top 10 recurrentes
                    resumen_servicios: (citas || []).slice(0, 20) // Some context of services
                });
            }

            setCurrentDataContext(dataContext);

            const parts = [];
            const systemPrompt = `
Eres un Consultor Estratégico Senior especializado en clínicas de fisioterapia de alto rendimiento.
Tu objetivo es realizar un análisis ejecutivo y profesional basado en datos técnicos reales del Centro.

REGLAS CRÍTICAS DE ESTILO:
1. TONO: Serio, ejecutivo, analítico y profesional. 
2. LENGUAJE: No uses lenguaje alarmista (evita "fallo crítico", "crisis", "ineficiencia grave"). Usa "oportunidad de optimización", "margen de mejora técnica", "ajuste estratégico".
3. CLARIDAD: Evita tecnicismos confusos como "bloques de disponibilidad". En su lugar, explica de forma sencilla (ej: "horas de agenda vs citas realizadas").
4. DISPONIBILIDAD DE DATOS: Si el flag "datos_completos" es true o si los campos "facturacion" y "beneficio_neto" contienen valores distintos de cero, analízalos con total seguridad. No digas que los datos se están consolidando si ya están presentes; asume que son los datos finales para el análisis.
5. PROHIBICIÓN: ESTÁ ESTRICTAMENTE PROHIBIDO EL USO DE EMOJIS, EXCLAMACIONES EXCESIVAS O LENGUAJE COLOQUIAL.
6. ESPECIFICIDAD: Cada afirmación debe basarse en un dato real (profesional, servicio, importe o nombre de paciente si aplica).
7. IDENTIFICACIÓN DE PACIENTES: Usa siempre el NOMBRE del paciente, nunca el teléfono, para referirte a ellos en el análisis o las acciones.

ESTRUCTURA DE SALIDA (JSON ESTRICTO):
{
    "diagnostico": "Análisis ejecutivo claro y directo. PRIORIDAD: Si es CONTABILIDAD, céntrate en Beneficio Neto y reducción de Gastos. Si es MARKETING, céntrate en proponer campañas técnicas basadas en los datos de segmentación (edad, cross-selling, recurrentes).",
    "acciones": [
        {
            "id": "uuid único corto",
            "titulo": "Título de la campaña o acción (ej: 'Campaña WhatsApp para Pacientes de Traumatología')",
            "impacto": "Explicación técnica del beneficio esperado",
            "prioridad": "urgente" o "recomendada"
        }
    ]
}

REGLAS DE MARKETING (Si el topic es 'marketing'):
- Sé creativo y evita repetir siempre los mismos ejemplos (como el programa de referidos o pilates-fisio). Busca ángulos basados en la edad, la recurrencia o servicios específicos que aparezcan en los datos.
- Proponer campañas de WhatsApp específicas y personalizadas.
- Cross-selling: Identificar oportunidades entre servicios menos comunes si los datos lo permiten.
- Referidos: Usa la lista de 'pacientes_recurrentes' para proponer acciones hacia esos pacientes específicos por su nombre.
- Edad: Adaptar propuestas según los grupos de edad encontrados (ej: servicios senior para >55, rendimiento para <35).
- Evitar generalidades: No digas 'mejorar el marketing', di 'Lanzar campaña X al segmento Y con el objetivo Z'.
`;

            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-consejos', {
                body: { prompt: `${systemPrompt}\n\nCONJUNTO DE DATOS REALES PARA ${periodLabel}:\n${dataContext}`, temperature: 0.2 }
            });

            if (edgeError) {
                // Try to get a more descriptive error message from the response
                const errMsg = edgeData?.error || edgeError.message || "Error en el servicio de IA";
                throw new Error(errMsg);
            }
            
            const textContent = edgeData?.content;
            if (!textContent) throw new Error("El servicio de IA no devolvió contenido. Inténtalo de nuevo.");

            // Extraer JSON de manera robusta (puede venir en bloques markdown o texto plano)
            let parsed: AIConsejosResponse;
            try {
                const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
                const cleanText = jsonMatch ? jsonMatch[1].trim() : textContent.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
                parsed = JSON.parse(cleanText) as AIConsejosResponse;
            } catch (parseErr) {
                console.error("Error parseando respuesta de IA:", textContent.slice(0, 200));
                // Fallback: devolver estructura básica para no bloquear al usuario
                parsed = {
                    diagnostico: "No se pudo estructurar el análisis automáticamente. Los datos fueron procesados pero el formato de respuesta fue inesperado. Por favor, inténtalo de nuevo.",
                    acciones: []
                };
            }

            setAnalysisResult(parsed);
            localStorage.setItem("ai_consejos_result", JSON.stringify(parsed));
            localStorage.setItem("ai_consejos_topic", topic);

            // Update daily limit after successful generation
            await updateDailyLimit();

            toast({ title: "Análisis generado con éxito" });

        } catch (error: any) {
            console.error(error);
            toast({ title: "Error en el análisis", description: error?.message || "No se pudo generar.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const saveSuggestion = async (title: string, impact: string, topic: AIConsejosTopic) => {
        try {
            const context = analysisResult?.diagnostico || "";
            const prompt = `
            Basado en la siguiente sugerencia estratégica: "${title}" y su impacto: "${impact}".
            Contexto técnico analizado: "${context}"
            
            Tu tarea es generar un Objetivo Táctico ULTRA-ESPECÍFICO y REALISTA para esta sugerencia.
            
            REGLAS CRÍTICAS:
            1. USA DATOS REALES: Si el contexto menciona nombres (ej: Paula, Cristina), meses (ej: Marzo) o cifras (ej: 25 citas), ÚSALOS.
            2. IDENTIFICA PACIENTES POR NOMBRE: Si la sugerencia se refiere a un grupo de pacientes (ej: "los 8 más recurrentes"), DEBES BUSCAR SUS NOMBRES en los datos proporcionados y LISTARLOS EXPLÍCITAMENTE en el primer paso de la hoja de ruta (ej: "1. Extraer datos de contacto de Juan, María, Pedro...").
            3. FORMATO DE ÉXITO: El objetivo debe ser una meta numérica clara (ej: "Subir las citas realizadas en marzo de Paula a 30", "Reducir cancelaciones de Fisioterapia a menos de 5 este mes").
            4. COHERENCIA: El objetivo debe ser la consecuencia directa de aplicar la sugerencia.
            5. BREVEDAD: Máximo 20 palabras por línea.
            
            Responde ÚNICAMENTE con un JSON con esta estructura:
            {
                "objetivo": "Pasar de X a Y en [Mes] para [Profesional/Servicio]",
                "hoja_ruta": ["Paso 1 técnico con NOMBRES DE PACIENTES", "Paso 2 técnico", "Paso 3 técnico"]
            }
            `;

            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-consejos', {
                body: { prompt, temperature: 0.1 }
            });

            if (edgeError) {
                const errMsg = edgeData?.error || edgeError.message || "Error al guardar sugerencia";
                throw new Error(errMsg);
            }
            const resultText = edgeData?.content;
            if (!resultText) throw new Error("Respuesta vacía del servicio de IA");
            
            let result: { objetivo: string; hoja_ruta: string | string[] };
            try {
                const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
                const cleanText = jsonMatch ? jsonMatch[1].trim() : resultText.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
                result = JSON.parse(cleanText);
            } catch {
                result = { objetivo: title, hoja_ruta: [impact] };
            }

            const newSuggestion: AISavedSuggestion = {
                id: crypto.randomUUID(),
                titulo: title,
                objetivo: result.objetivo,
                hoja_ruta: Array.isArray(result.hoja_ruta) ? result.hoja_ruta.join('\n') : result.hoja_ruta,
                fecha_guardado: new Date().toLocaleDateString(),
                topic
            };

            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const { error: dbError } = await supabase
                    .from("sugerencias_guardadas")
                    .insert({
                        user_id: user.id,
                        titulo: newSuggestion.titulo,
                        objetivo: newSuggestion.objetivo,
                        hoja_ruta: newSuggestion.hoja_ruta,
                        topic: newSuggestion.topic,
                        fecha_guardado: new Date().toISOString()
                    });
                
                if (dbError) throw dbError;
            }

            const updated = [newSuggestion, ...savedSuggestions];
            setSavedSuggestions(updated);
            localStorage.setItem("ai_saved_suggestions", JSON.stringify(updated));
            toast({ title: "Sugerencia guardada", description: "La verás en la subsección de Sugerencias Guardadas." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error al guardar", variant: "destructive" });
        }
    };

    const deleteSavedSuggestion = async (id: string) => {
        try {
            const { error } = await supabase
                .from("sugerencias_guardadas")
                .delete()
                .eq("id", id);
            
            if (error) throw error;

            const updated = savedSuggestions.filter(s => s.id !== id);
            setSavedSuggestions(updated);
            localStorage.setItem("ai_saved_suggestions", JSON.stringify(updated));
        } catch (error) {
            console.error("Error deleting suggestion:", error);
            // Even if DB fails, update local state for better UX
            const updated = savedSuggestions.filter(s => s.id !== id);
            setSavedSuggestions(updated);
        }
    };

    const generateSpecificConsejos = async (customTopic: string) => {
        if (!customTopic.trim()) {
            toast({ title: "Atención", description: "Escribe un tema o problema específico antes de generar.", variant: "destructive" });
            return;
        }

        setIsGeneratingSpecific(true);
        
        try {
            const limitReached = await checkDailyLimit();
            if (limitReached) {
                toast({ 
                    title: "Límite diario alcanzado", 
                    description: "El análisis de hoy ya ha sido generado. Puedes generar uno nuevo mañana.",
                    variant: "default"
                });
                setIsGeneratingSpecific(false);
                return;
            }

            setSpecificConsejos([]); 
            const systemPrompt = `
Eres un consultor TOP de clínicas de fisioterapia altamente profesional.
El usuario de la clínica te está pidiendo soluciones para el siguiente problema específico: "${customTopic}".

Debes generar 5 consejos técnicos, aplicables y de alto impacto. NO uses texto genérico.
Usa un tono suave, constructivo y centrado en oportunidades de mejora.

INSTRUCCIONES DE SALIDA (JSON):
[
  {
    "titulo": "Título de la estrategia",
    "descripcion": "Descripción detallada de cómo ejecutarlo específicamente en una clínica de fisioterapia."
  }
]
`;

            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-consejos', {
                body: { prompt: systemPrompt, temperature: 0.3 }
            });

            if (edgeError) {
                const errMsg = edgeData?.error || edgeError.message || "Error en el servicio de IA";
                throw new Error(errMsg);
            }
            const textContent = edgeData?.content;
            if (!textContent) throw new Error("El servicio de IA no devolvió contenido");
            
            let parsedArray: Omit<AISpecificConsejo, "id">[];
            try {
                const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
                const cleanText = jsonMatch ? jsonMatch[1].trim() : textContent.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
                parsedArray = JSON.parse(cleanText) as Omit<AISpecificConsejo, "id">[];
            } catch {
                console.error("Error parseando consejos específicos:", textContent.slice(0, 200));
                parsedArray = [{ titulo: "Sin consejos disponibles", descripcion: "La IA no pudo estructurar la respuesta. Inténtalo de nuevo con una pregunta más específica." }];
            }

            const finalConsejos: AISpecificConsejo[] = parsedArray.slice(0, 5).map(c => ({
                ...c,
                id: crypto.randomUUID(),
                feedback: null
            }));

            setSpecificConsejos(finalConsejos);
            setLastCustomTopic(customTopic);
            localStorage.setItem("ai_specific_consejos", JSON.stringify(finalConsejos));
            localStorage.setItem("ai_custom_topic", customTopic);

            // Update daily limit after successful generation
            await updateDailyLimit();

            toast({ title: "Consejos específicos generados con éxito" });
        } catch (error: any) {
            console.error(error);
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsGeneratingSpecific(false);
        }
    };

    const rateSpecificConsejo = (id: string, fb: "up" | "down") => {
        const updated = specificConsejos.map(c => 
            c.id === id ? { ...c, feedback: c.feedback === fb ? null : fb } : c
        );
        setSpecificConsejos(updated);
        localStorage.setItem("ai_specific_consejos", JSON.stringify(updated));
    };

    const generateActionDetail = async (actionTitle: string, diagnosticContext: string, rawData: string): Promise<string> => {
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const prompt = `
            Eres un experto en operativa de clínicas de fisioterapia.
            PROHIBIDO: No repitas el diagnóstico previo ni parafrasees el contexto.
            OBJETIVO: Proporcionar una guía de ejecución directa para la acción: "${actionTitle}".
            
            ESTRUCTURA REQUERIDA:
            1. Una lista numerada (1, 2, 3...) con pasos sencillos, cortos y ejecutables. 
               IMPORTANTE: Si la acción se refiere a un grupo de pacientes (ej: "pacientes recurrentes"), el Paso 1 DEBE LISTAR LOS NOMBRES de esos pacientes específicos encontrados en los datos (ej: "1. Contactar con Carlos Ruiz, Ana Sanz...").
            2. Un apartado final llamado "OBJETIVO FINAL:" que resuma el resultado esperado en una sola frase.
            
            REGLAS:
            - Solo pasos accionables.
            - Nombres reales: Siempre usa nombres de personas (profesionales o pacientes) si están en los datos.
            - Máximo 150 palabras.
            - Tono serio y profesional.
            
            Contexto: ${diagnosticContext}
            Datos: ${rawData}
            `;

            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-consejos', {
                body: { prompt, temperature: 0.1, responseMimeType: "text/plain" }
            });

            if (edgeError) {
                console.error("Error en generateActionDetail:", edgeData?.error || edgeError.message);
                return "Error al generar la guía de ejecución. Inténtalo de nuevo.";
            }
            return edgeData?.content || "No se pudo generar el detalle.";
        } catch (error) {
            console.error(error);
            return "Error al profundizar.";
        }
    };

    const rateAction = (actionId: string, rating: number) => {
        if (!analysisResult) return;
        const updated = {
            ...analysisResult,
            acciones: analysisResult.acciones.map(a => a.id === actionId ? { ...a, rating } : a)
        };
        setAnalysisResult(updated);
        localStorage.setItem("ai_consejos_result", JSON.stringify(updated));
        
        // Save historic ratings for context
        const history = JSON.parse(localStorage.getItem("ai_ratings_history") || "[]");
        const action = updated.acciones.find(a => a.id === actionId);
        if (action) {
            history.push({ titulo: action.titulo, rating, date: new Date().toISOString() });
            localStorage.setItem("ai_ratings_history", JSON.stringify(history.slice(-20)));
        }
    };

    return {
        isGenerating,
        analysisResult,
        currentDataContext,
        generateConsejos,
        savedSuggestions,
        saveSuggestion,
        deleteSavedSuggestion,
        isGeneratingSpecific,
        specificConsejos,
        lastCustomTopic,
        generateSpecificConsejos,
        generateActionDetail,
        rateSpecificConsejo,
        rateAction
    };
}
