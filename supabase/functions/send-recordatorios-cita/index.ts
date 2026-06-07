import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("No autorizado");

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("No autorizado - se requiere rol admin");

    // Get appointments from request body
    const { recordatorios } = await req.json() as {
      recordatorios: { nombre: string; telefono: string; fecha_cita: string; hora_cita: string }[];
    };

    if (!recordatorios || recordatorios.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay recordatorios para enviar", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to external Supabase
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
    const externalSupabase = createClient(externalUrl, externalKey);

    // Delete existing records for the same dates to avoid duplicates
    const fechas = [...new Set(recordatorios.map(r => r.fecha_cita))];
    for (const fecha of fechas) {
      await externalSupabase
        .from("recordatorios_cita")
        .delete()
        .eq("fecha_cita", fecha);
    }

    const { error: insertError, data } = await externalSupabase
      .from("recordatorios_cita")
      .insert(recordatorios);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        message: "Recordatorios enviados correctamente",
        inserted: recordatorios.length,
        fechas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
