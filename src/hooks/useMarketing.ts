import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampanaMarketing {
    id: string;
    nombre: string;
    tipo: string;
    canal: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    coste_unitario_promocion: number;
    promociones_realizadas: number;
    sesiones_pagadas: number;
    precio_cita: number;
    estado: string;
    notas: string | null;
    created_at: string;
}

export type CampanaMarketingInput = Omit<CampanaMarketing, "id" | "created_at">;

export function useCampanas() {
    return useQuery({
        queryKey: ["campanas_marketing"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("campanas_marketing")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                throw error;
            }

            // Fetch count from campana_cumpleanos to update the specific campaign
            const { count: cumpleanosCount, error: countError } = await supabase
                .from("campana_cumpleanos")
                .select("*", { count: "exact", head: true });

            // Fetch count from campana_cumpleanos_descuento for the new campaign
            // Using <any, any> because the local types haven't been regenerated yet
            const { count: descuentoCount, error: descuentoError } = await supabase
                .from<any, any>("campana_cumpleanos_descuento")
                .select("*", { count: "exact", head: true });

            let updatedData = data as any[];

            if (data) {
                updatedData = data.map(campana => {
                    if (campana.nombre === "Cumpleaños – Sesión gratis de presoterapia 20 min" && !countError && cumpleanosCount !== null) {
                        return {
                            ...campana,
                            promociones_realizadas: cumpleanosCount
                        };
                    }
                    if (campana.nombre === "Cumpleaños-10% Descuento" && !descuentoError && descuentoCount !== null) {
                        return {
                            ...campana,
                            promociones_realizadas: descuentoCount
                        };
                    }
                    return campana;
                });
            }

            return updatedData as CampanaMarketing[];
        },
    });
}

export function useMutateCampana() {
    const queryClient = useQueryClient();

    const insertMutation = useMutation({
        mutationFn: async (nuevaCampana: CampanaMarketingInput) => {
            const { data, error } = await supabase
                .from("campanas_marketing")
                .insert(nuevaCampana)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campanas_marketing"] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<CampanaMarketingInput> }) => {
            const { data, error } = await supabase
                .from("campanas_marketing")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["campanas_marketing"] });
        },
    });

    return {
        insertCampana: insertMutation.mutateAsync,
        updateCampana: updateMutation.mutateAsync,
        isInserting: insertMutation.isPending,
        isUpdating: updateMutation.isPending,
    };
}
