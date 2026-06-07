import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PacienteInactivo {
  numero_paciente: string;
  paciente_nombre: string;
  paciente_telefono: string;
  ultima_cita: string;
  fisio_ultima_cita: string;
  dias_inactivo: number;
  tiempo_inactivo_texto: string;
  contactos: number;
}

// Filtros: "menos de X meses" significa pacientes inactivos entre 0 y X meses
export type FiltroTiempo = "1mes" | "2meses" | "3meses" | "4meses" | "5meses" | "6meses" | "9meses" | "12meses" | "24meses";
export type FiltroContacto = "todos" | "contactados" | "sin_contactar";

// "Menos de X meses" = pacientes con días de inactividad < X*30
const getDiasMaxFromFiltro = (filtro: FiltroTiempo): number => {
  switch (filtro) {
    case "1mes": return 30;
    case "2meses": return 60;
    case "3meses": return 90;
    case "4meses": return 120;
    case "5meses": return 150;
    case "6meses": return 180;
    case "9meses": return 270;
    case "12meses": return 365;
    case "24meses": return 730;
    default: return 30;
  }
};

const formatTiempoInactivo = (dias: number): string => {
  if (dias >= 365) {
    const years = Math.floor(dias / 365);
    const remainingDays = dias % 365;
    const months = Math.floor(remainingDays / 30);
    if (months > 0) {
      return `${years} año${years > 1 ? 's' : ''} y ${months} mes${months > 1 ? 'es' : ''}`;
    }
    return years === 1 ? "1 año" : `${years} años`;
  }
  if (dias >= 30) {
    const months = Math.floor(dias / 30);
    const remainingDays = dias % 30;
    if (remainingDays > 0) {
      return `${months} mes${months > 1 ? 'es' : ''} y ${remainingDays} día${remainingDays > 1 ? 's' : ''}`;
    }
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  return dias === 1 ? "1 día" : `${dias} días`;
};

// Limpiar y normalizar teléfono: tomar solo el primer número
const normalizeTelefono = (telefono: string): string => {
  if (!telefono) return "";
  const primary = telefono.split(/\s+-\s+/)[0] || telefono;
  const digits = primary.replace(/\D/g, "");
  if (!digits || digits.length < 6) return "";
  return digits.startsWith("34") && digits.length >= 11 ? digits.slice(2) : digits;
};

// Extraer número de paciente de los dígitos iniciales del asunto (antes del punto)
const extractNumPaciente = (asunto: string | null): string | null => {
  if (!asunto) return null;
  const match = asunto.match(/^(\d+)\./);
  return match ? match[1] : null;
};

// Teléfonos a excluir (genéricos/test)
const TELEFONOS_EXCLUIDOS = ["666666666"];

const isTelefonoValido = (telefono: string): boolean => {
  if (!telefono) return false;
  const telefonoLimpio = telefono.replace(/[\s\-+]/g, '');
  return !TELEFONOS_EXCLUIDOS.some(excluido => telefonoLimpio.includes(excluido));
};

export function usePacientesInactivos(
  filtroTiempo: FiltroTiempo = "1mes",
  filtroContacto: FiltroContacto = "todos",
  page: number = 1,
  pageSize: number = 10
) {
  return useQuery({
    queryKey: ["pacientes_inactivos", filtroTiempo, filtroContacto, page, pageSize],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ pacientes: PacienteInactivo[]; totalCount: number }> => {
      // Fetch ALL appointments using pagination
      const allCitas: {
        paciente_nombre: string | null;
        paciente_telefono: string | null;
        fecha_cita: string;
        estado: string;
        asunto: string | null;
        agenda: string | null;
      }[] = [];
      
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from("listado_citas")
          .select("paciente_nombre, paciente_telefono, fecha_cita, estado, asunto, agenda")
          .order("fecha_cita", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;
        
        if (batch && batch.length > 0) {
          allCitas.push(...batch);
          offset += batch.length;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Filter only completed appointments with valid phones
      const citasRealizadas = allCitas.filter((c) => {
        const estado = (c.estado || "").toLowerCase();
        const telefonoValido = isTelefonoValido(c.paciente_telefono || "");
        const asunto = (c.asunto || "").toLowerCase();
        const agenda = (c.agenda || "").trim().toLowerCase();
        const esPlaceholder = asunto.includes("bloqueado") || asunto.includes("no citar") || asunto.includes("1918");
        return estado.startsWith("realizada") && telefonoValido && !esPlaceholder && agenda !== "recepcion";
      });

      // Group by NH (extracted from asunto) - track last realized appointment
      const citasMap = new Map<string, {
        nombre: string;
        telefono: string;
        ultimaCita: Date;
        agenda: string;
      }>();

      citasRealizadas.forEach((cita) => {
        const nh = extractNumPaciente(cita.asunto);
        if (!nh) return;

        const fechaCita = new Date(cita.fecha_cita + 'T00:00:00');
        const existing = citasMap.get(nh);

        if (!existing || fechaCita > existing.ultimaCita) {
          citasMap.set(nh, {
            nombre: cita.paciente_nombre || "Sin nombre",
            telefono: normalizeTelefono(cita.paciente_telefono || ""),
            ultimaCita: fechaCita,
            agenda: cita.agenda || "Sin asignar",
          });
        }
      });

      // Build inactive patients list
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const maxDias = getDiasMaxFromFiltro(filtroTiempo);

      let pacientesInactivos: PacienteInactivo[] = [];

      citasMap.forEach((citaData, nh) => {
        const diasInactivo = Math.floor((hoy.getTime() - citaData.ultimaCita.getTime()) / (1000 * 60 * 60 * 24));
        if (diasInactivo > 0 && diasInactivo < maxDias) {
          pacientesInactivos.push({
            numero_paciente: nh,
            paciente_nombre: citaData.nombre,
            paciente_telefono: citaData.telefono,
            ultima_cita: citaData.ultimaCita.toISOString().split("T")[0],
            fisio_ultima_cita: citaData.agenda,
            dias_inactivo: diasInactivo,
            tiempo_inactivo_texto: formatTiempoInactivo(diasInactivo),
            contactos: 0,
          });
        }
      });

      // Sort descending by inactivity
      pacientesInactivos.sort((a, b) => b.dias_inactivo - a.dias_inactivo);

      // Apply contact filter
      if (filtroContacto === "contactados") {
        pacientesInactivos = pacientesInactivos.filter((p) => p.contactos > 0);
      } else if (filtroContacto === "sin_contactar") {
        pacientesInactivos = pacientesInactivos.filter((p) => p.contactos === 0);
      }

      const totalCount = pacientesInactivos.length;

      // Paginate
      const startIndex = (page - 1) * pageSize;
      const paginatedPacientes = pacientesInactivos.slice(startIndex, startIndex + pageSize);

      return {
        pacientes: paginatedPacientes,
        totalCount,
      };
    },
  });
}

// Hook for cancellation patients (reincidentes) - moved logic from ActivitySection
export interface PacienteCancelador {
  numero_paciente: string;
  paciente_nombre: string;
  paciente_telefono: string;
  cancelaciones: number;
  ultima_cancelacion: string;
  tipo_cita: "Pilates" | "Fisioterapia" | "Ambos";
  detalles: { id: string; fecha: string; tipo: string; asunto: string }[];
}

export function usePacientesCanceladores(
  anio?: number,
  mes?: string,
  page: number = 1,
  pageSize: number = 10
) {
  const currentYear = new Date().getFullYear();
  const year = anio ?? currentYear;

  return useQuery({
    queryKey: ["pacientes_canceladores", year, mes, page, pageSize],
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<{ pacientes: PacienteCancelador[]; totalCount: number }> => {
      let query = supabase
        .from("listado_citas")
        .select("id, paciente_nombre, paciente_telefono, fecha_cita, estado, asunto")
        .eq("anio", year);

      if (mes) {
        query = query.eq("mes", mes);
      }

      const { data: citas, error } = await query;

      if (error) throw error;

      // Filter cancelled appointments and exclude invalid phone numbers, also exclude Pilates
      const citasCanceladas = (citas || [])
        .filter((c) => {
          const estado = (c.estado || "").toLowerCase();
          const esCancelada = estado.includes("anulada") || estado.includes("cancelada");
          const telefonoValido = isTelefonoValido(c.paciente_telefono || "");
          return esCancelada && telefonoValido;
        })
        .filter((c) => {
          const asunto = (c.asunto || "").toUpperCase();
          return !asunto.includes("PILATES");
        });

      // Group by patient phone and count cancellations
      const cancelacionesMap = new Map<string, {
        nombre: string;
        telefono: string;
        numeroPaciente: string;
        cancelaciones: number;
        ultimaCancelacion: Date;
        tienePilates: boolean;
        tieneFisio: boolean;
        detalles: { id: string; fecha: string; tipo: string; asunto: string }[];
      }>();

      citasCanceladas.forEach((cita) => {
        const telefono = (cita.paciente_telefono || "").trim();
        if (!telefono) return;

        const numeroPaciente = extractNumPaciente(cita.asunto) || "";
        const asuntoUpper = (cita.asunto || "").toUpperCase();
        const esPilates = asuntoUpper.includes("PILATES");

        const fechaCita = new Date(cita.fecha_cita);
        const detalle = {
          id: cita.id,
          fecha: cita.fecha_cita,
          tipo: esPilates ? "Pilates" : "Fisioterapia",
          asunto: cita.asunto || ""
        };
        const existing = cancelacionesMap.get(telefono);

        if (!existing) {
          cancelacionesMap.set(telefono, {
            nombre: cita.paciente_nombre || "Sin nombre",
            telefono,
            numeroPaciente,
            cancelaciones: 1,
            ultimaCancelacion: fechaCita,
            tienePilates: esPilates,
            tieneFisio: !esPilates,
            detalles: [detalle],
          });
        } else {
          existing.cancelaciones++;
          existing.detalles.push(detalle);
          if (esPilates) existing.tienePilates = true;
          else existing.tieneFisio = true;
          if (fechaCita > existing.ultimaCancelacion) {
            existing.ultimaCancelacion = fechaCita;
          }
          if (!existing.numeroPaciente && numeroPaciente) {
            existing.numeroPaciente = numeroPaciente;
          }
        }
      });

      // Filter only patients with multiple cancellations (>= 2)
      let pacientesCanceladores: PacienteCancelador[] = Array.from(cancelacionesMap.values())
        .filter((p) => p.cancelaciones >= 2)
        .map((p) => ({
          numero_paciente: p.numeroPaciente,
          paciente_nombre: p.nombre,
          paciente_telefono: p.telefono,
          cancelaciones: p.cancelaciones,
          ultima_cancelacion: p.ultimaCancelacion.toISOString().split("T")[0],
          tipo_cita: (p.tienePilates && p.tieneFisio) ? "Ambos" as const : p.tienePilates ? "Pilates" as const : "Fisioterapia" as const,
          detalles: p.detalles.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
        }))
        .sort((a, b) => b.cancelaciones - a.cancelaciones);

      const totalCount = pacientesCanceladores.length;

      // Paginate
      const startIndex = (page - 1) * pageSize;
      const paginatedPacientes = pacientesCanceladores.slice(startIndex, startIndex + pageSize);

      return {
        pacientes: paginatedPacientes,
        totalCount,
      };
    },
  });
}

export function useDeleteCancellation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("listado_citas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes_canceladores"] });
      queryClient.invalidateQueries({ queryKey: ["cancel_breakdown"] });
    },
  });
}

export function useUpdateCancellation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      fecha_cita, 
      asunto, 
      paciente_nombre,
      anio,
      mes
    }: { 
      id: string; 
      fecha_cita: string; 
      asunto: string; 
      paciente_nombre: string;
      anio: number;
      mes: string;
    }) => {
      const { error } = await supabase
        .from("listado_citas")
        .update({ 
          fecha_cita, 
          asunto, 
          paciente_nombre,
          anio,
          mes
        })
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacientes_canceladores"] });
      queryClient.invalidateQueries({ queryKey: ["cancel_breakdown"] });
    },
  });
}
