import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConsentimientoRow {
  id: string;
  created_at: string;
  "Teléfono": string | null;
  "Email": string | null;
  "Estado": string | null;
  "Respuesta": string | null;
  "Respuesta diferente": string | null;
  "Plan.Enviada": string | null;
  "Tipo": string | null;
  "Sexo": string | null;
  "DNI": string | null;
  "CP": string | null;
  "Provincia": string | null;
  "País": string | null;
  "Poblacion": string | null;
  [key: string]: any; // allow extra columns we may not know about yet
}

export interface ConsentimientoMetrics {
  totalRegistros: number;
  mensajesEnviados: number;
  respuestasTotales: number;
  porcentajeRespuesta: number;
  interesados: number;
  noInteresados: number;
  respuestasDiferentes: number;
  sinRespuesta: number;
  sinEnviar: number;
}

function computeMetrics(rows: ConsentimientoRow[]): ConsentimientoMetrics {
  let mensajesEnviados = 0;
  let interesados = 0;
  let noInteresados = 0;
  let respuestasDiferentes = 0;

  for (const row of rows) {
    // Mensajes enviados = "Si" en "Plan.Enviada"
    const planEnviada = (row["Plan.Enviada"] || "").trim().toLowerCase();
    if (planEnviada === "si" || planEnviada === "sí") {
      mensajesEnviados++;
    }

    // Respuestas: "Si, me interesa" o "No, gracias" en Respuesta
    const respuesta = (row["Respuesta"] || "").trim().toLowerCase();
    if (respuesta === "si, me interesa" || respuesta === "sí, me interesa") {
      interesados++;
    } else if (respuesta === "no, gracias") {
      noInteresados++;
    }

    // Respuesta diferente (si tiene contenido, cuenta como respuesta)
    const respDiferente = (row["Respuesta diferente"] || "").trim();
    if (respDiferente.length > 0) {
      respuestasDiferentes++;
    }
  }

  const respuestasTotales = interesados + noInteresados + respuestasDiferentes;
  const porcentajeRespuesta = mensajesEnviados > 0
    ? Math.round((respuestasTotales / mensajesEnviados) * 1000) / 10
    : 0;
  const sinRespuesta = mensajesEnviados - respuestasTotales;
  const sinEnviar = rows.length - mensajesEnviados;

  return {
    totalRegistros: rows.length,
    mensajesEnviados,
    respuestasTotales,
    porcentajeRespuesta,
    interesados,
    noInteresados,
    respuestasDiferentes,
    sinRespuesta: Math.max(0, sinRespuesta),
    sinEnviar: Math.max(0, sinEnviar),
  };
}

export function useCampanaConsentimiento() {
  return useQuery({
    queryKey: ["campana_consentimiento"],
    queryFn: async () => {
      // Fetch all rows - using <any, any> because table is not in generated types
      const PAGE_SIZE = 1000;
      const allRows: ConsentimientoRow[] = [];

      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from<any, any>("campana_consentimiento")
          .select("*")
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (data) allRows.push(...data);
        if (!data || data.length < PAGE_SIZE) break;
        if (offset > 50000) break; // Safety cap
      }

      const metrics = computeMetrics(allRows);

      return {
        rows: allRows,
        metrics,
      };
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
