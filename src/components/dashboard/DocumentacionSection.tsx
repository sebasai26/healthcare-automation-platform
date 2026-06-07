import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Lightbulb,
  Sparkles,
  ThumbsUp,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

export function DocumentacionSection() {
  const [aiUsageOpen, setAiUsageOpen] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Documentación</h2>
        <p className="text-muted-foreground">Guía de uso y mejores prácticas para el uso de la app.</p>
      </div>

      {/* Entrenamiento de la IA */}
      <Collapsible open={aiUsageOpen} onOpenChange={setAiUsageOpen}>
        <Card>
          <CollapsibleTrigger className="w-full text-left">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold text-lg text-foreground">Entrenamiento y Refinamiento de la IA</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${aiUsageOpen ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pb-8 pt-0">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4 p-5 bg-muted/30 rounded-xl border border-border/40">
                  <div className="p-2 rounded-lg bg-muted/10 shrink-0 mt-0.5">
                    <ThumbsUp className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Votación Estratégica</h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Utiliza los botones de voto en cada análisis. La IA procesa estos votos para entender qué tipo de estrategias prefieres y descartar aquellas que no encajan con tu modelo de negocio.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-5 bg-muted/30 rounded-xl border border-border/40">
                  <div className="p-2 rounded-lg bg-muted/10 shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Notificación de Incoherencias</h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Si la IA comete un error lógico o inventa un dato, marca la sugerencia como no útil. Esto ayuda a recalibrar los filtros de veracidad del sistema para futuros análisis.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Note about uploads */}
      <Card className="border-dashed border-2 bg-transparent">
        <CardContent className="p-4 flex items-center justify-center gap-3">
          <Lightbulb className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong>Nota Técnica:</strong> Los detalles sobre los informes exactos a exportar y formatos de archivo se encuentran detallados directamente en la sección de <strong>"Importar Datos"</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
