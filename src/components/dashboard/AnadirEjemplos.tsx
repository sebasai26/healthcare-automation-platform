import React, { useState } from "react";
import { useMarketingGeneracion, MarketingExample } from "@/hooks/useMarketingGeneracion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";

export function AnadirEjemplos() {
    const { examples, addExample, removeExample } = useMarketingGeneracion();

    const [formState, setFormState] = useState<{
        tipo: MarketingExample["tipo"];
        texto: string;
        imagenDataUrl?: string;
        objetivo: MarketingExample["objetivo"];
    }>({
        tipo: "Estado WhatsApp",
        texto: "",
        imagenDataUrl: "",
        objetivo: "Reactivar pacientes"
    });

    const handleAdd = () => {
        if (!formState.texto.trim()) return;
        addExample(formState);
        setFormState({
            tipo: "Estado WhatsApp",
            texto: "",
            imagenDataUrl: "",
            objetivo: "Reactivar pacientes"
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                setFormState(prev => ({ ...prev, imagenDataUrl: dataUrl }));
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-12 w-full max-w-3xl mx-auto">
            <Card className="shadow-sm border-border">
                <CardHeader>
                    <CardTitle className="text-xl">Añadir Ejemplo (Referencia)</CardTitle>
                    <CardDescription>
                        Introduce ejemplos de lo que ya publicas o lo que quieres imitar para que la Inteligencia Artificial aprenda tu estilo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tipo de Contenido</Label>
                        <Select value={formState.tipo} onValueChange={(v: MarketingExample["tipo"]) => setFormState({ ...formState, tipo: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Estado WhatsApp">Estado WhatsApp</SelectItem>
                                <SelectItem value="Historia Instagram">Historia Instagram</SelectItem>
                                <SelectItem value="Publicación Instagram">Publicación (Post / Reel / Carrusel)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Texto del ejemplo</Label>
                        <Textarea
                            placeholder="Ej: ¿Te duele la espalda al levantarte? No lo ignores, tu cuerpo te está avisando. Escríbenos para valorarte."
                            value={formState.texto}
                            onChange={(e) => setFormState({ ...formState, texto: e.target.value })}
                            className="min-h-[100px]"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Añadir foto o Captura (Opcional)</Label>
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="cursor-pointer file:cursor-pointer file:bg-muted file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3 hover:file:bg-muted/80"
                        />
                        {formState.imagenDataUrl && (
                            <div className="mt-2 relative inline-block">
                                <img src={formState.imagenDataUrl} alt="Preview" className="h-20 w-auto rounded-md border border-border/50 shadow-sm" />
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                                    onClick={() => setFormState(prev => ({ ...prev, imagenDataUrl: "" }))}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Objetivo Principal</Label>
                        <Select value={formState.objetivo} onValueChange={(v: MarketingExample["objetivo"]) => setFormState({ ...formState, objetivo: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Reactivar pacientes">Reactivar pacientes (antiguos)</SelectItem>
                                <SelectItem value="Conseguir primeras citas">Conseguir primeras citas</SelectItem>
                                <SelectItem value="Promocionar servicio">Promocionar servicio / técnica</SelectItem>
                                <SelectItem value="Autoridad/confianza">Educar / Autoridad clínica</SelectItem>
                                <SelectItem value="Recordatorio">Recordatorio (Ej: Bebed agua)</SelectItem>
                                <SelectItem value="Otro">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        className="w-full gap-2 mt-4"
                        onClick={handleAdd}
                        disabled={!formState.texto.trim()}
                    >
                        <Plus className="w-4 h-4" /> Guardar Ejemplo
                    </Button>
                </CardContent>
            </Card>

            {examples.length > 0 && (
                <Card className="shadow-sm border-border bg-muted/20">
                    <CardHeader className="py-4">
                        <CardTitle className="text-md flex items-center justify-between">
                            Ejemplos Guardados ({examples.length})
                            {examples.length >= 3 && <span className="text-xs font-normal text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">Ideal para sugerencias</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 divide-y-0">
                                {examples.map(ex => (
                                    <div key={ex.id} className="p-4 group relative bg-background border border-border rounded-lg shadow-sm">
                                        <div className="flex justify-between items-start mb-2 pr-6">
                                            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-sm">
                                                {ex.tipo}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{ex.objetivo}</span>
                                        </div>
                                        <p className="text-sm text-foreground line-clamp-4 mt-1.5 leading-relaxed">{ex.texto}</p>
                                        {ex.imagenDataUrl && (
                                            <div className="mt-3">
                                                <img src={ex.imagenDataUrl} alt="Ejemplo guardado" className="h-20 w-auto rounded border border-border/50 object-cover" />
                                            </div>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/90 bg-destructive/10 hover:bg-destructive/20"
                                            onClick={() => removeExample(ex.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
