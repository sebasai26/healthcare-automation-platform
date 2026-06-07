import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizePhone = (raw: string): string => {
  if (!raw) return "";
  const primary = raw.split(/\s+-\s+/)[0] || raw;
  const digits = primary.replace(/\D/g, "");
  if (!digits || digits.length < 6) return "";
  return digits.startsWith("34") && digits.length >= 11 ? digits.slice(2) : digits;
};

// --- Name normalization (mirrors src/lib/name-utils.ts) ---
function fixReplacementChars(str: string): string {
  const replacementPattern = /[\uFFFD\u25C6\u2666\uFFFE]/g;
  return str.replace(replacementPattern, (_: string, offset: number, full: string) => {
    const after = (full[offset + 1] || '').toLowerCase();
    const before = (full[offset - 1] || '').toLowerCase();
    const twoAfter = (full[offset + 2] || '').toLowerCase();
    const twoBefore = (full[offset - 2] || '').toLowerCase();

    if (before === 'u' && after === 'o' && twoBefore === 'm') return 'Ñ';
    if ((before === 'a' && after === 'o') || (before === 'o' && after === 'o') ||
        (before === 'a' && after === 'a') || (before === 'e' && after === 'a') ||
        (before === 'i' && after === 'a') || (before === 'u' && after === 'a') ||
        (before === 'o' && after === 'e') || (before === 'i' && after === 'o') ||
        (before === 'a' && after === 'e')) return 'Ñ';

    if (before === 'r' && after === 's') return 'É';
    if (before === 'n' && after === 's') return 'É';
    if (before === 'p' && after === 'r') return 'É';
    if (before === 'c' && after === 's') return 'É';

    if (before === 'c' && after === 'a') return 'Í';
    if (before === 'r' && after === 'a') return 'Í';
    if (before === 'f' && after === 'a') return 'Í';
    if (before === 'l' && after === 'a') return 'Í';
    if (before === 'a' && after === 'c') return 'Í';
    if (before === 'g' && after === 'a') return 'Í';

    if (after === 'l' && twoAfter === 'v') return 'Á';
    if (after === 'n' && twoAfter === 'g') return 'Á';
    if (before === 'z' && after === 'l') return 'Á';
    if (before === '' && after === 'r') return 'Á';
    if (before === 'u' && after === 'r') return 'Á';
    if (before === 'm' && after === 'r') return 'Á';

    if (after === 's' && twoAfter === 'c') return 'Ó';
    if (before === 'g' && after === 'm') return 'Ó';
    if (before === 'l' && after === 'p') return 'Ó';
    if (before === 'm' && after === 'n') return 'Ó';

    if (before === 'a' && after === 'l') return 'Ú';
    if (before === 's' && after === 's') return 'Ú';
    if (before === 'l' && after === 'c') return 'Ú';

    if (before === 'm' && (after === ' ' || after === '')) return 'ª';

    return 'Ñ';
  });
}

function toTitleCase(str: string): string {
  return fixReplacementChars(str)
    .toLowerCase()
    .replace(/(?:^|\s|[-'(])\S/g, (match) => match.toUpperCase());
}

const TELEFONOS_EXCLUIDOS = ["666666666"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const BATCH = 1000;

    // 1. Fetch all patients from pacientes_demograficos
    const allPacientes: {
      nh: string;
      nombre: string;
      apellidos: string | null;
      telefono: string | null;
      fecha_nacimiento: string | null;
    }[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from("pacientes_demograficos")
        .select("nh, nombre, apellidos, telefono, fecha_nacimiento")
        .range(offset, offset + BATCH - 1);

      if (error) throw error;
      if (batch && batch.length > 0) {
        allPacientes.push(...batch);
        offset += batch.length;
        hasMore = batch.length === BATCH;
      } else {
        hasMore = false;
      }
    }

    // 2. Filter patients whose birthday is TODAY
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const todayDay = hoy.getDate();
    const todayMonth = hoy.getMonth();

    const cumpleHoy = allPacientes.filter((p) => {
      if (!p.fecha_nacimiento) return false;
      const birth = new Date(p.fecha_nacimiento + "T00:00:00");
      return birth.getDate() === todayDay && birth.getMonth() === todayMonth;
    });

    // 3. Build results - ALL birthday patients with valid phone (no inactivity filter)
    const resultado = [];
    for (const p of cumpleHoy) {
      const tel = normalizePhone(p.telefono || "");
      if (!tel || TELEFONOS_EXCLUIDOS.some((e) => tel.includes(e))) continue;

      resultado.push({
        numero_paciente: null,
        nh: p.nh,
        nombre: toTitleCase(p.nombre),
        apellidos: toTitleCase(p.apellidos || ""),
        telefono: tel,
        fecha_nacimiento: p.fecha_nacimiento,
        ultima_cita: null,
        dias_inactivo: 0,
      });
    }

    // 4. Insert into EXTERNAL cumple_inactivos table
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
    const externalSupabase = createClient(externalUrl, externalKey);

    let inserted = 0;
    if (resultado.length > 0) {
      const todayStr = hoy.toISOString().split("T")[0];
      const { data: existing } = await externalSupabase
        .from("cumple_inactivos")
        .select("telefono")
        .gte("created_at", todayStr + "T00:00:00")
        .lte("created_at", todayStr + "T23:59:59");

      const existingPhones = new Set((existing || []).map((e: any) => e.telefono));

      const newRecords = resultado
        .filter((r) => !existingPhones.has(r.telefono))
        .map((r) => ({
          numero_paciente: r.numero_paciente,
          nh: r.nh,
          nombre: r.nombre,
          apellidos: r.apellidos,
          telefono: r.telefono,
          fecha_nacimiento: r.fecha_nacimiento,
          ultima_cita: r.ultima_cita,
          dias_inactivo: r.dias_inactivo,
          procesado: false,
        }));

      if (newRecords.length > 0) {
        const { error: insertError } = await externalSupabase
          .from("cumple_inactivos")
          .insert(newRecords);

        if (insertError) throw insertError;
        inserted = newRecords.length;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Proceso completado",
        total_cumple_hoy: cumpleHoy.length,
        matches: resultado.length,
        nuevos_insertados: inserted,
        pacientes: resultado,
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
