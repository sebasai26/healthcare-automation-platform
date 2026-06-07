import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type KPIStatus = "good" | "warning" | "bad" | "neutral";

export interface KPICardProps {
  label: string;
  value?: string | number;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  className?: string;
  // Comparación con media histórica
  secondaryValue?: string;
  secondaryTrend?: number;
  // Invertir colores del trend (útil para cancelaciones donde menos es mejor)
  invertTrend?: boolean;
  // Semáforo de estado
  status?: KPIStatus;
  // Tooltip explicativo
  tooltip?: string;
  // Datos pendientes (periodo en curso sin datos)
  pendingData?: boolean;
}

const statusConfig = {
  good: {
    dotClass: "bg-[hsl(var(--kpi-positive))]",
    borderClass: "border-l-[hsl(var(--kpi-positive))]",
  },
  warning: {
    dotClass: "bg-muted-foreground",
    borderClass: "border-l-muted-foreground",
  },
  bad: {
    dotClass: "bg-muted-foreground",
    borderClass: "border-l-muted-foreground",
  },
  neutral: {
    dotClass: "bg-muted-foreground",
    borderClass: "",
  },
};

export function KPICard({ 
  label, 
  value, 
  trend, 
  trendLabel,
  subtitle,
  className,
  secondaryValue,
  secondaryTrend,
  invertTrend = false,
  status,
  tooltip,
  pendingData = false,
}: KPICardProps) {
  const getTrendIcon = (t: number | undefined) => {
    if (t === undefined || t === 0) return <Minus className="w-4 h-4" />;
    return t > 0 
      ? <TrendingUp className="w-4 h-4" /> 
      : <TrendingDown className="w-4 h-4" />;
  };

  const getTrendClass = (t: number | undefined, invert = false) => {
    if (t === undefined || t === 0) return "text-kpi-neutral";
    const isPositive = invert ? t < 0 : t > 0;
    return isPositive ? "kpi-trend-positive" : "kpi-trend-negative";
  };

  const statusStyle = status ? statusConfig[status] : statusConfig.neutral;

  return (
    <div className={cn(
      "kpi-card animate-fade-in",
      status && status !== "neutral" && "border-l-4",
      statusStyle.borderClass,
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        {status && status !== "neutral" && (
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusStyle.dotClass)} />
        )}
        <p className="kpi-label flex-1">{label}</p>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {pendingData ? (
        <div className="space-y-1">
          <p className="kpi-value text-muted-foreground/60">—</p>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded inline-block">
            Periodo en curso
          </span>
        </div>
      ) : (
        <p className="kpi-value">{value ?? '—'}</p>
      )}
      
      {(trend !== undefined || subtitle) && (
        <div className="mt-3 flex items-center gap-2">
          {trend !== undefined && (
            <span className={cn("flex items-center gap-1 text-sm", getTrendClass(trend, invertTrend))}>
              {getTrendIcon(trend)}
              {Math.abs(trend)}%
              {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
            </span>
          )}
          {subtitle && trend === undefined && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}

      {/* Comparación con media histórica */}
      {secondaryValue && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{secondaryValue}</span>
          {secondaryTrend !== undefined && (
            <span className={cn("flex items-center gap-1 text-xs", getTrendClass(secondaryTrend, invertTrend))}>
              {getTrendIcon(secondaryTrend)}
              {Math.abs(secondaryTrend)}% vs media
            </span>
          )}
        </div>
      )}
    </div>
  );
}
