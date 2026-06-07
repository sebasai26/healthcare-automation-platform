import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useAlertsOptimized, Alert } from "@/hooks/useAlertsOptimized";
import { useOverviewData } from "@/hooks/useOverviewData";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AlertsSectionProps {
  compact?: boolean;
}

interface MonthlyObjective {
  id: string;
  mes: number;
  anio: number;
  objetivo: string;
  contexto: string | null;
  tendencia_negativa_principal: string | null;
}

const alertConfig = {
  critical: {
    icon: TrendingDown,
    bgClass: "bg-gradient-to-br from-muted/50 via-muted/30 to-transparent",
    borderClass: "border-l-4 border-l-muted-foreground/40 border-y border-r border-border/50",
    iconBgClass: "bg-muted",
    iconClass: "text-muted-foreground",
    labelClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
    arrowIcon: ArrowDownRight,
  },
  warning: {
    icon: AlertCircle,
    bgClass: "bg-gradient-to-br from-muted/50 via-muted/30 to-transparent",
    borderClass: "border-l-4 border-l-muted-foreground/40 border-y border-r border-border/50",
    iconBgClass: "bg-muted",
    iconClass: "text-muted-foreground",
    labelClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
    arrowIcon: ArrowDownRight,
  },
  info: {
    icon: Info,
    bgClass: "bg-gradient-to-br from-muted/50 via-muted/30 to-transparent",
    borderClass: "border-l-4 border-l-muted-foreground/30 border-y border-r border-border/50",
    iconBgClass: "bg-muted",
    iconClass: "text-muted-foreground",
    labelClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
    arrowIcon: ArrowDownRight,
  },
  success: {
    icon: TrendingUp,
    bgClass: "bg-gradient-to-br from-success/8 via-success/4 to-transparent",
    borderClass: "border-l-4 border-l-success/60 border-y border-r border-success/15",
    iconBgClass: "bg-success/15",
    iconClass: "text-success",
    labelClass: "text-success",
    dotClass: "bg-success",
    arrowIcon: ArrowUpRight,
  },
};

