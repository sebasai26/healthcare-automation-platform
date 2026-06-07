import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserX, Phone, Repeat } from "lucide-react";
import { CancelacionesTab } from "./CancelacionesTab";
import { RecaptacionTab } from "./RecaptacionTab";
import { RecurrentesTab } from "./RecurrentesTab";

export function PatientsSection() {
  const [activeTab, setActiveTab] = useState("cancelaciones");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="cancelaciones" className="flex items-center gap-2">
            <UserX className="w-4 h-4" />
            <span>Cancelaciones</span>
          </TabsTrigger>
          <TabsTrigger value="recaptacion" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>Recaptación</span>
          </TabsTrigger>
          <TabsTrigger value="recurrentes" className="flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            <span>Recurrentes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cancelaciones">
          <CancelacionesTab />
        </TabsContent>
        <TabsContent value="recaptacion">
          <RecaptacionTab />
        </TabsContent>
        <TabsContent value="recurrentes">
          <RecurrentesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
