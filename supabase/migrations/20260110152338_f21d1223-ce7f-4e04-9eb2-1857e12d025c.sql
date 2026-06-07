-- Evitar duplicados al importar listado_citas: clave estable por cita
-- Fix: fecha_cita puede ser tipo DATE, así que la convertimos a texto al generar la clave.

ALTER TABLE public.listado_citas
ADD COLUMN IF NOT EXISTS source_key text;

-- Rellenar source_key para filas existentes
UPDATE public.listado_citas
SET source_key = md5(
  coalesce(fecha_cita::text,'') || '|' ||
  coalesce(agenda,'') || '|' ||
  coalesce(asunto,'') || '|' ||
  coalesce(paciente_telefono,'') || '|' ||
  coalesce(servicio,'')
)
WHERE source_key IS NULL;

-- Eliminar duplicados existentes (mantener la fila más reciente)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY clinic_id, source_key
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.listado_citas
)
DELETE FROM public.listado_citas lc
USING ranked r
WHERE lc.id = r.id
  AND r.rn > 1;

-- Asegurar que source_key sea obligatorio de ahora en adelante
ALTER TABLE public.listado_citas
ALTER COLUMN source_key SET NOT NULL;

-- Unicidad para que futuras importaciones hagan upsert (sustituir) y nunca sumen duplicados
CREATE UNIQUE INDEX IF NOT EXISTS listado_citas_unique_source_key
ON public.listado_citas (clinic_id, source_key);
