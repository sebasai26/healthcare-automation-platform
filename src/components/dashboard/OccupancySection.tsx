import { Activity } from "lucide-react";
import { useOcupacionEquipo } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";

interface PhysioOccupancy {
  name: string;
  occupancy: number;
  totalAppointments: number;
}

interface OccupancySectionProps {
  data?: PhysioOccupancy[];
}

export function OccupancySection({ data }: OccupancySectionProps) {
  const { data: dbData, isLoading, error } = useOcupacionEquipo();
  const getOccupancyColor = (occupancy: number) => {
    if (occupancy >= 80) return "bg-success";
    if (occupancy >= 60) return "bg-primary";
    return "bg-warning";
  };

  const displayData = data || dbData || [];

  if (isLoading) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Ocupación del Equipo
        </h3>
        <div className="kpi-card">
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || displayData.length === 0) {
    return (
      <section className="animate-slide-up">
        <h3 className="section-title flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Ocupación del Equipo
        </h3>
        <div className="kpi-card">
          <p className="text-muted-foreground text-center py-8">
            {error ? "Error cargando datos" : "Sin datos de ocupación. Sube un CSV para comenzar."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-slide-up">
      <h3 className="section-title flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        Ocupación del Equipo
      </h3>

      <div className="kpi-card">
        <div className="space-y-6">
          {displayData.map((physio) => (
            <div key={physio.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground">{physio.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {physio.totalAppointments} citas
                  </span>
                  <span className="font-semibold text-foreground w-12 text-right">
                    {Math.round(physio.occupancy)}%
                  </span>
                </div>
              </div>
              <div className="progress-bar">
                <div 
                  className={`progress-bar-fill ${getOccupancyColor(physio.occupancy)}`}
                  style={{ width: `${physio.occupancy}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
