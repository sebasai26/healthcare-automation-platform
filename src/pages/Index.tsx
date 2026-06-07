import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { Header } from "@/components/dashboard/Header";
import { UploadSection } from "@/components/dashboard/UploadSection";
import { AlertsSection } from "@/components/dashboard/AlertsSection";
import { AIConsejosSection } from "@/components/dashboard/AIConsejosSection";
import { HistoricoSection } from "@/components/dashboard/HistoricoSection";
import { DefaultKPIView } from "@/components/dashboard/DefaultKPIView";
import { DocumentacionSection } from "@/components/dashboard/DocumentacionSection";
import { PacientesControlSection } from "@/components/dashboard/PacientesControlSection";
import { ContabilidadSection } from "@/components/dashboard/ContabilidadSection";
import { AnalisisEquipoSection } from "@/components/dashboard/AnalisisEquipoSection";
import { MarketingSection } from "@/components/dashboard/MarketingSection";

const Index = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case "documentacion":
        return <DocumentacionSection />;
      case "pacientes":
        return <PacientesControlSection />;
      case "historico":
        return <HistoricoSection />;
      case "contabilidad":
        return <ContabilidadSection />;
      case "equipo":
        return <AnalisisEquipoSection />;
      case "marketing":
        return <MarketingSection />;
      case "aiconsejos":
        return <AIConsejosSection />;
      case "upload":
        return <UploadSection />;
      case "overview":
      default:
        return (
          <div className="space-y-8">
            <DefaultKPIView />
            <AlertsSection compact />
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header activeSection={activeSection} onSectionChange={setActiveSection} />

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
