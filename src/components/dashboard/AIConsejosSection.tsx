import React, { useState } from "react";
import { useAIConsejos, AIConsejosTopic, AIConsejosResponse, AISpecificConsejo } from "@/hooks/useAIConsejos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, Calendar, Users, Wallet, RefreshCw, ChevronRight, TrendingUp, Sparkles, Target, ThumbsUp, ThumbsDown, MessageSquareMore, UserCheck, Megaphone, Activity, Info, FileText, Search, Save, Trash, Bookmark, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const sectionTopics: { id: AIConsejosTopic; label: string; icon: React.ElementType; description: string }[] = [
    { id: "citas", label: "Citas y Servicios", icon: Calendar, description: "Rendimiento y agenda." },
    { id: "pacientes", label: "Control de Pacientes", icon: Users, description: "Fidelidad y recurrencia." },
    { id: "contabilidad", label: "Contabilidad y Beneficios", icon: Wallet, description: "Facturación y márgenes." },
    { id: "equipo", label: "Análisis de Equipo", icon: UserCheck, description: "Productividad y ocupación." },
    { id: "marketing", label: "Marketing y Nuevas Campañas", icon: Megaphone, description: "WhatsApp y cross-selling." },
];

export function AIConsejosSection() {
    const { 
        isGenerating, analysisResult, currentDataContext, generateConsejos, 
        savedSuggestions, saveSuggestion, deleteSavedSuggestion,
        isGeneratingSpecific, specificConsejos, lastCustomTopic, generateSpecificConsejos, 
        generateActionDetail, rateSpecificConsejo, rateAction 
    } = useAIConsejos();
    const initialTopic = (localStorage.getItem("ai_consejos_topic") as AIConsejosTopic) || "citas";
    const [selectedTopic, setSelectedTopic] = useState<AIConsejosTopic>(initialTopic);
    const [customTopicInput, setCustomTopicInput] = useState<string>(lastCustomTopic);
    const [actionDetails, setActionDetails] = useState<Record<number, { text: string; loading: boolean }>>({});

    const [periodType, setPeriodType] = useState<'month' | 'week'>('month');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        return monthNames[new Date().getMonth()];
    });
    const [selectedWeek, setSelectedWeek] = useState<number>(10); // Valor por defecto
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const handleGenerate = () => {
        generateConsejos(selectedTopic, {
            type: periodType,
            month: selectedMonth,
            week: selectedWeek,
            year: selectedYear
        });
    };

    const handleGenerateSpecific = () => {
        generateSpecificConsejos(customTopicInput);
    };

    const handleDeepDive = async (index: number, title: string) => {
        if (actionDetails[index]?.text) return;
        
        setActionDetails(prev => ({ ...prev, [index]: { text: "", loading: true } }));
        const detail = await generateActionDetail(title, analysisResult?.diagnostico || "", currentDataContext);
        setActionDetails(prev => ({ ...prev, [index]: { text: detail, loading: false } }));
    };

    const monthsShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    const getWeekRange = (week: number, year: number) => {
        const d = new Date(year, 0, 1);
        const day = d.getDay();
        const diff = (day <= 4 ? 1 - day : 8 - day);
        const startOfWeek1 = new Date(year, 0, 1 + diff);
        
        const monday = new Date(startOfWeek1);
        monday.setDate(startOfWeek1.getDate() + (week - 1) * 7);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        return `${monday.getDate()} ${monthsShort[monday.getMonth()]} - ${sunday.getDate()} ${monthsShort[sunday.getMonth()]}`;
    };

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];

    const weekOptions = Array.from({ length: 52 }, (_, i) => ({
        value: i + 1,
        label: `S${i + 1}: ${getWeekRange(i + 1, selectedYear)}`
    }));

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in pb-16 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-foreground/70" />
                    <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
                        Análisis y Consejos con IA
                    </h1>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                    Análisis avanzado de datos operativos para la detección de oportunidades y optimización de rendimiento clínico.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <Tabs defaultValue="analisis" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 max-w-xl mb-8">
                            <TabsTrigger value="analisis" className="text-[10px] font-bold uppercase tracking-widest">
                                Análisis de Secciones
                            </TabsTrigger>
                            <TabsTrigger value="especificos" className="text-[10px] font-bold uppercase tracking-widest">
                                Casos Específicos
                            </TabsTrigger>
                            <TabsTrigger value="guardados" className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                <Bookmark className="w-3 h-3" />
                                Sugerencias Guardadas
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="analisis" className="space-y-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {sectionTopics.map((t) => (
                                    <Card 
                                        key={t.id} 
                                        className={cn(
                                            "cursor-pointer transition-all duration-200 border bg-card shadow-none",
                                            selectedTopic === t.id 
                                                ? "border-primary bg-primary/5" 
                                                : "hover:border-primary/30"
                                        )}
                                        onClick={() => setSelectedTopic(t.id)}
                                    >
                                        <CardHeader className="p-3 space-y-2">
                                            <div className={cn("p-1.5 w-fit rounded", selectedTopic === t.id ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                <t.icon className="w-4 h-4" />
                                            </div>
                                            <CardTitle className="text-[10px] font-black uppercase tracking-tighter leading-none">
                                                {t.label}
                                            </CardTitle>
                                            <CardDescription className="text-[10px] leading-tight line-clamp-2">
                                                {t.description}
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4 p-6 border border-border/50 bg-muted/5 rounded-none">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest">Periodo de Análisis</h3>
                                </div>
                                
                                <div className="flex flex-wrap gap-4 items-end">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] uppercase font-bold text-muted-foreground">Tipo</label>
                                        <div className="flex border border-border h-9">
                                            <button 
                                                onClick={() => setPeriodType('month')}
                                                className={cn("px-4 text-[10px] font-bold uppercase tracking-widest transition-all", periodType === 'month' ? "bg-primary text-white" : "hover:bg-muted")}
                                            >
                                                Mes
                                            </button>
                                            <button 
                                                onClick={() => setPeriodType('week')}
                                                className={cn("px-4 text-[10px] font-bold uppercase tracking-widest transition-all", periodType === 'week' ? "bg-primary text-white" : "hover:bg-muted")}
                                            >
                                                Semana
                                            </button>
                                        </div>
                                    </div>

                                    {periodType === 'month' ? (
                                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Mes</label>
                                            <select 
                                                value={selectedMonth}
                                                onChange={(e) => setSelectedMonth(e.target.value)}
                                                className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                {["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Seleccionar semana</label>
                                            <select 
                                                value={selectedWeek}
                                                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                                                className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                {weekOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-1.5 min-w-[100px]">
                                        <label className="text-[9px] uppercase font-bold text-muted-foreground">Año</label>
                                        <select 
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <Button 
                                            onClick={handleGenerate} 
                                            disabled={isGenerating}
                                            className="h-9 px-8 rounded-none bg-primary hover:bg-primary/90 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                                    Analizando...
                                                </>
                                            ) : (
                                                "Generar Análisis"
                                            )}
                                        </Button>
                                        <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest font-bold">Límite: 1 análisis / día</span>
                                    </div>
                                </div>
                            </div>

                            {analysisResult && (
                                <div className="mt-12 space-y-12 animate-in slide-in-from-bottom-4 duration-700">
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80 border-l-2 border-primary pl-3">
                                                Diagnóstico Estratégico
                                            </h2>
                                        </div>
                                        <div className="p-8 border border-border/40 bg-card/50 rounded-none shadow-sm min-h-[150px] relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                            <p className="text-sm leading-relaxed text-foreground/90 font-medium font-serif first-letter:text-3xl first-letter:font-black first-letter:mr-2">
                                                {analysisResult.diagnostico}
                                            </p>
                                        </div>
                                    </section>

                                    <section className="space-y-8">
                                        <div className="flex items-center gap-3 mb-6">
                                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80 border-l-2 border-primary pl-3">
                                                Acciones Recomendadas
                                            </h2>
                                        </div>
                                        <div className="grid grid-cols-1 gap-6">
                                            {analysisResult.acciones?.map((action, i) => (
                                                <Card key={action.id || i} className="rounded-none border-border/40 shadow-none hover:border-primary/40 transition-colors group">
                                                    <CardHeader className="p-6 space-y-4">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex flex-col gap-2">
                                                                <Badge className={cn(
                                                                    "text-[9px] uppercase font-black px-1.5 py-0 rounded-none w-fit shadow-none border-none",
                                                                    action.prioridad === 'urgente' ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                                                                )}>
                                                                    {action.prioridad === 'urgente' ? 'Inmediato' : 'Recomendado'}
                                                                </Badge>
                                                                <CardTitle className="text-lg font-black leading-tight">
                                                                    {action.titulo}
                                                                </CardTitle>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-2">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Valorar Acción</span>
                                                                <div className="flex items-center gap-1">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <button
                                                                            key={star}
                                                                            onClick={() => rateAction(action.id, star)}
                                                                            className="focus:outline-none transition-transform hover:scale-125 active:scale-95"
                                                                        >
                                                                            <Star 
                                                                                className={cn(
                                                                                    "w-5 h-5 transition-colors",
                                                                                    (action.rating || 0) >= star 
                                                                                        ? "fill-yellow-400 text-yellow-400" 
                                                                                        : "text-muted-foreground/20 hover:text-yellow-200"
                                                                                )} 
                                                                            />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                                                <span className="font-bold text-foreground mr-2">Impacto Directo:</span>
                                                                {action.impacto}
                                                            </p>
                                                        </div>
                                                        <div className="pt-4 border-t border-border/20 flex gap-4">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="flex-1 justify-between h-9 px-4 text-[11px] font-bold uppercase tracking-widest hover:bg-primary/5 hover:text-primary group-hover:translate-x-1 transition-all border border-transparent hover:border-primary/20"
                                                                onClick={() => handleDeepDive(i, action.titulo)}
                                                                disabled={actionDetails[i]?.loading}
                                                            >
                                                                {actionDetails[i]?.loading ? "Generando guía técnica..." : "Profundizar en la ejecución"}
                                                                <ChevronRight className="w-4 h-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm"
                                                                className="h-9 px-6 text-[10px] font-black uppercase tracking-widest rounded-none border-border/60 hover:border-primary hover:text-primary transition-all"
                                                                onClick={() => saveSuggestion(action.titulo, action.impacto, selectedTopic)}
                                                            >
                                                                <Bookmark className="w-4 h-4 mr-2" />
                                                                Guardar Táctica
                                                            </Button>
                                                        </div>

                                                        {actionDetails[i]?.text && (
                                                            <div className="mt-4 p-4 bg-muted/30 border border-border/20 rounded-none animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Brain className="w-3 h-3 text-primary" />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Guía de Ejecución AI</span>
                                                                </div>
                                                                <div className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-medium">
                                                                    {actionDetails[i].text.split('OBJETIVO FINAL:').map((part, idx) => (
                                                                        idx === 0 ? <p key={idx} className="mb-4">{part}</p> : 
                                                                        <div key={idx} className="mt-4 pt-3 border-t border-primary/20 bg-primary/5 p-3">
                                                                            <span className="text-primary font-black uppercase text-[8px] block mb-1">Objetivo Final</span>
                                                                            <p className="text-foreground font-bold">{part}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardHeader>
                                                </Card>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="especificos" className="space-y-6 animate-in fade-in duration-500 pt-6">
                            <div className="max-w-3xl space-y-4">
                                <div className="border-l-2 border-primary pl-4">
                                    <h2 className="text-xs font-black text-foreground uppercase tracking-widest">
                                        Generar Nuevo Caso
                                    </h2>
                                    <p className="text-[10px] text-muted-foreground font-normal lowercase italic mt-1 font-serif">
                                        Defina un objetivo táctico para recibir recomendaciones de resolución.
                                    </p>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input 
                                        placeholder="Describa el objetivo estratégico (ej: reactivar pacientes)..."
                                        value={customTopicInput}
                                        onChange={(e) => setCustomTopicInput(e.target.value)}
                                        className="h-10 text-xs bg-background border-border rounded-none focus-visible:ring-1 focus-visible:ring-primary shadow-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleGenerateSpecific();
                                        }}
                                    />
                                    <div className="flex flex-col gap-1 items-end sm:items-start shrink-0">
                                        <Button 
                                            onClick={handleGenerateSpecific} 
                                            disabled={isGeneratingSpecific || !customTopicInput.trim()}
                                            variant="outline"
                                            className="h-10 text-[10px] font-bold uppercase tracking-widest px-8 rounded-none border-foreground hover:bg-foreground hover:text-white transition-all shadow-none w-full sm:w-auto"
                                        >
                                            {isGeneratingSpecific ? (
                                                <><RefreshCw className="w-3 h-3 mr-2 animate-spin" /> Analizando</>
                                            ) : (
                                                "Consultar"
                                            )}
                                        </Button>
                                        <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest font-bold hidden sm:block">Límite: 1 análisis / día</span>
                                    </div>
                                </div>
                            </div>

                            {specificConsejos.length > 0 && !isGeneratingSpecific && (
                                <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {specificConsejos.map((consejo, i) => (
                                        <Card key={consejo.id} className="border-border shadow-none rounded-none bg-muted/10 overflow-hidden">
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50 bg-background/50">
                                                <CardTitle className="text-[11px] font-black text-foreground uppercase tracking-wider flex items-center gap-3">
                                                    <span className="text-muted-foreground pr-2 border-r border-border font-mono">0{i + 1}</span>
                                                    {consejo.titulo}
                                                </CardTitle>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={cn("h-6 w-6 rounded-none", consejo.feedback === "up" ? "bg-primary/10 text-primary" : "text-muted-foreground/30")}
                                                        onClick={() => rateSpecificConsejo(consejo.id, "up")}
                                                    >
                                                        <ThumbsUp className="w-3 h-3" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={cn("h-6 w-6 rounded-none", consejo.feedback === "down" ? "bg-destructive/10 text-destructive" : "text-muted-foreground/30")}
                                                        onClick={() => rateSpecificConsejo(consejo.id, "down")}
                                                    >
                                                        <ThumbsDown className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed italic">
                                                {consejo.descripcion}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="guardados" className="space-y-8 animate-in fade-in duration-500 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {savedSuggestions.length > 0 ? (
                                    savedSuggestions.map((s) => (
                                        <Card key={s.id} className="rounded-none border-border/80 shadow-xl bg-card relative group overflow-hidden border-t-4 border-t-primary min-h-[350px] flex flex-col">
                                            <div className="absolute top-4 right-4 z-10">
                                                <button 
                                                    onClick={() => deleteSavedSuggestion(s.id)}
                                                    className="p-2 bg-background/80 hover:bg-destructive hover:text-white rounded-full transition-all text-muted-foreground opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <CardHeader className="p-8 space-y-6 flex-grow">
                                                <div className="flex flex-col gap-4">
                                                    <Badge variant="outline" className="text-[10px] uppercase font-black rounded-none border-primary/40 text-primary w-fit px-3 py-1 tracking-[0.1em]">
                                                        {s.topic}
                                                    </Badge>
                                                    <CardTitle className="text-2xl font-black leading-tight tracking-tighter uppercase italic">
                                                        {s.titulo}
                                                    </CardTitle>
                                                </div>
                                                
                                                <div className="p-6 bg-primary/5 border-l-4 border-primary rounded-r-xl">
                                                    <p className="text-[10px] uppercase font-black text-primary/60 mb-2 tracking-widest">Objetivo Táctico Estratégico</p>
                                                    <p className="text-xl font-bold text-foreground leading-snug">
                                                        "{s.objetivo}"
                                                    </p>
                                                </div>

                                                <div className="space-y-4 pt-4">
                                                    <p className="text-[10px] uppercase font-black text-foreground/40 tracking-[0.2em] mb-4">Hoja de Ruta de Ejecución:</p>
                                                    <div className="grid gap-3">
                                                        {typeof s.hoja_ruta === 'string' ? s.hoja_ruta.split('\n').filter(line => line.trim()).map((step, idx) => (
                                                            <div key={idx} className="flex gap-4 items-start p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                                                                <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-black shrink-0">
                                                                    {idx + 1}
                                                                </div>
                                                                <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
                                                                    {step.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim()}
                                                                </p>
                                                            </div>
                                                        )) : null}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <div className="p-4 bg-muted/20 border-t border-border/10 text-[9px] uppercase font-black text-muted-foreground/40 text-right tracking-widest">
                                                Guardado el {s.fecha_guardado}
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="col-span-full p-20 border-2 border-dashed border-border flex flex-col items-center justify-center gap-6 text-center opacity-40 bg-muted/5">
                                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                            <Save className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-widest mb-2">Sin Sugerencias</h3>
                                            <p className="text-xs text-muted-foreground font-medium max-w-sm">No has guardado ninguna recomendación estratégica aún. Explora el Análisis de Secciones para comenzar.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

            </div>
        </div>
    );
}
