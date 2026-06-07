import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  onUploadClick?: () => void;
}

export function EmptyState({ 
  title = "Sin datos disponibles",
  description = "Sube un archivo CSV para comenzar a ver tus métricas.",
  onUploadClick
}: EmptyStateProps) {
  return (
    <div className="kpi-card flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
      </div>
      <h4 className="text-lg font-medium text-foreground mb-2">{title}</h4>
      <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
      {onUploadClick && (
        <Button onClick={onUploadClick} variant="default">
          Importar datos
        </Button>
      )}
    </div>
  );
}
