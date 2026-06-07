import { useState, useMemo } from "react";
import { fixReplacementChars, toTitleCase } from "@/lib/name-utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Search, ChevronLeft, ChevronRight, Cake, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Paciente = {
  id: string;
  nh: string;
  nombre: string;
  apellidos: string | null;
  sexo: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
};

const AGE_RANGES = [
  { label: "Todos", min: 0, max: 200 },
  { label: "0-17", min: 0, max: 17 },
  { label: "18-30", min: 18, max: 30 },
  { label: "31-45", min: 31, max: 45 },
  { label: "46-60", min: 46, max: 60 },
  { label: "61-75", min: 61, max: 75 },
  { label: "76+", min: 76, max: 200 },
];

const CITAS_RANGES = [
  { label: "Todas", min: 0, max: 999999 },
  { label: "0 citas", min: 0, max: 0 },
  { label: "1-5", min: 1, max: 5 },
  { label: "6-15", min: 6, max: 15 },
  { label: "16-30", min: 16, max: 30 },
  { label: "31-50", min: 31, max: 50 },
  { label: "51+", min: 51, max: 999999 },
];

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Character fixing and title case imported from shared utility


function formatFechaNac(fecha: string | null): string {
  if (!fecha) return "-";
  try {
    const d = new Date(fecha);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return "-";
  }
}

