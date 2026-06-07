import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { prompt, temperature = 0.2, responseMimeType = "application/json" } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY no configurada en Edge Functions");
    }

    // Use gemini-2.0-flash (stable and available model)
    const model = "gemini-2.0-flash";

    // Build generationConfig - only use responseMimeType for JSON responses
    // For text/plain requests, omit responseMimeType to avoid Gemini rejecting it
    const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens: 2048 };
    if (responseMimeType === "application/json") {
      generationConfig.responseMimeType = "application/json";
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        })
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini API error:", response.status, errBody);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes de IA excedido. Espera unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Gemini API Error (${response.status}): ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.error("Empty Gemini response:", JSON.stringify(data));
      throw new Error("Respuesta vacía del modelo de IA");
    }

    return new Response(
      JSON.stringify({ content: textContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-consejos error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