function AlertCard({ alert }: { alert: Alert }) {
  const config = alertConfig[alert.type];
  const Icon = config.icon;
  const ArrowIcon = config.arrowIcon;
  const isPositive = alert.type === "success";

  return (
    <div className={cn("p-4 rounded-xl transition-all hover:shadow-lg group", config.bgClass, config.borderClass)}>
      <div className="flex items-start gap-4">
        <div className={cn("p-2.5 rounded-xl shrink-0", config.iconBgClass)}>
          <Icon className={cn("w-5 h-5", config.iconClass)} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-base text-foreground">{alert.title}</h4>
            {alert.metric && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full",
                  isPositive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                <ArrowIcon className="w-3.5 h-3.5" />
                {alert.metric}
              </span>
            )}
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">{alert.description}</p>

          {alert.impact && (
            <div className="flex items-center gap-2 pt-1">
              <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
              <span className={cn("text-base font-medium", config.labelClass)}>{alert.impact}</span>
            </div>
          )}

          {alert.action && (
            <div className="pt-2 flex items-center gap-1.5 text-base text-primary/80 group-hover:text-primary transition-colors">
              <ChevronRight className="w-4 h-4" />
              <span className="font-medium">{alert.action}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertsSection({ compact = false }: AlertsSectionProps) {
  const { toast } = useToast();
  const { alerts, isLoading, criticalCount, warningCount, successCount } = useAlertsOptimized();
  const { data: overviewData } = useOverviewData();
  const [monthlyObjective, setMonthlyObjective] = useState<MonthlyObjective | null>(null);
  const [isLoadingObjective, setIsLoadingObjective] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Load monthly objective
  useEffect(() => {
    const loadObjective = async () => {
      try {
        const { data, error } = await supabase
          .from("objetivo_mensual")
          .select("*")
          .eq("mes", currentMonth)
          .eq("anio", currentYear)
          .maybeSingle();

        if (!error && data) {
          setMonthlyObjective(data as MonthlyObjective);
        }
      } catch (err) {
        console.error("Error loading objective:", err);
      } finally {
        setIsLoadingObjective(false);
      }
    };

    loadObjective();
  }, [currentMonth, currentYear]);

  // Prepare trends data for generating objective
  const trendsData = useMemo(() => {
    if (!overviewData) return null;

    const { previous: month1, previous2: month2, previous3: month3 } = overviewData;

    // Primero buscar tendencias críticas/warning
    let negativeTrends = alerts
      .filter((a) => a.type === "critical" || a.type === "warning")
      .map((a) => a.title + ": " + a.description)
      .slice(0, 3);

    // Si no hay críticas/warning, usar las informativas (ocupación, capacidad, etc.)
    if (negativeTrends.length === 0) {
      negativeTrends = alerts
        .filter((a) => a.type === "info")
        .map((a) => a.title + ": " + a.description)
        .slice(0, 3);
    }

    return {
      month1: {
        name: month1.monthName,
        revenue: month1.totalRevenue,
        appointments: month1.citasRealizadas,
        newPatients: month1.nuevosPacientes,
        cancellations: month1.citasCanceladas,
      },
      month2: {
        name: month2.monthName,
        revenue: month2.totalRevenue,
        appointments: month2.citasRealizadas,
        newPatients: month2.nuevosPacientes,
        cancellations: month2.citasCanceladas,
      },
      month3: {
        name: month3.monthName,
        revenue: month3.totalRevenue,
        appointments: month3.citasRealizadas,
        newPatients: month3.nuevosPacientes,
        cancellations: month3.citasCanceladas,
      },
      negativeTrends,
      currentMonth,
      currentYear,
    };
  }, [overviewData, alerts, currentMonth, currentYear]);

  const generateObjective = async () => {
    if (!trendsData || trendsData.negativeTrends.length === 0) {
      toast({
        title: "Sin tendencias negativas",
        description: "No hay tendencias negativas detectadas para generar un objetivo.",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No has iniciado sesión");
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-monthly-objective`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ trends: trendsData }),
      });

      if (!response.ok) {
        throw new Error("Error generando objetivo");
      }

      const data = await response.json();

      setMonthlyObjective({
        id: "",
        mes: currentMonth,
        anio: currentYear,
        objetivo: data.objective.objetivo,
        contexto: data.objective.contexto,
        tendencia_negativa_principal: data.objective.tendencia_principal,
      });

      toast({
        title: "Objetivo generado",
        description: "El objetivo del mes ha sido creado correctamente.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Incluir también alertas de tipo "info" que indican áreas de mejora
  const hasNegativeTrends = alerts.some((a) => a.type === "critical" || a.type === "warning" || a.type === "info");

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title flex items-center gap-2 mb-0">
            <TrendingUp className="w-5 h-5 text-primary" />
            Tendencias Observadas
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  // Lista de tendencias posibles para el tooltip
  const possibleTrends = [
    { type: "success", name: "Captación de pacientes en alza", condition: "Nuevos pacientes suben 2 meses seguidos" },
    { type: "success", name: "Ingresos en crecimiento", condition: "Ingresos suben 2 meses seguidos" },
    { type: "success", name: "Cancelaciones a la baja", condition: "Cancelaciones bajan 2 meses seguidos" },
    { type: "success", name: "Citas realizadas al alza", condition: "Citas suben 2 meses seguidos" },
    {
      type: "success",
      name: "Estabilidad operativa",
      condition: "Variaciones <10% en ingresos, citas y cancelaciones",
    },
    {
      type: "critical",
      name: "Captación de pacientes en descenso",
      condition: "Nuevos pacientes bajan 2 meses seguidos",
    },
    { type: "critical", name: "Ingresos con tendencia a la baja", condition: "Ingresos bajan 2 meses seguidos" },
    { type: "critical", name: "Citas realizadas a la baja", condition: "Citas bajan 2 meses seguidos" },
  ];

  if (alerts.length === 0) {
    return (
      <section className="animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="section-title flex items-center gap-2 mb-0">
              <TrendingUp className="w-5 h-5 text-success" />
              Tendencias Observadas
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm p-4">
                <p className="font-semibold mb-2">Tendencias que se detectan:</p>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-success">Positivas:</p>
                  <ul className="space-y-1 ml-2">
                    {possibleTrends
                      .filter((t) => t.type === "success")
                      .map((t, i) => (
                        <li key={i} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{t.name}</span>
                          <br />
                          <span className="text-xs">{t.condition}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="font-medium text-destructive mt-3">A mejorar:</p>
                  <ul className="space-y-1 ml-2">
                    {possibleTrends
                      .filter((t) => t.type === "critical")
                      .map((t, i) => (
                        <li key={i} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{t.name}</span>
                          <br />
                          <span className="text-xs">{t.condition}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="kpi-card bg-gradient-to-br from-success/10 to-success/5 border-success/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-success/20">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">¡Todo marcha bien!</p>
              <p className="text-sm text-muted-foreground">
                No hemos detectado tendencias significativas en los últimos 3 meses. Pulsa el icono{" "}
                <Info className="w-3 h-3 inline" /> para ver qué tendencias monitorizamos.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const displayAlerts = compact ? alerts.slice(0, 3) : alerts;
  const monthName = new Date().toLocaleDateString("es-ES", { month: "long" });

  return (
    <section className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title flex items-center gap-2 mb-0">
          <TrendingUp className="w-5 h-5 text-primary" />
          Tendencias Observadas
        </h3>
        <div className="flex items-center gap-2">
          {successCount > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  {successCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {successCount} tendencia{successCount !== 1 ? "s" : ""} positiva{successCount !== 1 ? "s" : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          {criticalCount > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                  <TrendingDown className="w-3 h-3" />
                  {criticalCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {criticalCount} tendencia{criticalCount !== 1 ? "s" : ""} a mejorar
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          {warningCount > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {warningCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{warningCount} a observar</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Objetivo del Mes - Siempre visible con opción de generar */}
      <div className="mb-5">
        {isLoadingObjective ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : monthlyObjective ? (
          <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-amber-100/30 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                    Objetivo de {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                  </h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={generateObjective}
                        disabled={isGenerating || !hasNegativeTrends}
                        className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100/80 dark:hover:bg-amber-900/40"
                      >
                        {isGenerating ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Regenerar objetivo</TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-base text-foreground leading-relaxed">{monthlyObjective.objetivo}</p>
                {monthlyObjective.contexto && (
                  <p className="text-sm text-amber-700/70 dark:text-amber-300/60 mt-3 italic border-t border-amber-200/50 dark:border-amber-700/30 pt-3">
                    {monthlyObjective.contexto}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : hasNegativeTrends ? (
          <div className="p-5 rounded-xl border-2 border-dashed border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/30">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Objetivo de {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">Genera un objetivo mensual basado en las tendencias</p>
                </div>
              </div>
              <Button
                onClick={generateObjective}
                disabled={isGenerating}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar objetivo
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {displayAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>

      {compact && alerts.length > 3 && (
        <p className="text-sm text-muted-foreground text-center mt-4">+{alerts.length - 3} tendencias más</p>
      )}
    </section>
  );
}
