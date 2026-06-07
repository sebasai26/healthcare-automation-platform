-- Add date range columns to analisis_servicios
ALTER TABLE public.analisis_servicios 
ADD COLUMN IF NOT EXISTS fecha_inicio date,
ADD COLUMN IF NOT EXISTS fecha_fin date,
ADD COLUMN IF NOT EXISTS periodo_tipo text DEFAULT 'monthly';

-- Drop old constraint and create new one with date range
DROP INDEX IF EXISTS analisis_servicios_clinica_servicio_anio_key;
CREATE UNIQUE INDEX analisis_servicios_unique_key 
ON public.analisis_servicios (clinica, servicio, anio, COALESCE(fecha_inicio, '1900-01-01'::date));