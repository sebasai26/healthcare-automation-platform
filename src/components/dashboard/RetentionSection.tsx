import { Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InactivePatient {
  id: string;
  name: string;
  lastVisit: string;
  daysInactive: number;
}

interface RetentionData {
  totalInactive: number;
  inactivePatients: InactivePatient[];
}

interface RetentionSectionProps {
  data?: RetentionData;
}

const mockData: RetentionData = {
  totalInactive: 23,
  inactivePatients: [
    { id: "P001", name: "Carlos Ruiz", lastVisit: "15 Nov 2024", daysInactive: 45 },
    { id: "P002", name: "Laura Fernández", lastVisit: "20 Nov 2024", daysInactive: 40 },
    { id: "P003", name: "Miguel Torres", lastVisit: "25 Nov 2024", daysInactive: 35 },
    { id: "P004", name: "Elena Vázquez", lastVisit: "28 Nov 2024", daysInactive: 32 },
    { id: "P005", name: "Roberto Díaz", lastVisit: "29 Nov 2024", daysInactive: 31 },
  ],
};

export function RetentionSection({ data = mockData }: RetentionSectionProps) {
  return (
    <section className="animate-slide-up">
      <h3 className="section-title flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Retención y Reactivación
      </h3>

      <div className="kpi-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="kpi-label">Pacientes Inactivos (+30 días)</p>
            <p className="kpi-value text-warning">{data.totalInactive}</p>
          </div>
          <Button variant="default" className="bg-primary hover:bg-primary/90">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Pacientes a recaptar
          </Button>
        </div>
      </div>

      <div className="kpi-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Paciente
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                ID
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Última visita
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                Días sin venir
              </th>
            </tr>
          </thead>
          <tbody>
            {data.inactivePatients.map((patient) => (
              <tr 
                key={patient.id} 
                className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-foreground">
                  {patient.name}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {patient.id}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {patient.lastVisit}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="px-2 py-1 bg-warning-muted text-warning rounded-md text-sm font-medium">
                    {patient.daysInactive} días
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
