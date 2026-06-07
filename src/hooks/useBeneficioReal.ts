import { useMemo } from "react";

const MONTH_KEYS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

// Mapping from contabilidad section names to possible app names for matching
const CONTAB_TO_APP_NAME: Record<string, string[]> = {
  'MACA': ['macarena', 'maca'],
  'XIARA': ['xiara'],
  'CRIS': ['cris', 'cristina'],
  'LUISA': ['luisa'],
  'ALBA': ['alba'],
  "YO": ["yolanda romero"],
  "AL": ["alba"],
  'AUTONOMO2': ['autónomo 2', 'autonomo 2'],
};

function matchProfName(appName: string, contabSection: string): boolean {
  const appLower = appName.trim().toLowerCase();
  const aliases = CONTAB_TO_APP_NAME[contabSection] || [];
  return aliases.some(alias => appLower.includes(alias));
}

/**
 * Shared hook to compute beneficio real from contabilidad data.
 * Returns a function `getBeneficioReal(physioName)` that looks up the correct value.
 * 
 * @param contabResumen - The result from useContabilidadResumen()
 * @param isAllYear - Whether we're viewing the whole year
 * @param monthIndex - 0-based month index (ignored if isAllYear)
 */
export function useBeneficioReal(
  contabResumen: any,
  isAllYear: boolean,
  monthIndex: number
) {
  const beneficioMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!contabResumen?.profBeneficios) return map;

    contabResumen.profBeneficios.forEach((p: any) => {
      let ingreso = 0;
      let gasto = 0;

      if (isAllYear) {
        ingreso = p.ingreso?.total || 0;
        gasto = p.gasto?.total || 0;
      } else {
        const mk = MONTH_KEYS[monthIndex];
        ingreso = p.ingreso?.[mk] || 0;
        // Yolanda (owner) has no wage costs
        const isYolanda = p.seccion === 'YO' || p.nombre.toLowerCase().includes('yolanda');
        gasto = isYolanda ? 0 : (p.gasto?.[mk] || 0);
      }

      const beneficio = ingreso - gasto;

      // Store with all possible name matches
      const aliases = CONTAB_TO_APP_NAME[p.seccion] || [];
      aliases.forEach((alias: string) => map.set(alias, beneficio));
      map.set(p.seccion.toLowerCase(), beneficio);
      map.set(p.nombre.toLowerCase(), beneficio);
    });
    return map;
  }, [contabResumen, isAllYear, monthIndex]);

  return (physioName: string): number | null => {
    if (beneficioMap.size === 0) return null;
    const nameLower = physioName.trim().toLowerCase();

    // Prevent "cristina ponce" from matching "cristina" (which maps to CRIS)
    for (const [key, value] of beneficioMap.entries()) {
      if (nameLower === 'cristina ponce' && key === 'cristina') continue;
      if (nameLower === key || nameLower.includes(key) || key.includes(nameLower)) {
        return value;
      }
    }
    return null;
  };
}
