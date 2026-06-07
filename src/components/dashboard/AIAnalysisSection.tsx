import { useState, useEffect, useMemo } from "react";
import { Brain, Lightbulb, AlertTriangle, Rocket, RefreshCw, ChevronRight, Calendar, ArrowRight, TrendingUp, TrendingDown, Info, ThumbsDown, ThumbsUp, Check } from "lucide-react";
import { useDashboardSummaryOptimized } from "@/hooks/useAlertsOptimized";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useOverviewData } from "@/hooks/useOverviewData";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AIAnalysis {
  diagnostico: string;
  cosas_positivas: string[];
  areas_mejora: string[];
  acciones: {
    titulo: string;
    impacto: string;
    prioridad: "recomendada" | "opcional";
  }[];
  objetivo_mes?: string;
  objetivo_mes_contexto?: string;
  // Legacy fields for backwards compatibility
  problemas?: string[];
  oportunidades?: string[];
}

interface StoredAnalysis {
  id: string;
  semana: number;
  anio: number;
  diagnostico: string;
  cosas_positivas?: string[];
  areas_mejora?: string[];
  problemas?: string[];
  oportunidades?: string[];
  acciones: {
    titulo: string;
    impacto: string;
    prioridad?: "recomendada" | "opcional";
    urgencia?: "alta" | "media" | "baja";
  }[];
  objetivo_mes?: string;
  objetivo_mes_contexto?: string;
  created_at: string;
}

interface AIAnalysisSectionProps {
  // Props removed - data now comes from centralized hook
}

const priorityConfig = {
  recomendada: { bg: "bg-primary/10", text: "text-primary", label: "Recomendada" },
  opcional: { bg: "bg-muted", text: "text-muted-foreground", label: "Opcional" },
};

// Legacy urgency mapping for old analyses
const legacyUrgencyToPriority = {
  alta: "recomendada",
  media: "recomendada", 
  baja: "opcional",
} as const;

