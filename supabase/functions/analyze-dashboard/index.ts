import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DashboardData {
  period: {
    year: number;
    month: number;
    monthName: string;
  };
  weekLabel?: string;
  metrics: {
    totalRevenue: number;
    avgTicket: number;
    avgOccupancy: number;
    totalAppointments: number;
    cancellations: number;
    cancellationRate: number;
    newPatients: number;
    topService?: string;
    ltv?: number;
  };
  trends?: {
    citasTrend: number;
    cancelacionesTrend: number;
    nuevosTrend: number;
    ticketTrend: number;
    ltvTrend: number;
  };
  positiveTrends?: string[];
  negativeTrends?: string[];
  professionals: {
    name: string;
    occupancy: number;
    appointments: number;
    revenue: number;
    euroPerHour: number;
  }[];
  alerts: {
    type: string;
    title: string;
    impact?: string;
  }[];
  previousMonth?: {
    name: string;
    revenue: number;
    appointments: number;
    newPatients: number;
    avgTicket?: number;
    ltv?: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============= AUTHENTICATION CHECK =============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado. Inicia sesión para continuar." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT and get user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido. Inicia sesión de nuevo." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: "Permisos insuficientes. Solo administradores pueden usar esta función." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ============= END AUTHENTICATION CHECK =============

    // Fetch clinic context from config
    const { data: configData } = await supabase
      .from('clinic_config')
      .select('value')
      .eq('key', 'clinic_context')
      .single();
    
    const clinicContext = configData?.value || '';

    const { dashboardData } = await req.json() as { dashboardData: DashboardData };

    if (!dashboardData) {
      return new Response(
        JSON.stringify({ error: "No dashboard data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate dashboardData structure
    if (!dashboardData.period || !dashboardData.metrics || !Array.isArray(dashboardData.professionals)) {
      return new Response(
        JSON.stringify({ error: "Datos del dashboard incompletos o mal formados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Build context for Gemini - include clinic-specific context
    const systemPrompt = `Eres un consultor senior en gestión de clínicas de fisioterapia con experiencia real en operaciones, agenda, captación local y rentabilidad.

Tu función es ayudar a la dueña de la clínica a entender cómo va el mes actual y sugerir mejoras concretas, realistas y aplicables.

${clinicContext ? `\nCONTEXTO DE LA CLÍNICA (REGLAS ABSOLUTAS - NO VIOLAR NUNCA):\n${clinicContext}\n\nPROHIBICIONES BASADAS EN EL CONTEXTO:\n- PROHIBIDO sugerir sistemas de confirmación de citas (ya existe)\n- PROHIBIDO sugerir recordatorios automáticos (ya existen con ANULAR/CONFIRMAR)\n- PROHIBIDO sugerir políticas de cancelación (ya existe cobro del 50%)\n- PROHIBIDO sugerir uso de email o SMS (solo usan WhatsApp)\n- Si una acción ya está implementada según el contexto, NO la sugieras bajo ningún concepto\n` : ''}

TONO OBLIGATORIO
- Profesional, cercano y positivo.
- Nunca acusatorio ni alarmista.
- Celebra lo que va bien PRIMERO, con los porcentajes exactos que te proporciono.
- Orientado a oportunidades, no a problemas.
- Lenguaje claro, sin tecnicismos innecesarios.

ENFOQUE DEL ANÁLISIS
Tu análisis se centra en el MES ACTUAL hasta la fecha. Recibirás:
- Datos de la última semana con registros
- Ingresos acumulados del mes
- Tendencias con % de variación ya calculados

IMPORTANTE: Usa los porcentajes que te proporciono en "positiveTrends" y "negativeTrends". Son los datos correctos.

ESTRUCTURA DE RESPUESTA
1. El diagnóstico DEBE empezar hablando de lo que va bien, mencionando los % de mejora.
2. "cosas_positivas" debe incluir las métricas con tendencia positiva CON sus porcentajes.
3. "areas_mejora" son oportunidades expresadas de forma constructiva.
4. Las acciones son sugerencias útiles, nunca urgencias.

FORMATO DE RESPUESTA (JSON obligatorio):
{
  "diagnostico": "Resumen del mes actual (3-4 frases). EMPIEZA con lo positivo mencionando % de mejora. Luego menciona brevemente áreas de oportunidad.",
  "cosas_positivas": ["Array de 1-3 aspectos positivos. USA los porcentajes exactos: 'El ticket medio ha subido un X%', 'Los pacientes nuevos aumentaron Y%', etc."],
  "areas_mejora": ["Array de 1-2 oportunidades expresadas de forma constructiva, no como problemas"],
  "acciones": [
    {
      "titulo": "Sugerencia específica que empiece por verbo (Considerar, Explorar, Aprovechar, Potenciar...)",
      "impacto": "Beneficio esperado explicado brevemente",
      "prioridad": "recomendada|opcional"
    }
  ],
  "objetivo_mes": "UN ÚNICO objetivo específico, medible y alcanzable para el próximo mes. Debe abordar el área de mejora más importante. Formato: 'Conseguir [qué] mediante [cómo específico]'. Ejemplo: 'Reducir las cancelaciones a menos del 10% confirmando citas por WhatsApp 24h antes'",
  "objetivo_mes_contexto": "Breve explicación (1-2 frases) de por qué este objetivo es importante basándose en las tendencias negativas observadas"
}

REGLAS PARA cosas_positivas:
- INCLUYE los porcentajes exactos de las tendencias positivas que te proporciono
- Ejemplo: "El ticket medio ha subido un 15% respecto a diciembre (50€ vs 43€)"
- Ejemplo: "Las cancelaciones se han reducido un 20% respecto a la media semanal de diciembre"

REGLAS PARA ACCIONES:
- MÁXIMO 2 acciones (las más importantes)
- Usar verbos positivos: Considerar, Explorar, Aprovechar, Potenciar, Reforzar
- Evitar verbos alarmistas: Urgente, Corregir, Solucionar
- Cada acción debe ser específica y realista
- Las prioridades son "recomendada" u "opcional"

REGLAS PARA objetivo_mes:
- OBLIGATORIO: Debe ser específico y medible (con número o porcentaje objetivo)
- Debe derivarse directamente de las tendencias negativas o áreas de mejora
- Debe ser realista y alcanzable en un mes
- NO repetir las acciones, el objetivo es el RESULTADO a conseguir

OBJETIVO FINAL
Que la dueña de la clínica se sienta informada, apoyada y con ideas claras. El análisis debe transmitir confianza.`;

    // Calculate week progress in the month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const weeksElapsed = Math.ceil(dayOfMonth / 7);
    const totalWeeksInMonth = Math.ceil(daysInMonth / 7);
    const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

    const userPrompt = `Analiza estos datos de la clínica para ${dashboardData.period.monthName} ${dashboardData.period.year}:

PERÍODO ANALIZADO:
- Semana: ${dashboardData.weekLabel || `Semana ${weeksElapsed}`}
- Progreso del mes: ${monthProgress}% (semana ${weeksElapsed} de ${totalWeeksInMonth})

MÉTRICAS DEL MES ACTUAL (acumulado hasta hoy):
- Ingresos acumulados: ${dashboardData.metrics.totalRevenue.toLocaleString()}€
- Ticket medio: ${dashboardData.metrics.avgTicket}€
- Citas realizadas: ${dashboardData.metrics.totalAppointments}
- Cancelaciones: ${dashboardData.metrics.cancellations} (tasa: ${dashboardData.metrics.cancellationRate}%)
- Pacientes nuevos: ${dashboardData.metrics.newPatients}
${dashboardData.metrics.topService ? `- Servicio estrella: ${dashboardData.metrics.topService}` : ''}
${dashboardData.metrics.ltv ? `- LTV estimado: ${dashboardData.metrics.ltv}€` : ''}

${dashboardData.positiveTrends && dashboardData.positiveTrends.length > 0 ? `
✅ TENDENCIAS POSITIVAS (USA ESTOS DATOS EN "cosas_positivas"):
${dashboardData.positiveTrends.map(t => `- ${t}`).join('\n')}` : ''}

${dashboardData.negativeTrends && dashboardData.negativeTrends.length > 0 ? `
⚠️ ÁREAS DE ATENCIÓN:
${dashboardData.negativeTrends.map(t => `- ${t}`).join('\n')}` : ''}

${dashboardData.previousMonth ? `
REFERENCIA MES ANTERIOR (${dashboardData.previousMonth.name}):
- Ingresos totales: ${dashboardData.previousMonth.revenue.toLocaleString()}€
- Citas realizadas: ${dashboardData.previousMonth.appointments}
- Pacientes nuevos: ${dashboardData.previousMonth.newPatients}
- Ticket medio: ${dashboardData.previousMonth.avgTicket || 0}€
- LTV: ${dashboardData.previousMonth.ltv || 0}€` : ''}

${dashboardData.professionals.length > 0 ? `
PRODUCTIVIDAD POR PROFESIONAL (${dashboardData.previousMonth?.name || 'mes anterior'}):
${dashboardData.professionals.map(p => 
  `- ${p.name}: ${p.occupancy.toFixed(0)}% ocupación, ${p.appointments} citas, ${p.revenue.toLocaleString()}€`
).join('\n')}` : ''}

INSTRUCCIONES:
1. En "cosas_positivas", USA los porcentajes exactos de las tendencias positivas de arriba.
2. El diagnóstico debe EMPEZAR mencionando las mejoras con sus %.
3. Las acciones deben ser específicas y realistas.

Proporciona tu análisis en el formato JSON especificado.`;

    // Call Google Gemini API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Inténtalo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No response content from AI");
    }

    // Parse the JSON response from the AI
    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback to a structured response
      analysis = {
        diagnostico: content.slice(0, 200),
        problemas: ["No se pudo estructurar el análisis automáticamente"],
        oportunidades: [],
        acciones: [],
      };
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-dashboard:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
