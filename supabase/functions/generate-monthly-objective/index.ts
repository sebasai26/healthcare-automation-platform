import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MonthlyTrends {
  month1: { name: string; revenue: number; appointments: number; newPatients: number; cancellations: number };
  month2: { name: string; revenue: number; appointments: number; newPatients: number; cancellations: number };
  month3: { name: string; revenue: number; appointments: number; newPatients: number; cancellations: number };
  negativeTrends: string[];
  currentMonth: number;
  currentYear: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: "Permisos insuficientes" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { trends } = await req.json() as { trends: MonthlyTrends };

    if (!trends || !trends.negativeTrends) {
      return new Response(
        JSON.stringify({ error: "Datos de tendencias requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    // Build prompt for monthly objective
    const systemPrompt = `Eres un consultor experto en clínicas de fisioterapia. Tu tarea es generar UN ÚNICO objetivo mensual ESPECÍFICO, ACCIONABLE y con un PLAN CONCRETO.

CONTEXTO DE LA CLÍNICA:
- Los recordatorios de citas YA incluyen la opción de responder "ANULAR" o "CONFIRMAR" - NO sugieras esto.
- La comunicación es exclusivamente por WhatsApp.
- Política de cancelación: 50% del importe si cancelan con menos de 6 horas.

INSTRUCCIONES CRÍTICAS:
1. El objetivo DEBE basarse DIRECTAMENTE en las tendencias observadas que te proporciono
2. Si hay baja ocupación de un profesional específico, el objetivo debe ser sobre AUMENTAR sus citas
3. Si hay capacidad disponible, el objetivo debe ser sobre LLENAR esas horas
4. NO inventes métricas genéricas como "reducir cancelaciones" si la tendencia no lo menciona

ESTRUCTURA DEL OBJETIVO (OBLIGATORIA):
- Primera línea: Qué queremos conseguir (específico, vinculado a la tendencia)
- Segunda línea: Acción concreta 1 (qué hacer exactamente)
- Tercera línea: Acción concreta 2 (cómo medirlo o segunda acción)
- Opcional cuarta línea: Meta numérica específica

REGLAS:
1. ESPECÍFICO: Nombra profesionales, servicios o métricas concretas de las tendencias
2. ACCIONABLE: Cada línea debe ser una acción que se puede hacer esta semana
3. MEDIBLE: Incluir números concretos basados en los datos
4. NO uses emojis
5. NO sugieras ANULAR/CONFIRMAR en recordatorios (ya existe)
6. NO sugieras email o SMS (solo usan WhatsApp)

EJEMPLOS DE BUEN OBJETIVO:
"Aumentar la ocupación de Profesional B del 45% al 60% este mes.
Revisar su disponibilidad horaria y ajustarla a franjas de mayor demanda.
Derivar pacientes nuevos de servicios compatibles a sus horas disponibles.
Meta: Conseguir 15 citas adicionales en sus franjas vacías."

"Aprovechar la capacidad disponible para captar pacientes de traumatología.
Activar campaña de WhatsApp a pacientes antiguos de fisioterapia deportiva.
Ofrecer primera valoración con descuento en horas de baja demanda.
Meta: Llenar 20 horas de las 35 disponibles identificadas."

FORMATO JSON:
{
  "objetivo": "El objetivo completo con las acciones (2-4 líneas separadas por saltos de línea)",
  "contexto": "Qué tendencia específica aborda y por qué es prioritaria",
  "tendencia_principal": "La tendencia exacta que aborda (copiar de las proporcionadas)"
}`;

    const userPrompt = `TENDENCIAS OBSERVADAS EN LA CLÍNICA (últimos 3 meses):
${trends.negativeTrends.map(t => `• ${t}`).join('\n')}

DATOS DE CONTEXTO:
- ${trends.month3.name}: ${trends.month3.revenue.toLocaleString()}€ ingresos, ${trends.month3.appointments} citas
- ${trends.month2.name}: ${trends.month2.revenue.toLocaleString()}€ ingresos, ${trends.month2.appointments} citas  
- ${trends.month1.name}: ${trends.month1.revenue.toLocaleString()}€ ingresos, ${trends.month1.appointments} citas

IMPORTANTE: El objetivo DEBE abordar directamente una de las tendencias observadas arriba.
Prioriza las tendencias más específicas (como ocupación de un profesional concreto) sobre las genéricas.

Genera el objetivo para ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No response from AI");
    }

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch {
      result = {
        objetivo: "Mejorar las métricas negativas identificadas mediante acciones específicas durante este mes.",
        contexto: "Basado en las tendencias de los últimos meses.",
        tendencia_principal: trends.negativeTrends[0] || "Tendencia a mejorar",
      };
    }

    // Save to database
    const { error: upsertError } = await supabase
      .from("objetivo_mensual")
      .upsert({
        mes: trends.currentMonth,
        anio: trends.currentYear,
        objetivo: result.objetivo,
        contexto: result.contexto,
        tendencia_negativa_principal: result.tendencia_principal,
      }, {
        onConflict: 'mes,anio',
      });

    if (upsertError) {
      console.error("Error guardando objetivo:", upsertError);
    }

    return new Response(
      JSON.stringify({ objective: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