// Obtener semana y año actuales (misma numeración que el selector de semanas)
function getCurrentWeekInfo() {
  const now = new Date();
  const anio = now.getFullYear();

  // Find the Monday of the week containing Jan 1 (week 1)
  const jan1 = new Date(anio, 0, 1);
  const jan1Day = jan1.getDay();
  const daysToMonday = jan1Day === 0 ? 6 : jan1Day - 1;

  const week1Monday = new Date(anio, 0, 1 - daysToMonday);
  week1Monday.setHours(0, 0, 0, 0);

  // Current week's Monday
  const nowDay = now.getDay();
  const nowDaysToMonday = nowDay === 0 ? 6 : nowDay - 1;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - nowDaysToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  const diffWeeks = Math.floor(
    (currentMonday.getTime() - week1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return {
    semana: diffWeeks + 1,
    anio,
  };
}

// Formato como el selector: "26/1"
function formatShortDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// Convertir semana y año a rango de fechas usando la misma lógica que el selector de semanas
function getWeekDateRange(weekNum: number, year: number): string {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startDay = 1 - daysToMonday + (weekNum - 1) * 7;
  const weekStart = new Date(year, 0, startDay);
  const weekEnd = new Date(year, 0, startDay + 6);

  return `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
}

export function AIAnalysisSection() {
  const { toast } = useToast();
  const dashboardData = useDashboardSummaryOptimized();
  const { data: overviewData } = useOverviewData();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStored, setIsLoadingStored] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [hasStoredAnalysis, setHasStoredAnalysis] = useState(false);
  const [hasRegeneratedOnce, setHasRegeneratedOnce] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [feedbackSaving, setFeedbackSaving] = useState<string | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState<Set<string>>(new Set());

  const { semana: currentSemana, anio: currentAnio } = getCurrentWeekInfo();
  const [storedSemana, setStoredSemana] = useState<number | null>(null);
  const [storedAnio, setStoredAnio] = useState<number | null>(null);

  // Detectar qué semana tiene datos actualmente (desde useOverviewData)
  const dataWeekInfo = useMemo(() => {
    if (!overviewData?.lastWeekInfo) return null;
    const { startDate } = overviewData.lastWeekInfo;
    
    // Calcular el número de semana de la fecha con datos
    const year = startDate.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const daysToMonday = jan1Day === 0 ? 6 : jan1Day - 1;
    const week1Monday = new Date(year, 0, 1 - daysToMonday);
    week1Monday.setHours(0, 0, 0, 0);
    
    const mondayOfData = new Date(startDate);
    const dayOfWeek = startDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    mondayOfData.setDate(startDate.getDate() - diffToMonday);
    mondayOfData.setHours(0, 0, 0, 0);
    
    const diffWeeks = Math.floor(
      (mondayOfData.getTime() - week1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    
    return {
      semana: diffWeeks + 1,
      anio: year,
      label: overviewData.lastWeekInfo.label,
    };
  }, [overviewData]);

  // Cargar el ÚLTIMO análisis guardado (no necesariamente de la semana actual)
  useEffect(() => {
    const loadStoredAnalysis = async () => {
      setIsLoadingStored(true);
      try {
        // Buscar el análisis más reciente
        const { data, error: fetchError } = await supabase
          .from("analisis_ia")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          const stored = data as unknown as StoredAnalysis;
          // Handle both new and legacy format
          const acciones = (stored.acciones || []).map(a => ({
            titulo: a.titulo,
            impacto: a.impacto,
            prioridad: a.prioridad || (a.urgencia ? legacyUrgencyToPriority[a.urgencia] : "recomendada") as "recomendada" | "opcional",
          }));
          setAnalysis({
            diagnostico: stored.diagnostico || "",
            cosas_positivas: stored.cosas_positivas || [],
            areas_mejora: stored.areas_mejora || [],
            acciones,
            objetivo_mes: stored.objetivo_mes,
            objetivo_mes_contexto: stored.objetivo_mes_contexto,
            // Keep legacy for backwards compat
            problemas: stored.problemas,
            oportunidades: stored.oportunidades,
          });
          setLastGeneratedAt(stored.created_at);
          setStoredSemana(stored.semana);
          setStoredAnio(stored.anio);
          setHasStoredAnalysis(true);
        }
      } catch (err) {
        console.error("Error cargando análisis guardado:", err);
      } finally {
        setIsLoadingStored(false);
      }
    };

    loadStoredAnalysis();
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Calcular la semana siguiente para mostrar en el mensaje
  const nextWeekInfo = useMemo(() => {
    if (!storedSemana || !storedAnio) return null;
    
    // Calcular semana siguiente
    let nextSemana = storedSemana + 1;
    let nextAnio = storedAnio;
    
    // Si pasamos de semana 52, ir al año siguiente
    if (nextSemana > 52) {
      nextSemana = 1;
      nextAnio = storedAnio + 1;
    }
    
    return {
      semana: nextSemana,
      anio: nextAnio,
      range: getWeekDateRange(nextSemana, nextAnio),
    };
  }, [storedSemana, storedAnio]);

  // Verificar si hay datos nuevos disponibles para generar análisis
  const canGenerateNewAnalysis = useMemo(() => {
    if (!dataWeekInfo || !storedSemana || !storedAnio) return true; // Si no hay análisis previo, puede generar
    
    // Puede generar si la semana con datos es posterior a la semana del último análisis
    if (dataWeekInfo.anio > storedAnio) return true;
    if (dataWeekInfo.anio === storedAnio && dataWeekInfo.semana > storedSemana) return true;
    
    return false;
  }, [dataWeekInfo, storedSemana, storedAnio]);

  const generateAnalysis = async (forceRegenerate = false) => {
    // Check cooldown
    if (cooldownSeconds > 0) {
      toast({
        title: "Espera un momento",
        description: `Puedes regenerar en ${cooldownSeconds} segundos.`,
      });
      return;
    }

    if (!dashboardData) {
      toast({
        variant: "destructive",
        title: "Sin datos",
        description: "Primero sube los datos de la semana antes de generar el análisis.",
      });
      return;
    }

    // Si ya hay análisis y no hay datos nuevos, mostrar aviso (excepto si es regeneración forzada)
    if (!forceRegenerate && hasStoredAnalysis && !canGenerateNewAnalysis && nextWeekInfo) {
      toast({
        title: "Análisis ya generado",
        description: `Para generar el análisis de la semana ${nextWeekInfo.semana} (${nextWeekInfo.range}), primero sube los datos de esa semana.`,
        duration: 6000,
      });
      return;
    }

    // Determinar para qué semana generar el análisis (la semana con datos más reciente)
    const targetSemana = dataWeekInfo?.semana || currentSemana;
    const targetAnio = dataWeekInfo?.anio || currentAnio;

    setIsLoading(true);
    setError(null);

    try {
      // Get the current user's session token for proper authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No has iniciado sesión. Por favor, inicia sesión e inténtalo de nuevo.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-dashboard`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ dashboardData }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          // Activar cooldown de 60 segundos para evitar reintentos inmediatos
          setCooldownSeconds(60);
          throw new Error("Límite de solicitudes excedido. Espera 60 segundos.");
        }
        if (response.status === 402) {
          throw new Error("Créditos de IA agotados.");
        }
        throw new Error(errorData.error || "Error al generar análisis");
      }

      const data = await response.json();
      const newAnalysis = data.analysis as AIAnalysis;

      // Guardar en base de datos - usar upsert para actualizar si ya existe
      const { error: upsertError } = await supabase
        .from("analisis_ia")
        .upsert({
          semana: targetSemana,
          anio: targetAnio,
          diagnostico: newAnalysis.diagnostico,
          cosas_positivas: newAnalysis.cosas_positivas || [],
          areas_mejora: newAnalysis.areas_mejora || [],
          problemas: newAnalysis.problemas || [],
          oportunidades: newAnalysis.oportunidades || [],
          acciones: newAnalysis.acciones,
          objetivo_mes: newAnalysis.objetivo_mes || null,
          objetivo_mes_contexto: newAnalysis.objetivo_mes_contexto || null,
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'semana,anio',
        });

      if (upsertError) {
        console.error("Error guardando análisis:", upsertError);
        // Aunque falle el guardado, mostramos el análisis
      }

      setAnalysis(newAnalysis);
      setLastGeneratedAt(new Date().toISOString());
      setStoredSemana(targetSemana);
      setStoredAnio(targetAnio);
      setHasStoredAnalysis(true);
      
      // Si fue regeneración, marcar que ya se usó el intento
      if (forceRegenerate) {
        setHasRegeneratedOnce(true);
      }

      // Iniciar cooldown de 60 segundos
      setCooldownSeconds(60);

      toast({
        title: forceRegenerate ? "Análisis regenerado" : "Análisis generado",
        description: `Análisis de la semana ${targetSemana} (${getWeekDateRange(targetSemana, targetAnio)}) guardado correctamente.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast({
        variant: "destructive",
        title: "Error en análisis",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastGenerated = () => {
    if (!lastGeneratedAt) return null;
    try {
      return format(new Date(lastGeneratedAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
    } catch {
      return null;
    }
  };

  // Función para guardar feedback en el contexto de la clínica
  const saveFeedback = async (suggestion: string, reason: "ya_implementado" | "no_aplica" | "me_gusta") => {
    const feedbackKey = `${suggestion}-${reason}`;
    if (feedbackSaved.has(feedbackKey)) return;
    
    setFeedbackSaving(suggestion);
    try {
      // Obtener el contexto actual
      const { data: configData } = await supabase
        .from("clinic_config")
        .select("value")
        .eq("key", "clinic_context")
        .single();

      const currentContext = configData?.value || "";
      
      // Crear el texto de feedback
      let reasonText = "";
      let feedbackLine = "";
      
      if (reason === "me_gusta") {
        reasonText = "le gusta este tipo de sugerencia";
        feedbackLine = `\n\nFeedback positivo (${format(new Date(), "dd/MM/yyyy")}): "${suggestion}" - ${reasonText}. Seguir sugiriendo cosas similares.`;
      } else {
        reasonText = reason === "ya_implementado" 
          ? "ya está implementado" 
          : "no aplica a la clínica";
        feedbackLine = `\n\nFeedback IA (${format(new Date(), "dd/MM/yyyy")}): "${suggestion}" - ${reasonText}. No volver a sugerir.`;
      }
      
      const newContext = currentContext + feedbackLine;
      
      // Actualizar el contexto
      const { error } = await supabase
        .from("clinic_config")
        .update({ 
          value: newContext,
          updated_at: new Date().toISOString()
        })
        .eq("key", "clinic_context");

      if (error) throw error;

      setFeedbackSaved(prev => new Set(prev).add(feedbackKey));
      toast({
        title: reason === "me_gusta" ? "¡Gracias por tu feedback!" : "Feedback guardado",
        description: reason === "me_gusta" 
          ? "Seguiremos sugiriendo cosas similares." 
          : "Esta sugerencia no volverá a aparecer en futuros análisis.",
      });
    } catch (err) {
      console.error("Error guardando feedback:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el feedback.",
      });
    } finally {
      setFeedbackSaving(null);
    }
  };

  // Estado de carga inicial
  if (isLoadingStored) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Análisis Inteligente Semanal
        </h3>
        <div className="kpi-card">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </section>
    );
  }

  // Generando análisis
  if (isLoading) {
    const targetSemana = dataWeekInfo?.semana || currentSemana;
    const targetAnio = dataWeekInfo?.anio || currentAnio;
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary animate-pulse" />
          Análisis Inteligente Semanal
        </h3>
        <div className="kpi-card">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Generando análisis con IA (semana {targetSemana}: {getWeekDateRange(targetSemana, targetAnio)})...
              </span>
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </section>
    );
  }

  // Error (only show full error UI if no existing analysis)
  if (error && !analysis) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Análisis Inteligente Semanal
        </h3>
        <div className="kpi-card">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-muted-foreground mb-4">{error}</p>
            {cooldownSeconds > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                Puedes reintentar en {cooldownSeconds} segundos
              </p>
            )}
            <Button 
              onClick={() => generateAnalysis()} 
              variant="outline" 
              size="sm"
              disabled={cooldownSeconds > 0}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {cooldownSeconds > 0 ? `Espera ${cooldownSeconds}s` : "Reintentar"}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Sin análisis guardado - mostrar botón para generar
  if (!analysis) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Análisis Inteligente Semanal
        </h3>
        <div className="kpi-card">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="w-10 h-10 text-primary mb-3" />
            <p className="text-lg font-medium text-foreground mb-2">
              Semana {currentSemana}: {getWeekDateRange(currentSemana, currentAnio)}
            </p>
            <p className="text-muted-foreground mb-4 max-w-md">
              No hay análisis generado para esta semana. Sube los datos de la semana y pulsa el botón para generar el análisis.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              📋 Es importante subir los datos de citas de la semana anterior para generar el análisis
            </p>
            <Button onClick={() => generateAnalysis()} variant="default" disabled={!dashboardData}>
              <Brain className="w-4 h-4 mr-2" />
              Generar análisis semanal
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Análisis existente
  return (
    <section className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title flex items-center gap-2 mb-0">
            <Brain className="w-5 h-5 text-primary" />
            Análisis Inteligente Semanal
          </h3>
          {storedSemana && storedAnio && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              Último análisis generado {getWeekDateRange(storedSemana, storedAnio)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasStoredAnalysis && (
            <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">
              ✓ Guardado
            </span>
          )}
          {/* Cooldown indicator */}
          {cooldownSeconds > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Espera {cooldownSeconds}s
            </span>
          )}
          {/* Botón para regenerar análisis de la misma semana (solo 1 vez) */}
          {hasStoredAnalysis && !hasRegeneratedOnce && storedSemana === (dataWeekInfo?.semana || currentSemana) && (
            <Button 
              onClick={() => generateAnalysis(true)} 
              variant="ghost" 
              size="sm"
              className="gap-1 text-muted-foreground hover:text-foreground"
              disabled={cooldownSeconds > 0}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Regenerar análisis</span>
              <span className="sm:hidden">Regenerar</span>
            </Button>
          )}
          <Button 
            onClick={() => generateAnalysis()} 
            variant="outline" 
            size="sm"
            className="gap-1"
            disabled={cooldownSeconds > 0}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            {canGenerateNewAnalysis ? (
              <>Generar semana {dataWeekInfo?.semana || (storedSemana ? storedSemana + 1 : currentSemana)}</>
            ) : (
              <>Siguiente semana</>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Diagnóstico General */}
        <div className="kpi-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <p className="text-base leading-relaxed text-foreground">
            {analysis.diagnostico}
          </p>
        </div>

        {/* Tendencias - Grid mejorado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tendencias Positivas */}
          {analysis.cosas_positivas && analysis.cosas_positivas.length > 0 && (
            <div className="kpi-card border-success/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-success/10">
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <h4 className="font-semibold text-sm">Lo que va bien</h4>
              </div>
              <ul className="space-y-2.5">
                {analysis.cosas_positivas.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-success mt-1.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Áreas de mejora */}
          {analysis.areas_mejora && analysis.areas_mejora.length > 0 && (
            <div className="kpi-card border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <h4 className="font-semibold text-sm">Oportunidades de mejora</h4>
              </div>
              <ul className="space-y-2.5">
                {analysis.areas_mejora.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legacy: Problemas detectados */}
          {(!analysis.cosas_positivas || analysis.cosas_positivas.length === 0) && analysis.problemas && analysis.problemas.length > 0 && (
            <div className="kpi-card">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h4 className="font-semibold text-sm">Aspectos a revisar</h4>
              </div>
              <ul className="space-y-2">
                {analysis.problemas.map((problema, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 flex-shrink-0" />
                    {problema}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legacy: Oportunidades */}
          {(!analysis.areas_mejora || analysis.areas_mejora.length === 0) && analysis.oportunidades && analysis.oportunidades.length > 0 && (
            <div className="kpi-card">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-success" />
                <h4 className="font-semibold text-sm">Oportunidades</h4>
              </div>
              <ul className="space-y-2">
                {analysis.oportunidades.map((oportunidad, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                    {oportunidad}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Acciones Recomendadas - nuevo estilo sin colores alarmistas */}
        {analysis.acciones.length > 0 && (
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Sugerencias</h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="ml-1 p-0.5 rounded-full hover:bg-muted transition-colors">
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-center">
                    <p className="text-xs">
                      Estas son sugerencias generadas por IA basadas en los datos. 
                      <strong className="block mt-1">La decisión final siempre es de la clínica.</strong>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-3">
              {analysis.acciones.map((accion, i) => {
                const priority = priorityConfig[accion.prioridad] || priorityConfig.recomendada;
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border flex items-start gap-3",
                      priority.bg,
                      "border-border/50"
                    )}
                  >
                    <ChevronRight className={cn("w-5 h-5 mt-0.5 flex-shrink-0", priority.text)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-foreground text-sm">
                          {accion.titulo}
                        </p>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          priority.bg,
                          priority.text
                        )}>
                          {priority.label}
                        </span>
                      </div>
                      {accion.impacto && (
                        <p className="text-xs text-muted-foreground">
                          💡 {accion.impacto}
                        </p>
                      )}
                    </div>
                    {/* Botones de feedback */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Botón de me gusta */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-success"
                        disabled={feedbackSaving === accion.titulo || feedbackSaved.has(`${accion.titulo}-me_gusta`)}
                        onClick={() => saveFeedback(accion.titulo, "me_gusta")}
                      >
                        {feedbackSaved.has(`${accion.titulo}-me_gusta`) ? (
                          <ThumbsUp className="w-3.5 h-3.5 text-success fill-success" />
                        ) : (
                          <ThumbsUp className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      {/* Botón de no me sirve */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            disabled={feedbackSaving === accion.titulo || feedbackSaved.has(`${accion.titulo}-ya_implementado`) || feedbackSaved.has(`${accion.titulo}-no_aplica`)}
                          >
                            {feedbackSaving === accion.titulo ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : feedbackSaved.has(`${accion.titulo}-ya_implementado`) || feedbackSaved.has(`${accion.titulo}-no_aplica`) ? (
                              <Check className="w-3.5 h-3.5 text-success" />
                            ) : (
                              <ThumbsDown className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="end">
                          <p className="text-xs text-muted-foreground mb-2">¿Por qué no te sirve?</p>
                          <div className="space-y-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start text-xs h-8"
                              onClick={() => saveFeedback(accion.titulo, "ya_implementado")}
                            >
                              Ya lo tenemos implementado
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full justify-start text-xs h-8"
                              onClick={() => saveFeedback(accion.titulo, "no_aplica")}
                            >
                              No aplica a nuestra clínica
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
