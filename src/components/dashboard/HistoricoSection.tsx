import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Star, Bell } from "lucide-react";
import { ActivitySection } from "./ActivitySection";
import { ServicesSection } from "./ServicesSection";
import { RecordatoriosSection } from "./RecordatoriosSection";

export function HistoricoSection() {
  const [activeTab, setActiveTab] = useState("activity");

  return (
    <section className="animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Citas y Servicios
        </h2>
        <p className="text-muted-foreground">
          Métricas de citas, datos de servicios y recordatorios de cita
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Citas</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">Servicios</span>
          </TabsTrigger>
          <TabsTrigger value="recordatorios" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Recordatorios de Cita</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <ActivitySection />
        </TabsContent>
        <TabsContent value="services">
          <ServicesSection />
        </TabsContent>
        <TabsContent value="recordatorios">
          <RecordatoriosSection />
        </TabsContent>
      </Tabs>
    </section>
  );
}
