import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, List } from "lucide-react";
import { PatientsSection } from "./PatientsSection";
import { ListaPacientesTab } from "./ListaPacientesTab";

export function PacientesControlSection() {
  const [activeTab, setActiveTab] = useState("seguimiento");

  return (
    <section className="animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Control de Pacientes
        </h2>
        <p className="text-muted-foreground">
          Seguimiento de cancelaciones, recaptación y demografía de pacientes
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="seguimiento" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span>Métricas de Pacientes</span>
          </TabsTrigger>
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            <span>Segmentador de Pacientes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seguimiento">
          <PatientsSection />
        </TabsContent>
        <TabsContent value="lista">
          <ListaPacientesTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