export function ListaPacientesTab() {
  const [sexFilter, setSexFilter] = useState<string>("all");
  const [ageRange, setAgeRange] = useState<string>("Todos");
  const [citasRange, setCitasRange] = useState<string>("Todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [birthdayToday, setBirthdayToday] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fetch patients
  const { data: pacientes, isLoading: loadingPacientes, error: errorPacientes } = useQuery({
    queryKey: ["pacientes_demograficos"],
    queryFn: async () => {
      let allData: Paciente[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await (supabase as any)
          .from("pacientes_demograficos")
          .select("id, nh, nombre, apellidos, sexo, fecha_nacimiento, telefono")
          .range(from, from + batchSize - 1);

        if (error) {
          console.error("Error fetching pacientes_demograficos:", error);
          throw error;
        }
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });

  // Fetch citas realizadas count per patient (by phone, excluding test) - all time
  const { data: citasCounts, isLoading: loadingCitas, error: errorCitas } = useQuery({
    queryKey: ["citas_realizadas_por_paciente_all"],
    queryFn: async () => {
      let allCitas: { paciente_telefono: string; estado: string }[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await (supabase as any)
          .from("listado_citas")
          .select("paciente_telefono, estado")
          .ilike("estado", "realizada%")
          .neq("paciente_telefono", "666666666")
          .range(from, from + batchSize - 1);

        if (error) {
          console.error("Error fetching listado_citas for count:", error);
          throw error;
        }
        if (data && data.length > 0) {
          allCitas = [...allCitas, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Normalize phone: use only the FIRST/primary number, strip non-digits, remove leading "34"
      const normalizePhone = (raw: string): string => {
        if (!raw || !raw.trim()) return "";
        // Take only the first phone (before " - " separator for multi-number fields)
        const primary = raw.split(/\s+-\s+/)[0] || raw;
        const digits = primary.replace(/\D/g, "");
        if (!digits || digits.length < 6) return "";
        return digits.startsWith("34") && digits.length >= 11 ? digits.slice(2) : digits;
      };

      // Count by phone
      const countMap = new Map<string, number>();
      for (const cita of allCitas) {
        const tel = normalizePhone(cita.paciente_telefono || "");
        if (tel) {
          countMap.set(tel, (countMap.get(tel) || 0) + 1);
        }
      }
      return countMap;
    },
  });

  const isLoading = loadingPacientes || loadingCitas;
  const errorFetching = errorPacientes || errorCitas;

  // Enrich patients with citas count
  const enriched = useMemo(() => {
    if (!pacientes) return [];
    return pacientes.map(p => {
      const rawTel = (p.telefono || "").replace(/\D/g, "").trim();
      // Normalize: remove leading 34
      const tel = rawTel.startsWith("34") && rawTel.length >= 11 ? rawTel.slice(2) : rawTel;
      const numCitas = tel ? (citasCounts?.get(tel) || 0) : 0;
      const age = p.fecha_nacimiento ? calculateAge(p.fecha_nacimiento) : null;
      return { ...p, numCitas, age: age !== null && age < 200 ? age : null };
    });
  }, [pacientes, citasCounts]);

  const filtered = useMemo(() => {
    let result = enriched;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => {
        const fullName = `${p.nombre} ${p.apellidos || ""}`.toLowerCase();
        const fixedName = fixReplacementChars(fullName).toLowerCase();
        const tel = (p.telefono || "").replace(/\D/g, "");
        const nh = p.nh.toLowerCase();
        return fullName.includes(q) || fixedName.includes(q) || tel.includes(q) || nh.includes(q);
      });
    }

    if (sexFilter !== "all") {
      result = result.filter(p => p.sexo === sexFilter);
    }

    if (ageRange !== "Todos") {
      const range = AGE_RANGES.find(r => r.label === ageRange);
      if (range) {
        result = result.filter(p => p.age !== null && p.age >= range.min && p.age <= range.max);
      }
    }

    if (citasRange !== "Todas") {
      const range = CITAS_RANGES.find(r => r.label === citasRange);
      if (range) {
        result = result.filter(p => p.numCitas >= range.min && p.numCitas <= range.max);
      }
    }

    if (birthdayToday) {
      const today = new Date();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth();
      result = result.filter(p => {
        if (!p.fecha_nacimiento) return false;
        const birth = new Date(p.fecha_nacimiento);
        return birth.getDate() === todayDay && birth.getMonth() === todayMonth;
      });
    }

    if (citasRange !== "Todas") {
      result.sort((a, b) => b.numCitas - a.numCitas);
    } else {
      result.sort((a, b) => Number(a.nh) - Number(b.nh));
    }

    return result;
  }, [enriched, sexFilter, ageRange, citasRange, searchQuery, birthdayToday]);

  const effectivePageSize = pageSize === 0 ? filtered.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(effectivePageSize, 1)));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = pageSize === 0 ? filtered : filtered.slice((safeCurrentPage - 1) * effectivePageSize, safeCurrentPage * effectivePageSize);

  // Stats
  const stats = useMemo(() => {
    if (!enriched || enriched.length === 0) return null;

    const hombres = enriched.filter(p => p.sexo === "MASCULINO");
    const mujeres = enriched.filter(p => p.sexo === "FEMENINO");

    const citasHombres = hombres.reduce((sum, p) => sum + p.numCitas, 0);
    const citasMujeres = mujeres.reduce((sum, p) => sum + p.numCitas, 0);
    const mediaHombres = hombres.length > 0 ? citasHombres / hombres.length : 0;
    const mediaMujeres = mujeres.length > 0 ? citasMujeres / mujeres.length : 0;

    const withAge = enriched.filter(p => p.age !== null);
    const rangeCounts = AGE_RANGES.slice(1).map(range => {
      const group = withAge.filter(p => p.age! >= range.min && p.age! <= range.max);
      const citas = group.reduce((sum, p) => sum + p.numCitas, 0);
      return {
        label: range.label,
        count: group.length,
        citas,
        media: group.length > 0 ? citas / group.length : 0,
      };
    });
    const rangeCountsSorted = [...rangeCounts].sort((a, b) => b.count - a.count);
    const topCitasRange = [...rangeCounts].sort((a, b) => b.citas - a.citas)[0];

    return {
      total: enriched.length,
      mediaHombres,
      mediaMujeres,
      topCitasRange,
      rangeCounts,
      rangeCountsSorted,
    };
  }, [enriched]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando pacientes...</span>
      </div>
    );
  }

  if (errorFetching) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Error cargando pacientes</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {errorFetching instanceof Error ? errorFetching.message : JSON.stringify(errorFetching)}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!pacientes || pacientes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Sin datos de pacientes</h3>
          <p className="text-muted-foreground">
            Importa un archivo "Listado de cumpleaños" desde la sección Importar Datos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total pacientes</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Pacientes con fecha de cumpleaños registrada</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.mediaMujeres.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Media citas/pac. Mujeres</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.mediaHombres.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Media citas/pac. Hombres</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.topCitasRange?.label || "-"}</p>
              <p className="text-xs text-muted-foreground">Rango con más citas ({stats.topCitasRange?.citas.toLocaleString() || 0})</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Media: {stats.topCitasRange?.media.toFixed(2) || "0"} citas/pac.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o Nº Paciente..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Sexo</label>
          <Select value={sexFilter} onValueChange={(v) => { setSexFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="FEMENINO">Femenino</SelectItem>
              <SelectItem value="MASCULINO">Masculino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Rango de edad</label>
          <Select value={ageRange} onValueChange={(v) => { setAgeRange(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_RANGES.map(r => (
                <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Citas realizadas</label>
          <Select value={citasRange} onValueChange={(v) => { setCitasRange(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CITAS_RANGES.map(r => (
                <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground block mb-1 sr-only">Cumpleaños hoy</label>
          <div
            className={`flex items-center gap-2 h-10 px-4 rounded-md border cursor-pointer transition-colors ${birthdayToday ? 'bg-primary/10 border-primary' : 'bg-background border-input hover:bg-muted/50'}`}
            onClick={() => { setBirthdayToday(!birthdayToday); setCurrentPage(1); }}
          >
            <Cake className={`h-4 w-4 ${birthdayToday ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-sm ${birthdayToday ? 'text-primary font-medium' : 'text-foreground'}`}>Cumpleaños hoy</span>
            <Checkbox checked={birthdayToday} onCheckedChange={(v) => { setBirthdayToday(!!v); setCurrentPage(1); }} />
          </div>
        </div>
        <div className="flex items-end">
          <Badge variant="secondary" className="h-10 px-4 flex items-center">
            {filtered.length} pacientes
          </Badge>
        </div>
      </div>

      {/* Patient List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b z-10">
                <tr>
                  <th className="text-left p-3 text-muted-foreground font-medium">Nº Pac.</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Nombre</th>
                  <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell">Teléfono</th>
                  <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">F. Nacimiento</th>
                  <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Sexo</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Edad</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Citas</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 text-foreground font-mono text-xs">{p.nh}</td>
                    <td className="p-3 text-foreground">
                      {toTitleCase(p.nombre)} {p.apellidos ? toTitleCase(p.apellidos) : ""}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{p.telefono || "-"}</td>
                    <td className="p-3 text-foreground hidden sm:table-cell">
                      {formatFechaNac(p.fecha_nacimiento)}
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant={p.sexo === "FEMENINO" ? "default" : "secondary"} className="text-xs">
                        {p.sexo === "FEMENINO" ? "F" : p.sexo === "MASCULINO" ? "M" : "?"}
                      </Badge>
                    </td>
                    <td className="p-3 text-foreground">
                      {p.age !== null ? `${p.age}` : "-"}
                    </td>
                    <td className="p-3 text-foreground font-medium">
                      <span className={p.numCitas > 0 ? "" : "text-muted-foreground"}>{p.numCitas}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {filtered.length > 0
                  ? pageSize === 0
                    ? `${filtered.length} pacientes`
                    : `${(safeCurrentPage - 1) * effectivePageSize + 1}-${Math.min(safeCurrentPage * effectivePageSize, filtered.length)} de ${filtered.length}`
                  : "Sin resultados"}
              </p>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                  <SelectItem value="0">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pageSize !== 0 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (safeCurrentPage <= 3) {
                    page = i + 1;
                  } else if (safeCurrentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = safeCurrentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={page === safeCurrentPage ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Distribución por citas */}
      {stats && enriched.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Distribución por citas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Por sexo */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Por sexo</h4>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-muted-foreground font-medium">Sexo</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Pacientes</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Total citas</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Media citas/pac.</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">% del total citas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const groups = [
                        { label: "Femenino", data: enriched.filter(p => p.sexo === "FEMENINO") },
                        { label: "Masculino", data: enriched.filter(p => p.sexo === "MASCULINO") },
                      ];
                      const totalCitas = enriched.reduce((sum, p) => sum + p.numCitas, 0);
                      return groups.map(g => {
                        const citasGrupo = g.data.reduce((sum, p) => sum + p.numCitas, 0);
                        const media = g.data.length > 0 ? citasGrupo / g.data.length : 0;
                        const pct = totalCitas > 0 ? (citasGrupo / totalCitas) * 100 : 0;
                        return (
                          <tr key={g.label} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-2 text-foreground font-medium">{g.label}</td>
                            <td className="p-2 text-right text-foreground">{g.data.length}</td>
                            <td className="p-2 text-right text-foreground font-semibold">{citasGrupo.toLocaleString()}</td>
                            <td className="p-2 text-right text-foreground">{media.toFixed(2)}</td>
                            <td className="p-2 text-right text-primary font-medium">{pct.toFixed(1)}%</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Por rango de edad */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Por rango de edad</h4>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-muted-foreground font-medium">Rango</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Pacientes</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Total citas</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">Media citas/pac.</th>
                      <th className="text-right p-2 text-muted-foreground font-medium">% del total citas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const withAge = enriched.filter(p => p.age !== null);
                      const totalCitas = withAge.reduce((sum, p) => sum + p.numCitas, 0);
                      const ranges = AGE_RANGES.slice(1).map(range => {
                        const group = withAge.filter(p => p.age! >= range.min && p.age! <= range.max);
                        const citasGrupo = group.reduce((sum, p) => sum + p.numCitas, 0);
                        const media = group.length > 0 ? citasGrupo / group.length : 0;
                        const pct = totalCitas > 0 ? (citasGrupo / totalCitas) * 100 : 0;
                        return { label: range.label, count: group.length, citas: citasGrupo, media, pct };
                      });
                      ranges.sort((a, b) => b.citas - a.citas);
                      return ranges.map(r => (
                        <tr key={r.label} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2 text-foreground font-medium">{r.label}</td>
                          <td className="p-2 text-right text-foreground">{r.count}</td>
                          <td className="p-2 text-right text-foreground font-semibold">{r.citas.toLocaleString()}</td>
                          <td className="p-2 text-right text-foreground">{r.media.toFixed(2)}</td>
                          <td className="p-2 text-right text-primary font-medium">{r.pct.toFixed(1)}%</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribución por edad */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Distribución por edad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.rangeCountsSorted.map(range => {
                const pct = stats.total > 0 ? (range.count / stats.total) * 100 : 0;
                return (
                  <div key={range.label} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-12">{range.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground w-16 text-right">
                      {range.count} ({Math.round(pct)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
