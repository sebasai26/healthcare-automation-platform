import React, { useState } from "react";
import { useMarketingGeneracion } from "@/hooks/useMarketingGeneracion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, Sparkles, Image as ImageIcon, MessageCircle, Copy, Info, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function GeneracionIdeas() {
    const { toast } = useToast();
    const [contentType, setContentType] = useState("");
    const [destino, setDestino] = useState("WhatsApp");
    const { examples, lastSuggestion, isGenerating, isGeneratingContentFor, feedbacks, generateSuggestions, generateContentForIdea, toggleFeedback } = useMarketingGeneracion();

    const handleCopy = (text: string, titleStr: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "¡Copiado!", description: `${titleStr} se ha copiado al portapapeles.` });
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in pb-12 max-w-5xl mx-auto">

            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-3">
                <div className="space-y-1">
                    <Label htmlFor="content-type" className="text-sm font-medium">¿De qué te gustaría que fueran las ideas hoy? (Opcional)</Label>
                    <p className="text-xs text-muted-foreground">Ej: Estado de WhatsApp para deportistas, historia enfocada en dolor de espalda, etc. Si lo dejas vacío generaremos ideas variadas.</p>
                </div>
                <Input 
                    id="content-type"
                    placeholder="Escribe un tema o formato específico (Ej. Promoción de verano, Consejos posturología...)"
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="bg-background"
                />
                <div className="space-y-1 mt-4">
                    <Label htmlFor="destino-type" className="text-sm font-medium">¿Para qué plataforma quieres generar contenido?</Label>
                </div>
                <Select value={destino} onValueChange={setDestino}>
                    <SelectTrigger id="destino-type" className="w-full bg-background">
                        <SelectValue placeholder="Selecciona un destino" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="WhatsApp">Estados de WhatsApp</SelectItem>
                        <SelectItem value="Instagram">Historias de Instagram</SelectItem>
                        <SelectItem value="Google">Ficha de Google (Novedades)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button
                size="lg"
                className="w-full py-8 text-lg gap-3 shadow-lg hover:shadow-xl transition-all font-semibold bg-gradient-to-r from-primary to-primary/80"
                onClick={() => generateSuggestions(contentType, destino)}
                disabled={examples.length === 0 || isGenerating}
            >
                {isGenerating ? (
                    <>
                        <Sparkles className="w-6 h-6 animate-pulse" />
                        Generando ideas basadas en tus ejemplos...
                    </>
                ) : (
                    <>
                        <Lightbulb className="w-6 h-6" />
                        Generar Ideas y Sugerencias de Marketing
                    </>
                )}
            </Button>

            {examples.length === 0 && !lastSuggestion && (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/10">
                    <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                    <h3 className="font-medium text-foreground mb-1 text-lg">Añade ejemplos primero</h3>
                    <p className="text-sm max-w-[350px]">El generador aprenderá del tono y estilo de los ejemplos que guardes en la pestaña "Añadir Ejemplos".</p>
                </div>
            )}

            {lastSuggestion && !isGenerating && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in-0">
                    <div className="flex items-center gap-2 text-primary font-medium text-lg border-b border-border pb-2">
                        <Sparkles className="w-5 h-5 fill-primary/20" />
                        <span>Ideas Generadas para tu Clínica</span>
                    </div>

                    <div className="flex gap-2 items-start p-4 bg-primary/5 rounded-lg text-primary text-sm border border-primary/20">
                        <Info className="w-6 h-6 shrink-0 mt-0.5" />
                        <p><strong>Truco:</strong> Haz clic en "Generar Ejemplos" en la idea que más te guste para crear opciones de copys completas y utilizables en esa red social. Utiliza los botones de <ThumbsUp className="inline w-3 h-3 mx-1" /> y <ThumbsDown className="inline w-3 h-3 mx-1" /> para enseñar al sistema tus preferencias de comunicación.</p>
                    </div>

                    {/* Nuevas ideas de contenido */}
                    <div className="space-y-4">
                        {lastSuggestion.nuevas_ideas.map((idea, i) => {
                            const isGeneratingThis = isGeneratingContentFor === idea.id;
                            const ideaFeedback = feedbacks.find(f => f.id === idea.id);

                            return (
                                <Card key={idea.id} className="shadow-sm border-primary/20 overflow-hidden">
                                    <div className="p-4 md:p-6 bg-primary/5 border-b border-border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-start md:items-center gap-2 flex-col md:flex-row">
                                                <h4 className="font-bold text-foreground text-lg leading-tight">{i + 1}. {idea.titulo}</h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto w-full md:w-auto mt-2 md:mt-0">
                                            <div className="flex bg-background rounded-md border border-border/50 p-1 shadow-sm">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 rounded-sm transition-colors ${ideaFeedback?.isPositive === true ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40' : 'text-muted-foreground hover:bg-muted'}`}
                                                    onClick={() => toggleFeedback(idea.id, `Título: ${idea.titulo}`, 'idea', true)}
                                                    title="Me gusta esta idea"
                                                >
                                                    <ThumbsUp className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 rounded-sm transition-colors ${ideaFeedback?.isPositive === false ? 'text-rose-600 bg-rose-100 dark:bg-rose-900/40' : 'text-muted-foreground hover:bg-muted'}`}
                                                    onClick={() => toggleFeedback(idea.id, `Título: ${idea.titulo}`, 'idea', false)}
                                                    title="No me gusta esta idea"
                                                >
                                                    <ThumbsDown className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            {!idea.content && (
                                                <Button
                                                    size="default"
                                                    className="flex-1 md:flex-none"
                                                    disabled={isGeneratingThis || isGeneratingContentFor !== null}
                                                    onClick={() => generateContentForIdea(idea.id, idea, destino)}
                                                >
                                                    {isGeneratingThis ? <Sparkles className="w-4 h-4 mr-2 animate-pulse" /> : <Lightbulb className="w-4 h-4 mr-2" />}
                                                    {isGeneratingThis ? "Creando textos..." : "Generar Ejemplos"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contenido Generado para la Idea */}
                                    {idea.content && (
                                        <div className="p-4 md:p-6 space-y-8 bg-card border-t border-border">
                                            {/* Copywriting */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {idea.content.copywriting.whatsapp.length > 0 && (
                                                    <div className="space-y-4">
                                                        <span className="text-sm font-semibold uppercase text-emerald-600 tracking-wider flex items-center gap-1.5 border-b border-emerald-100 dark:border-emerald-900 pb-2"><MessageCircle className="w-4 h-4" /> Estados de WhatsApp</span>
                                                        <div className="space-y-3">
                                                            {idea.content.copywriting.whatsapp.map((copy, cIdx) => {
                                                                const copyId = `${idea.id}-wa-${cIdx}`;
                                                                const fb = feedbacks.find(f => f.id === copyId);
                                                                return (
                                                                    <div key={copyId} className="relative group p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-md border border-emerald-100 dark:border-emerald-900/50 hover:shadow-sm transition-all focus-within:shadow-sm">
                                                                        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-10 text-foreground/90">{copy}</p>
                                                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm px-1 py-1 rounded-md border border-border/50 shadow-sm">
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === true ? 'text-emerald-600 bg-emerald-100' : 'text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', true)}>
                                                                                <ThumbsUp className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === false ? 'text-rose-600 bg-rose-100' : 'text-muted-foreground hover:bg-rose-100 hover:text-rose-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', false)}>
                                                                                <ThumbsDown className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <div className="w-px h-4 bg-border mx-1"></div>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700" onClick={() => handleCopy(copy, "El estado de WhatsApp")}>
                                                                                <Copy className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {idea.content.copywriting.historias.length > 0 && (
                                                    <div className="space-y-4">
                                                        <span className="text-sm font-semibold uppercase text-fuchsia-600 tracking-wider flex items-center gap-1.5 border-b border-fuchsia-100 dark:border-fuchsia-900 pb-2"><ImageIcon className="w-4 h-4" /> Historias</span>
                                                        <div className="space-y-3">
                                                            {idea.content.copywriting.historias.map((copy, cIdx) => {
                                                                const copyId = `${idea.id}-ig-${cIdx}`;
                                                                const fb = feedbacks.find(f => f.id === copyId);
                                                                return (
                                                                    <div key={copyId} className="relative group p-4 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 rounded-md border border-fuchsia-100 dark:border-fuchsia-900/50 hover:shadow-sm transition-all focus-within:shadow-sm">
                                                                        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-10 text-foreground/90">{copy}</p>
                                                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm px-1 py-1 rounded-md border border-border/50 shadow-sm">
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === true ? 'text-fuchsia-600 bg-fuchsia-100' : 'text-muted-foreground hover:bg-fuchsia-100 hover:text-fuchsia-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', true)}>
                                                                                <ThumbsUp className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === false ? 'text-rose-600 bg-rose-100' : 'text-muted-foreground hover:bg-rose-100 hover:text-rose-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', false)}>
                                                                                <ThumbsDown className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <div className="w-px h-4 bg-border mx-1"></div>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-fuchsia-100 hover:text-fuchsia-700" onClick={() => handleCopy(copy, "La historia")}>
                                                                                <Copy className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {idea.content.copywriting.publicaciones.length > 0 && (
                                                    <div className="space-y-4">
                                                        <span className="text-sm font-semibold uppercase text-blue-600 tracking-wider border-b border-blue-100 dark:border-blue-900 pb-2 block">Posts / Carruseles</span>
                                                        <div className="space-y-3">
                                                            {idea.content.copywriting.publicaciones.map((copy, cIdx) => {
                                                                const copyId = `${idea.id}-post-${cIdx}`;
                                                                const fb = feedbacks.find(f => f.id === copyId);
                                                                return (
                                                                    <div key={copyId} className="relative group p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-md border border-blue-100 dark:border-blue-900/50 hover:shadow-sm transition-all focus-within:shadow-sm">
                                                                        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-10 text-foreground/90">{copy}</p>
                                                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm px-1 py-1 rounded-md border border-border/50 shadow-sm">
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === true ? 'text-blue-600 bg-blue-100' : 'text-muted-foreground hover:bg-blue-100 hover:text-blue-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', true)}>
                                                                                <ThumbsUp className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === false ? 'text-rose-600 bg-rose-100' : 'text-muted-foreground hover:bg-rose-100 hover:text-rose-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', false)}>
                                                                                <ThumbsDown className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <div className="w-px h-4 bg-border mx-1"></div>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-blue-100 hover:text-blue-700" onClick={() => handleCopy(copy, "El post")}>
                                                                                <Copy className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {idea.content.copywriting.google && idea.content.copywriting.google.length > 0 && (
                                                    <div className="space-y-4">
                                                        <span className="text-sm font-semibold uppercase text-orange-600 tracking-wider flex items-center gap-1.5 border-b border-orange-100 dark:border-orange-900 pb-2"><MessageCircle className="w-4 h-4" /> Ficha de Google</span>
                                                        <div className="space-y-3">
                                                            {idea.content.copywriting.google.map((copy, cIdx) => {
                                                                const copyId = `${idea.id}-go-${cIdx}`;
                                                                const fb = feedbacks.find(f => f.id === copyId);
                                                                return (
                                                                    <div key={copyId} className="relative group p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-md border border-orange-100 dark:border-orange-900/50 hover:shadow-sm transition-all focus-within:shadow-sm">
                                                                        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-10 text-foreground/90">{copy}</p>
                                                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm px-1 py-1 rounded-md border border-border/50 shadow-sm">
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === true ? 'text-orange-600 bg-orange-100' : 'text-muted-foreground hover:bg-orange-100 hover:text-orange-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', true)}>
                                                                                <ThumbsUp className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${fb?.isPositive === false ? 'text-rose-600 bg-rose-100' : 'text-muted-foreground hover:bg-rose-100 hover:text-rose-700'}`} onClick={() => toggleFeedback(copyId, copy, 'copy', false)}>
                                                                                <ThumbsDown className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                            <div className="w-px h-4 bg-border mx-1"></div>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-orange-100 hover:text-orange-700" onClick={() => handleCopy(copy, "La ficha de Google")}>
                                                                                <Copy className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {destino !== 'Google' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-border/60">
                                                {/* Hooks e Ideas Visuales */}
                                                <div>
                                                    <span className="text-sm font-semibold uppercase text-amber-600 tracking-wider mb-4 block flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Ganchos Sugeridos</span>
                                                    <ul className="space-y-3">
                                                        {idea.content.hooks.slice(0, 4).map((hook, hIdx) => (
                                                            <li key={hIdx} className="text-sm bg-muted/40 p-3 rounded-lg border border-border/50 text-foreground/90 flex justify-between items-start gap-4 group hover:border-border transition-colors">
                                                                <span className="leading-relaxed">{hook}</span>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground bg-background hover:bg-amber-100 hover:text-amber-700 border border-border/50 shadow-sm" onClick={() => handleCopy(hook, "El gancho")}>
                                                                    <Copy className="w-3 h-3" />
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold uppercase text-primary/80 tracking-wider mb-4 block flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Ideas Visuales / Tomas</span>
                                                    <ul className="space-y-3">
                                                        {idea.content.ideas_visuales.slice(0, 4).map((vis, vIdx) => (
                                                            <li key={vIdx} className="flex gap-3 text-sm text-muted-foreground items-start bg-muted/20 p-3 rounded-lg border border-transparent">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                                                                <span className="leading-relaxed font-medium">{vis}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
