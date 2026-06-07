import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCampanas, useMutateCampana, CampanaMarketing } from "@/hooks/useMarketing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, AlertCircle, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CampanaConsentimientoSection } from "./CampanaConsentimientoSection";

export function MarketingSection() {
    const { data: campanas, isLoading, error } = useCampanas();
    const [selectedCampana, setSelectedCampana] = useState<CampanaMarketing | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const calculateKpis = (c: CampanaMarketing) => {
        const costeTotal = c.coste_unitario_promocion * c.promociones_realizadas;
        const reactivacion = c.promociones_realizadas > 0
            ? (c.sesiones_pagadas / c.promociones_realizadas) * 100
            : null;
        const ingresosTotales = c.sesiones_pagadas * (c.precio_cita || 0);

        return { costeTotal, reactivacion, ingresosTotales };
    };

    const handleRowClick = (c: CampanaMarketing) => {
        setSelectedCampana(c);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setSelectedCampana(null);
        setIsModalOpen(false);
    };

    const toggleRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedRows(newSet);
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-fade-in max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Marketing y Control de Campañas</h1>
                    <p className="text-muted-foreground mt-1">Control de iniciativas de reactivación y captación de pacientes.</p>
                </div>

                <Button onClick={() => { setSelectedCampana(null); setIsModalOpen(true); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva Campaña
                </Button>
            </div>

            <div className="space-y-4 animate-in fade-in-50 duration-500">
                {/* Campaña de Consentimiento (datos de Supabase) */}
                <CampanaConsentimientoSection />

                {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-md flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            <p>Error cargando las campañas: {error.message}</p>
                        </div>
                    )}

                    <Card className="shadow-sm border-border">
                        <CardHeader>
                            <CardTitle>Listado de Campañas</CardTitle>
                            <CardDescription>Resumen del rendimiento y estado de todas las campañas automatizadas por WhatsApp activas e históricas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted/40 border border-border/60 rounded-lg p-4 mb-6 flex gap-3 text-sm text-muted-foreground items-start">
                                <AlertCircle className="w-4 h-4 shrink-0 text-primary/80 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-foreground">Nota informativa:</span> Esta sección no crea ni lanza campañas automáticamente, sino que sirve para registrar y medir el rendimiento de las campañas de WhatsApp automatizadas creadas por CliniQube.
                                </div>
                            </div>
                            {isLoading ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : !campanas || campanas.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay ninguna campaña registrada todavía.</p>
                                    <Button variant="outline" className="mt-4" onClick={() => { setSelectedCampana(null); setIsModalOpen(true); }}>
                                        Crear la primera campaña
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>Nombre</TableHead>
                                                <TableHead>Canal</TableHead>
                                                <TableHead className="text-center">Estado</TableHead>
                                                <TableHead className="text-center">Mensajes Enviados</TableHead>
                                                <TableHead className="text-center">Sesiones Realizadas</TableHead>
                                                <TableHead className="text-center">% Conversión a cita</TableHead>
                                                <TableHead className="text-right">Coste Total</TableHead>
                                                <TableHead className="text-right">Ingresos Totales</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {campanas.map((c) => {
                                                const { costeTotal, reactivacion, ingresosTotales } = calculateKpis(c);
                                                const isExpanded = expandedRows.has(c.id);
                                                return (
                                                    <React.Fragment key={c.id}>
                                                        <TableRow
                                                            onClick={() => handleRowClick(c)}
                                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                        >
                                                            <TableCell className="pl-4 pe-2" onClick={(e) => toggleRow(c.id, e)}>
                                                                {c.notas ? (
                                                                    <div className="p-1 rounded-sm hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
                                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                    </div>
                                                                ) : (
                                                                    <span className="w-6 h-6 inline-block"></span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-medium max-w-[200px] whitespace-normal break-words leading-tight py-3">
                                                                {c.nombre}
                                                            </TableCell>
                                                            <TableCell className="capitalize">{c.canal}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant={c.estado === 'activa' ? 'default' : 'secondary'} className={c.estado === 'activa' ? 'bg-primary/10 text-primary hover:bg-primary/20 border-0' : ''}>
                                                                    {c.estado}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center font-medium">{c.promociones_realizadas}</TableCell>
                                                            <TableCell className="text-center font-medium text-primary">{c.sesiones_pagadas}</TableCell>
                                                            <TableCell className="text-center">
                                                                {reactivacion !== null ? (
                                                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                                        {reactivacion.toFixed(1)}%
                                                                    </span>
                                                                ) : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {costeTotal > 0 ? `${costeTotal.toFixed(2)}€` : "0€"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium text-primary">
                                                                {ingresosTotales > 0 ? `${ingresosTotales.toFixed(2)}€` : "0€"}
                                                            </TableCell>
                                                        </TableRow>
                                                        {isExpanded && c.notas && (
                                                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                                <TableCell colSpan={9} className="py-4 px-6 border-b border-border/50">
                                                                    <div className="flex gap-3 text-sm text-foreground/80 bg-background p-4 rounded-md border border-border shadow-sm">
                                                                        <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                                                        <div>
                                                                            <p className="font-medium text-foreground mb-1">Notas de la campaña</p>
                                                                            <p className="whitespace-pre-wrap text-muted-foreground">{c.notas}</p>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            {/* Modal de Detalle / Edición */}
            <CampanaModal
                isOpen={isModalOpen}
                onClose={handleClose}
                campana={selectedCampana}
                calculateKpis={calculateKpis}
            />
        </div>
    );
}

// Subcomponente para el Modal
function CampanaModal({
    isOpen,
    onClose,
    campana,
    calculateKpis
}: {
    isOpen: boolean;
    onClose: () => void;
    campana: CampanaMarketing | null;
    calculateKpis: (c: CampanaMarketing) => { costeTotal: number; reactivacion: number | null; ingresosTotales: number };
}) {
    const { insertCampana, updateCampana, isInserting, isUpdating } = useMutateCampana();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        nombre: campana?.nombre || "",
        tipo: campana?.tipo || "Reactivación",
        canal: campana?.canal || "WhatsApp",
        estado: campana?.estado || "activa",
        coste_unitario_promocion: campana?.coste_unitario_promocion.toString() || "0",
        promociones_realizadas: campana?.promociones_realizadas.toString() || "0",
        sesiones_pagadas: campana?.sesiones_pagadas.toString() || "0",
        precio_cita: campana?.precio_cita?.toString() || "0",
        notas: campana?.notas || "",
    });

    // Whenever campana changes (open/close/select), reset form
    useEffect(() => {
        if (campana) {
            setFormData({
                nombre: campana.nombre,
                tipo: campana.tipo,
                canal: campana.canal,
                estado: campana.estado,
                coste_unitario_promocion: campana.coste_unitario_promocion.toString(),
                promociones_realizadas: campana.promociones_realizadas.toString(),
                sesiones_pagadas: campana.sesiones_pagadas.toString(),
                precio_cita: campana.precio_cita?.toString() || "0",
                notas: campana.notas || "",
            });
        } else {
            setFormData({
                nombre: "",
                tipo: "Reactivación",
                canal: "WhatsApp",
                estado: "activa",
                coste_unitario_promocion: "0",
                promociones_realizadas: "0",
                sesiones_pagadas: "0",
                precio_cita: "0",
                notas: "",
            });
        }
    }, [campana, isOpen]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            toast({ title: "El nombre es obligatorio", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            if (campana?.id) {
                // Update
                await updateCampana({
                    id: campana.id,
                    updates: {
                        ...formData,
                        coste_unitario_promocion: parseFloat(formData.coste_unitario_promocion) || 0,
                        promociones_realizadas: parseInt(formData.promociones_realizadas) || 0,
                        sesiones_pagadas: parseInt(formData.sesiones_pagadas) || 0,
                        precio_cita: parseFloat(formData.precio_cita) || 0,
                    }
                });
                toast({ title: "Campaña actualizada correctamente" });
            } else {
                // Create
                await insertCampana({
                    ...formData,
                    fecha_inicio: new Date().toISOString().split('T')[0],
                    fecha_fin: null,
                    coste_unitario_promocion: parseFloat(formData.coste_unitario_promocion) || 0,
                    promociones_realizadas: parseInt(formData.promociones_realizadas) || 0,
                    sesiones_pagadas: parseInt(formData.sesiones_pagadas) || 0,
                    precio_cita: parseFloat(formData.precio_cita) || 0,
                });
                toast({ title: "Campaña creada correctamente" });
            }
            onClose();
        } catch (error: any) {
            toast({ title: "Error guardando la campaña", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // KPIs Render Logic
    let liveKpis = { costeTotal: 0, reactivacion: null as number | null, ingresosTotales: 0 };
    if (isOpen) {
        liveKpis = calculateKpis({
            ...campana, ...formData,
            coste_unitario_promocion: parseFloat(formData.coste_unitario_promocion) || 0,
            promociones_realizadas: parseInt(formData.promociones_realizadas) || 0,
            sesiones_pagadas: parseInt(formData.sesiones_pagadas) || 0,
            precio_cita: parseFloat(formData.precio_cita) || 0,
        } as CampanaMarketing);
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{campana ? "Detalle de Campaña" : "Nueva Campaña"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4 bg-muted/30 p-4 rounded-lg border border-border/50">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Mensajes Enviados</span>
                        <span className="text-2xl font-bold">{formData.promociones_realizadas}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-primary uppercase">Sesiones</span>
                        <span className="text-2xl font-bold text-primary">{formData.sesiones_pagadas}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">% Conversión</span>
                        <span className="text-2xl font-bold text-emerald-600">{liveKpis.reactivacion !== null ? `${liveKpis.reactivacion.toFixed(1)}%` : "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-primary uppercase">Ingresos Totales</span>
                        <span className="text-2xl font-bold text-primary">{liveKpis.ingresosTotales > 0 ? `${liveKpis.ingresosTotales.toFixed(2)}€` : "0€"}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="nombre">Nombre de la campaña</Label>
                            <Input
                                id="nombre"
                                value={formData.nombre}
                                onChange={e => handleChange("nombre", e.target.value)}
                                placeholder="Ej: Cumpleaños – Sesión gratis 20 min"
                                className="font-medium"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tipo">Tipo</Label>
                            <Select value={formData.tipo} onValueChange={v => handleChange("tipo", v)}>
                                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Reactivación">Reactivación</SelectItem>
                                    <SelectItem value="Captación">Captación</SelectItem>
                                    <SelectItem value="Fidelización">Fidelización</SelectItem>
                                    <SelectItem value="Otro">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="canal">Canal Principal</Label>
                            <Select value={formData.canal} onValueChange={v => handleChange("canal", v)}>
                                <SelectTrigger id="canal"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                    <SelectItem value="Email">Email</SelectItem>
                                    <SelectItem value="Llamada">Llamada</SelectItem>
                                    <SelectItem value="Doctoralia">Doctoralia</SelectItem>
                                    <SelectItem value="Instagram">Instagram</SelectItem>
                                    <SelectItem value="Facebook">Facebook</SelectItem>
                                    <SelectItem value="Boca a boca">Boca a boca</SelectItem>
                                    <SelectItem value="Físico / Clínica">Físico / Clínica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="estado">Estado</Label>
                            <Select value={formData.estado} onValueChange={v => handleChange("estado", v)}>
                                <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="activa">Activa</SelectItem>
                                    <SelectItem value="finalizada">Finalizada</SelectItem>
                                    <SelectItem value="pausada">Pausada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="precio_cita">Precio de la cita (€)</Label>
                            <Input
                                id="precio_cita"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.precio_cita}
                                onChange={e => handleChange("precio_cita", e.target.value)}
                                className="text-lg font-medium border-primary/30 focus-visible:ring-primary"
                            />
                            <p className="text-[10px] text-muted-foreground">Precio medio percibido por cada cita generada.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/30 p-4 rounded-lg border border-border">
                        <div className="space-y-2">
                            <Label htmlFor="promociones">Mensajes Enviados (Realizadas)</Label>
                            <Input
                                id="promociones"
                                type="number"
                                min="0"
                                value={formData.promociones_realizadas}
                                onChange={e => handleChange("promociones_realizadas", e.target.value)}
                                className="text-lg font-medium"
                            />
                            <p className="text-[10px] text-muted-foreground">Cuántos mensajes, correos o volantes se enviaron/entregaron.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sesiones" className="text-primary">Sesiones Realizadas (Conversiones)</Label>
                            <Input
                                id="sesiones"
                                type="number"
                                min="0"
                                value={formData.sesiones_pagadas}
                                onChange={e => handleChange("sesiones_pagadas", e.target.value)}
                                className="text-lg font-medium border-primary/30 focus-visible:ring-primary"
                            />
                            <p className="text-[10px] text-muted-foreground">Cuántas citas pagadas y finalizadas generó directamente esta campaña.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="coste">Coste Unitario de Promoción (€)</Label>
                        <Input
                            id="coste"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.coste_unitario_promocion}
                            onChange={e => handleChange("coste_unitario_promocion", e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Coste de envío o material por cada impacto (ej: 0.15€ SMS).</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notas">Notas (Opcional)</Label>
                        <Textarea
                            id="notas"
                            value={formData.notas}
                            onChange={e => handleChange("notas", e.target.value)}
                            placeholder="Detalles sobre el guión, público objetivo, problemas o lecciones aprendidas..."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting || isUpdating || isInserting}>
                            {campana ? "Guardar Cambios" : "Crear Campaña"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
