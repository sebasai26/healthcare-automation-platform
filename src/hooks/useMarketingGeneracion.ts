import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingExample {
    id: string;
    tipo: "Estado WhatsApp" | "Historia Instagram" | "Publicación Instagram";
    texto: string;
    imagenDataUrl?: string; // Stored as Base64 JPEG to use inlineData
    objetivo: "Reactivar pacientes" | "Conseguir primeras citas" | "Promocionar servicio" | "Autoridad/confianza" | "Recordatorio" | "Otro";
    fechaCreacion: string;
}

export interface MarketingIdea {
    id: string;
    titulo: string;
    formato?: string;
    objetivo?: string;
    content?: {
        copywriting: {
            whatsapp: string[];
            historias: string[];
            publicaciones: string[];
            google?: string[];
        };
        hooks: string[];
        llamadas_accion: string[];
        ideas_visuales: string[];
    };
}

export interface MarketingSuggestion {
    id: string;
    fechaGeneracion: string;
    nuevas_ideas: MarketingIdea[];
}

export interface ContentFeedback {
    id: string;
    texto: string;
    tipo: 'idea' | 'copy' | 'hook' | 'cta';
    isPositive: boolean;
    fecha: string;
}

export function useMarketingGeneracion() {
    const { toast } = useToast();
    const [examples, setExamples] = useState<MarketingExample[]>([]);
    const [lastSuggestion, setLastSuggestion] = useState<MarketingSuggestion | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingContentFor, setIsGeneratingContentFor] = useState<string | null>(null);
    const [feedbacks, setFeedbacks] = useState<ContentFeedback[]>([]);

    // Initialize from LocalStorage
    useEffect(() => {
        const storedExamples = localStorage.getItem("marketing_examples");
        const storedSuggestion = localStorage.getItem("marketing_last_suggestion");
        const storedFeedbacks = localStorage.getItem("marketing_feedbacks");

        if (storedExamples) {
            try { setExamples(JSON.parse(storedExamples)); } catch (e) { console.error("Error parsing examples", e); }
        }

        if (storedSuggestion) {
            try { setLastSuggestion(JSON.parse(storedSuggestion)); } catch (e) { console.error("Error parsing last suggestion", e); }
        }

        if (storedFeedbacks) {
            try { setFeedbacks(JSON.parse(storedFeedbacks)); } catch (e) { console.error("Error parsing feedbacks", e); }
        }
    }, []);

    const addExample = (example: Omit<MarketingExample, "id" | "fechaCreacion">) => {
        const newExample: MarketingExample = {
            ...example,
            id: crypto.randomUUID(),
            fechaCreacion: new Date().toISOString()
        };
        const updatedExamples = [newExample, ...examples];
        setExamples(updatedExamples);
        localStorage.setItem("marketing_examples", JSON.stringify(updatedExamples));
        toast({ title: "Ejemplo guardado" });
    };

    const removeExample = (id: string) => {
        const updatedExamples = examples.filter(e => e.id !== id);
        setExamples(updatedExamples);
        localStorage.setItem("marketing_examples", JSON.stringify(updatedExamples));
    };

    const toggleFeedback = (id: string, texto: string, tipo: ContentFeedback['tipo'], isPositive: boolean) => {
        setFeedbacks(prev => {
            const existing = prev.find(f => f.id === id);
            let updated: ContentFeedback[];

            if (existing && existing.isPositive === isPositive) {
                updated = prev.filter(f => f.id !== id);
            } else if (existing) {
                updated = prev.map(f => f.id === id ? { ...f, isPositive } : f);
            } else {
                updated = [...prev, { id, texto, tipo, isPositive, fecha: new Date().toISOString() }];
            }

            localStorage.setItem("marketing_feedbacks", JSON.stringify(updated));
            return updated;
        });
    };

    const generateSuggestions = async (specificContent?: string, destino?: string) => {

        if (examples.length === 0) {
            toast({ title: "Añade al menos un ejemplo", variant: "destructive", description: "Necesito ejemplos para inspirarme." });
            return;
        }

        setIsGenerating(true);

        try {
            type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
            const parts: GeminiPart[] = [];

            // 1. System Prompt
            let systemPrompt = `
            Actúa como estratega de marketing especializado en clínicas de fisioterapia.
            Analiza los ejemplos de contenido y propón 4 NUEVAS IDEAS de contenido relacionadas, sin redactar todavía los posts finales.
            `;

            if (specificContent && specificContent.trim() !== '') {
                systemPrompt += `\nIMPORTANTE: El usuario ha solicitado ideas específicamente enfocadas en: "${specificContent}". Por favor, adapta las 4 ideas a esta temática o solicitud concreta.\n`;
            } else {
                systemPrompt += `\nGenera 4 ideas variadas, proporcionando opciones y ejemplos diversos para distintos propósitos (educativo, promocional, etc).\n`;
            }

            if (destino === 'Google') {
                systemPrompt += `
                IMPORTANTE: Este contenido es específicamente para la sección "Novedades" de la ficha de Google My Business. 
                Actúa como el responsable de comunicación de *MarbellaFisio*. Tu objetivo es redactar contenido profesional sanitario, empático, directo y experto. PROHIBIDO usar frases genéricas de IA como 'En el corazón de Marbella', 'Estamos aquí para ayudarte' o 'Descubre un mundo de bienestar'. Usa un lenguaje clínico pero comprensible. Focus on:
                1. Pilates Suelo. 2. Lesiones Musculoesqueléticas. 3. Neuro-rehabilitación adultos. 4. Suelo Pélvico.
                Genera las ideas teniendo este enfoque.
                `;
            } else {
                systemPrompt += `
                IMPORTANTE: La clínica NO publica en el feed clásico de Instagram ni en el muro de Facebook. NO sugieras formatos como "Posts" o "Carruseles".
                Concéntrate EXCLUSIVAMENTE en formatos para Estados de WhatsApp o Historias de Instagram/Facebook.
                `;
            }

            const positiveFeedbacks = feedbacks.filter(f => f.isPositive);
            const negativeFeedbacks = feedbacks.filter(f => !f.isPositive);

            if (positiveFeedbacks.length > 0) {
                systemPrompt += `\nLO QUE LE GUSTA A LA CLÍNICA (Sigue este estilo):\n`;
                positiveFeedbacks.forEach(f => systemPrompt += `- [${f.tipo}] "${f.texto}"\n`);
            }
            if (negativeFeedbacks.length > 0) {
                systemPrompt += `\nLO QUE NO LE GUSTA A LA CLÍNICA (Evita esto por completo):\n`;
                negativeFeedbacks.forEach(f => systemPrompt += `- [${f.tipo}] "${f.texto}"\n`);
            }

            systemPrompt += `\nCONTEXTO:\nEjemplos proporcionados:\n`;
            examples.forEach((e, i) => {
                systemPrompt += `\nEjemplo ${i + 1}:\n- Tipo: ${e.tipo}\n- Objetivo: ${e.objetivo}\n- Texto: "${e.texto}"\n`;
            });

            systemPrompt += `
            INSTRUCCIONES DE SALIDA:
            Debes devolver JSON estricto:
            {
                "nuevas_ideas": [
                    { "titulo": "..." }
                ]
            }
            `;

            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-consejos', {
                body: { prompt: systemPrompt, temperature: 0.7 }
            });

            if (edgeError) throw edgeError;
            const textContent = edgeData?.content;
            if (!textContent) throw new Error("Respuesta vacía o formato inválido de la API.");

            const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            const jsonExtracted = jsonMatch ? jsonMatch[0] : textContent;
            const parsed = JSON.parse(jsonExtracted);

            const suggestion: MarketingSuggestion = {
                id: crypto.randomUUID(),
                fechaGeneracion: new Date().toISOString(),
                nuevas_ideas: (parsed.nuevas_ideas || []).map((idea: Omit<MarketingIdea, 'id'>) => ({
                    ...idea,
                    id: crypto.randomUUID()
                }))
            };

            setLastSuggestion(suggestion);
            localStorage.setItem("marketing_last_suggestion", JSON.stringify(suggestion));
            toast({ title: "¡Te presento nuevas ideas!" });

        } catch (error: unknown) {
            console.error("Gemini API Error:", error);
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            toast({ title: "Error en la generación", description: errorMessage, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const generateContentForIdea = async (ideaId: string, idea: MarketingIdea, destino: string = 'WhatsApp') => {
        if (!lastSuggestion) return;

        setIsGeneratingContentFor(ideaId);

        try {
            let systemPrompt = `
            Eres un copywriter clínico. Basado en la siguiente idea, redacta ejemplos listos para publicar según el destino indicado.
            `;

            if (destino === 'Google') {
                systemPrompt += `
                DESTINO: Ficha de Google (Novedades)
                REGLAS:
                - Tono: Profesional sanitario, empático, directo y experto. PROHIBIDO usar frases genéricas de IA como 'En el corazón de Marbella', 'Estamos aquí para ayudarte' o 'Descubre un mundo de bienestar'.
                - Redacta una pregunta que un paciente real nos haría y una respuesta detallada (también en inglés si encaja).
                - La respuesta debe mencionar la patología específica y el beneficio real.
                - Incluye términos locales naturales (ej. 'nuestra clínica cerca de la cañada', 'pacientes en San Pedro o Marbella').
                - Tres reglas de oro:
                  1. Habla de "Nosotros": Usa "En nuestro equipo...", "Vemos a diario en la clínica...".
                  2. Especificidad Médica: En lugar de "te ayudamos con tu dolor", usa "trabajamos la movilidad articular del hombro".
                  3. Localización natural: Menciona el aparcamiento o cercanía a un punto de Marbella.
                `;
            } else if (destino === 'Instagram') {
                systemPrompt += `
                DESTINO: Historias de Instagram
                IMPORTANTE: Genera ÚNICAMENTE contenido para Historias de Instagram.
                - REGLA ESTRICTA: NO incluyas hashtags en las historias.
                `;
            } else {
                systemPrompt += `
                DESTINO: Estados de WhatsApp
                IMPORTANTE: Genera ÚNICAMENTE contenido para Estados de WhatsApp.
                - REGLA ESTRICTA: NO incluyas hashtags en los estados de WhatsApp.
                `;
            }

            systemPrompt += `
            IDEA SELECCIONADA:
            - Título: ${idea.titulo}
            `;

            const positiveFeedbacks = feedbacks.filter(f => f.isPositive);
            if (positiveFeedbacks.length > 0) {
                systemPrompt += `\nTONO PREFERIDO DE COPYS PASADOS:\n`;
                positiveFeedbacks.forEach(f => systemPrompt += `- "${f.texto}"\n`);
            }

            systemPrompt += `
            INSTRUCCIONES DE SALIDA (JSON ESTRICTO):
            {
                "copywriting": {
                    "whatsapp": ["(Mensaje para los Estados de WhatsApp si aplica) texto 1..."],
                    "historias": ["(Slide 1 si aplica) texto 1..."],
                    "google": ["(Publicación para Google Novedades si aplica) texto 1..."],
                    "publicaciones": [] 
                },
                "hooks": ["Gancho 1..."],
                "llamadas_accion": ["cta1..."],
                "ideas_visuales": ["Ideas visuales..."]
            }
            NOTA: Mantén los arrays vacíos si el contenido no aplica al DESTINO solicitado. (Ej: si es Google, llena solo 'google').
            `;

            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ai-consejos', {
                body: { prompt: systemPrompt, temperature: 0.7 }
            });

            if (edgeError) throw edgeError;
            const textContent = edgeData?.content;
            if (!textContent) throw new Error("Respuesta vacía");

            const jsonMatch = textContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            const jsonExtracted = jsonMatch ? jsonMatch[0] : textContent;
            const parsed = JSON.parse(jsonExtracted);

            const updatedSuggestion = { ...lastSuggestion };
            const ideaIndex = updatedSuggestion.nuevas_ideas.findIndex(i => i.id === ideaId);

            if (ideaIndex !== -1) {
                updatedSuggestion.nuevas_ideas[ideaIndex] = {
                    ...updatedSuggestion.nuevas_ideas[ideaIndex],
                    content: {
                        copywriting: parsed.copywriting || { whatsapp: [], historias: [], publicaciones: [], google: [] },
                        hooks: parsed.hooks || [],
                        llamadas_accion: parsed.llamadas_accion || [],
                        ideas_visuales: parsed.ideas_visuales || []
                    }
                };
            }

            setLastSuggestion(updatedSuggestion);
            localStorage.setItem("marketing_last_suggestion", JSON.stringify(updatedSuggestion));
            toast({ title: "Contenido generado para la idea" });

        } catch (error: unknown) {
            console.error(error);
            toast({ title: "Error en la generación", description: "No se pudo generar el contenido", variant: "destructive" });
        } finally {
            setIsGeneratingContentFor(null);
        }
    };

    return {
        examples,
        lastSuggestion,
        isGenerating,
        isGeneratingContentFor,
        feedbacks,
        addExample,
        removeExample,
        generateSuggestions,
        generateContentForIdea,
        toggleFeedback
    };
}
