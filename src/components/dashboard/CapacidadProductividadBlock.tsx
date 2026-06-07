import React, { useState, useCallback } from "react";
import {
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Target,
  CheckCircle2,
  TrendingUp,
  HelpCircle,
  Plus,
  Trash2,
  Calendar,
  Info,
} from "lucide-react";
import { useCapacidadProductividad, CapacidadConfig, PhysioConfig } from "@/hooks/useCapacidadProductividad";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Props {
  year: number;
  month: number;
}

export function CapacidadProductividadBlock({ year, month }: Props) {
  const {
    config,
    capacidadMaxima,
    capacidadHastaHoy,
    sesionesRealizadas,
    sesionesPotencialesDiarias,
    productividad,
    productividadHastaHoy,
    semanasDelMes,
    diasLaboralesTotales,
    diasLaboralesTranscurridos,
    desglosePorFisio,
    isLoading,
    isConfigLoading,
    saveConfig,
    isSaving,
  } = useCapacidadProductividad(year, month);

  const [showConfig, setShowConfig] = useState(false);

  if (isLoading || isConfigLoading) {
    return (
      <div className="kpi-card animate-fade-in mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="py-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getBarColor = (p: number) => {
    if (p >= 80) return "bg-blue-600";
    if (p >= 60) return "bg-blue-500";
    return "bg-blue-400";
  };

  return (
    <div className="kpi-card animate-fade-in mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground">Capacidad y Productividad</h4>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>
                Compara la capacidad máxima teórica de sesiones individuales (excluyendo Pilates, Superinductiva y Presoterapia)
                con las sesiones realmente realizadas, teniendo en cuenta vacaciones y cobertura de Pilates.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Configurar variables</span>
          {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Main metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-border/40">
        {/* Capacity */}
        <div className="px-3 py-2 first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
            <Target className="w-3 h-3" />
            Capacidad Máxima
          </p>
          <p className="text-xl font-bold text-foreground">{capacidadMaxima}</p>
          <p className="text-[10px] text-muted-foreground">
            {semanasDelMes} sem · {sesionesPotencialesDiarias} ses/día
          </p>
        </div>

        {/* Actual Sessions */}
        <div className="px-3 py-2 first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Sesiones Realizadas
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-muted-foreground/60 hover:text-primary transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px] text-[11px]">
                Los datos de Citas realizadas se actualizan cuando se sube el Listado de citas cada lunes, por lo que puede que el porcentaje solo sea exacto en el momento de la subida.
              </TooltipContent>
            </Tooltip>
          </p>
          <p className="text-xl font-bold text-foreground">{sesionesRealizadas}</p>
          <p className="text-[10px] text-muted-foreground">
            de {capacidadHastaHoy} posibles · {diasLaboralesTranscurridos} de {diasLaboralesTotales} días laborables
          </p>
        </div>

        {/* Productivity: Up to today */}
        <div className="px-3 py-2 first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Productividad (hasta hoy)
          </p>
          <p className="text-xl font-bold text-foreground">{productividadHastaHoy}%</p>
          <p className="text-[10px] text-muted-foreground">
            {sesionesRealizadas} de {capacidadHastaHoy} posibles
          </p>
        </div>

        {/* Productivity: Full month */}
        <div className="px-3 py-2 first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Productividad (mes)
          </p>
          <p className="text-xl font-bold text-foreground">{productividad}%</p>
          <p className="text-[10px] text-muted-foreground">
            {sesionesRealizadas} de {capacidadMaxima} posibles
          </p>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Hasta hoy · {diasLaboralesTranscurridos} días laborables</span>
            <span className="font-semibold text-foreground">{productividadHastaHoy}%</span>
          </div>
          <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${getBarColor(productividadHastaHoy)}`}
              style={{ width: `${Math.min(productividadHastaHoy, 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Mes completo · {capacidadMaxima} sesiones</span>
            <span className="font-semibold text-foreground">{productividad}%</span>
          </div>
          <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${getBarColor(productividad)}`}
              style={{ width: `${Math.min(productividad, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Desglose por fisio */}
      {desglosePorFisio.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">Desglose por profesional</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-border/30">
            {desglosePorFisio.map(f => (
              <div key={f.name} className="text-center px-2 py-1.5">
                <p className="text-[11px] font-semibold text-foreground truncate">{f.name}</p>
                <p className="text-base font-bold text-foreground">{f.capacidadFinal}</p>
                <p className="text-[10px] text-muted-foreground">{f.sesionesSemanales}/sem</p>
                {f.diasVacacionesMes > 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Vacaciones: −{f.sesionesPerdidasVacaciones} ({f.diasVacacionesMes}d)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      {showConfig && (
        <ConfigPanel
          config={config}
          semanasDelMes={semanasDelMes}
          onSave={saveConfig}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}

// =================== CONFIG PANEL ===================

function ConfigPanel({
  config,
  semanasDelMes,
  onSave,
  isSaving,
}: {
  config: CapacidadConfig;
  semanasDelMes: number;
  onSave: (c: CapacidadConfig) => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [editConfig, setEditConfig] = useState<CapacidadConfig>(JSON.parse(JSON.stringify(config)));

  const updateFisio = useCallback((index: number, field: keyof PhysioConfig, value: any) => {
    setEditConfig(prev => {
      const next = { ...prev, fisios: [...prev.fisios] };
      next.fisios[index] = { ...next.fisios[index], [field]: value };
      return next;
    });
  }, []);

  const addFisio = useCallback(() => {
    setEditConfig(prev => ({
      ...prev,
      fisios: [
        ...prev.fisios,
        {
          name: "Nueva Fisio",
          horasSemanales: 0,
          horasComida: 0,
          horasPilatesTotal: 0,
          pilatesDetalle: {},
        },
      ],
    }));
  }, []);

  const removeFisio = useCallback((index: number) => {
    setEditConfig(prev => ({
      ...prev,
      fisios: prev.fisios.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSave = () => {
    onSave(editConfig);
    toast({
      title: "Configuración guardada",
      description: "Los valores de capacidad se han actualizado correctamente.",
    });
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/40 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          Configurar Variables
        </h5>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Duración sesión:
          </span>
          <Input
            type="number"
            className="w-16 h-7 text-xs text-center"
            value={editConfig.duracionSesionMinutos}
            onChange={e => setEditConfig(prev => ({ ...prev, duracionSesionMinutos: parseInt(e.target.value) || 50 }))}
            min={1}
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs">Nombre</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Horas/sem</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Comida</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Pilates</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Netas</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Sesiones/sem</th>
              <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Sesiones/mes</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {editConfig.fisios.map((fisio, idx) => {
              const netas = fisio.horasSemanales - fisio.horasComida - fisio.horasPilatesTotal;
              const sesionesSem = (netas * 60) / editConfig.duracionSesionMinutos;
              const sesionesMes = Math.round(sesionesSem * semanasDelMes);

              return (
                <tr key={idx} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-2">
                    <Input
                      className="h-7 text-xs w-28"
                      value={fisio.name}
                      onChange={e => updateFisio(idx, "name", e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Input
                      type="number"
                      className="h-7 text-xs w-14 text-center mx-auto"
                      value={fisio.horasSemanales}
                      onChange={e => updateFisio(idx, "horasSemanales", parseFloat(e.target.value) || 0)}
                      min={0}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Input
                      type="number"
                      className="h-7 text-xs w-14 text-center mx-auto"
                      value={fisio.horasComida}
                      onChange={e => updateFisio(idx, "horasComida", parseFloat(e.target.value) || 0)}
                      min={0}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Input
                      type="number"
                      className="h-7 text-xs w-14 text-center mx-auto"
                      value={fisio.horasPilatesTotal}
                      onChange={e => updateFisio(idx, "horasPilatesTotal", parseFloat(e.target.value) || 0)}
                      min={0}
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs font-semibold ${netas > 0 ? "text-foreground" : "text-red-500"}`}>
                      {netas}h
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-semibold text-foreground">
                      {Math.round(sesionesSem * 10) / 10}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-bold text-foreground">
                      {sesionesMes}
                    </span>
                  </td>
                  <td className="py-2 px-1">
                    <button
                      onClick={() => removeFisio(idx)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                      title="Eliminar fisioterapeuta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-semibold">
              <td className="py-2 px-2 text-xs text-foreground">Total</td>
              <td className="py-2 px-2 text-center text-xs">
                {editConfig.fisios.reduce((s, f) => s + f.horasSemanales, 0)}h
              </td>
              <td className="py-2 px-2 text-center text-xs">
                {editConfig.fisios.reduce((s, f) => s + f.horasComida, 0)}h
              </td>
              <td className="py-2 px-2 text-center text-xs">
                {editConfig.fisios.reduce((s, f) => s + f.horasPilatesTotal, 0)}h
              </td>
              <td className="py-2 px-2 text-center text-xs font-bold">
                {editConfig.fisios.reduce((s, f) => s + (f.horasSemanales - f.horasComida - f.horasPilatesTotal), 0)}h
              </td>
              <td className="py-2 px-2 text-center text-xs font-bold">
                {Math.round(editConfig.fisios.reduce((s, f) => {
                  const n = f.horasSemanales - f.horasComida - f.horasPilatesTotal;
                  return s + (n * 60) / editConfig.duracionSesionMinutos;
                }, 0) * 10) / 10}
              </td>
              <td className="py-2 px-2 text-center text-xs font-bold">
                {Math.round(editConfig.fisios.reduce((s, f) => {
                  const n = f.horasSemanales - f.horasComida - f.horasPilatesTotal;
                  return s + ((n * 60) / editConfig.duracionSesionMinutos) * semanasDelMes;
                }, 0))}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addFisio} className="text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Añadir Fisio
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-xs gap-1.5">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar Configuración
        </Button>
      </div>

      {/* Calculation explanation */}
      <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground mb-1">Cómo se calcula:</p>
        <p>1. <strong>Horas netas</strong> = Horas semanales − Comida − Pilates</p>
        <p>2. <strong>Sesiones/semana</strong> = (Horas netas × 60) ÷ {editConfig.duracionSesionMinutos} min</p>
        <p>3. <strong>Capacidad mensual</strong> = Sesiones/semana × {semanasDelMes} semanas del mes</p>
        <p>4. <strong>Vacaciones</strong>: Se restan sesiones proporcionales por cada día de ausencia</p>
        <p>5. <strong>Cobertura Pilates</strong>: Si alguien cubre Pilates de otra fisio de vacaciones, pierde esas horas de fisio</p>
        <p>6. <strong>Productividad</strong> = (Sesiones realizadas ÷ Capacidad) × 100</p>
        <p className="mt-2 text-[10px]">
          Las sesiones reales excluyen: Pilates, Superinductiva, Presoterapia, placeholders (bloqueados, sin agenda)
        </p>
      </div>
    </div>
  );
}
