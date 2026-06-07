import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Vacacion {
    id: string;
    usuario: string;
    fecha: string;
    tipo: string;
    anio: number;
}

export function useVacaciones(anio: number) {
    return useQuery({
        queryKey: ["vacaciones", anio],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("vacaciones")
                .select("*")
                .eq("anio", anio)
                .order("fecha", { ascending: true });

            if (error) {
                throw error;
            }

            return data as Vacacion[];
        },
    });
}
